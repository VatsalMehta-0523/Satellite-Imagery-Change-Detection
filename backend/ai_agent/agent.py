import os
import json
import logging
from typing import List, Optional, Dict, Any, TypedDict, Annotated
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from app.core.config import GROQ_API_KEY, DATABASE_URL
from ai_agent.tools import tools

logger = logging.getLogger("uvicorn.error")

SYSTEM_PROMPT = """
You are ORION-1, the autonomous UrbanEye intelligence agent. Execute the geospatial pipeline step-by-step.

### 🛡️ OPERATIONAL PROTOCOLS

1. **HUMAN-IN-THE-LOOP (HITL)**
   - You MUST seek explicit user permission before executing EVERY tool. 
   - **PRE-ACTION**: Explain the next tool's purpose. ASK: "Should I proceed with [Next Tool]?"
   - **EXECUTION**: Only call the tool after user confirmation ("Go", "Yes"). 
   - **POST-ACTION**: Report completion and specify its UI location (Dashboard, Spectral, or Change Detection).

2. **MISSION SETUP (RULE #1)**
   - If telemetry is provided, suggest a Mission Name and Analysis Goal.
   - **CRITICAL**: You are FORBIDDEN from calling `create_mission` until the user confirms the name and goal.

3. **PIPELINE SEQUENCE**
   - 1. `create_mission` ➔ 2. `execute_orbital_fetch` (T1) ➔ 3. `execute_orbital_fetch` (T2) ➔ 4. `execute_spectral_analysis` ➔ 5. `run_changeformer_inference` ➔ 6. `generate_mission_dossier`.

4. **UI SYNCHRONIZATION**
   - After tools finish, tell the user where to look:
   - `create_mission` / `fetch`: "Check the **Mission Dashboard**."
   - `spectral`: "Check the **Spectral Index Validation** page."
   - `inference` / `dossier`: "Check the **Change Detection** page."

Awaiting your command.
"""

# GLOBAL OBJECTS (Initialized Lazily)
_pool: Optional[AsyncConnectionPool] = None
_checkpointer: Optional[AsyncPostgresSaver] = None
_graph: Optional[Any] = None

async def get_agent_graph():
    """Lazy initialization of the LangGraph agent with HITL Interrupts."""
    global _pool, _checkpointer, _graph
    
    if _graph is None:
        logger.info(">>> [ORION] Initializing Agent Graph with HITL Enforcement...")
        
        # 1. Initialize stable LLM (User requested Llama-3.3-70b)
        llm = ChatGroq(
            api_key=GROQ_API_KEY,
            model="llama-3.3-70b-versatile",
            temperature=0.1 # Lower temperature for better instruction following
        )
        
        # 2. Setup Pool
        CONNECTION_KWARGS = {
            "autocommit": True, 
            "prepare_threshold": None,
            "connect_timeout": 10
        }
        _pool = AsyncConnectionPool(
            conninfo=DATABASE_URL,
            max_size=5,
            min_size=1,
            kwargs=CONNECTION_KWARGS,
            open=False
        )
        await _pool.open()
        
        # 3. Initialize Checkpointer and Graph with Interrupts
        _checkpointer = AsyncPostgresSaver(_pool)
        await _checkpointer.setup()
        
        # We use interrupt_before to force a pause before ANY tool call
        _graph = create_react_agent(
            llm, 
            tools=tools, 
            prompt=SYSTEM_PROMPT,
            checkpointer=_checkpointer,
            interrupt_before=["tools"]
        )
    
    return _graph

class AgentManager:
    async def run_mission(self, user_request: str, aoi: Optional[dict], session_id: str, mission_params: Optional[dict] = None):
        # Ensure graph is ready and checkpointer is active
        graph = await get_agent_graph()
        config = {"configurable": {"thread_id": session_id}}
        
        # 1. State Intelligence: Check if we are currently interrupted
        state = await graph.aget_state(config)
        is_interrupted = bool(state.next)
        
        # 2. Decision Engine for HITL Resumption & Approval Persistence
        approval_keywords = ["go", "yes", "proceed", "ahead", "continue", "confirm", "start", "run", "ok", "ack"]
        is_approval = any(word in user_request.lower() for word in approval_keywords)
        
        graph_input = None
        if not is_interrupted:
            # New mission start or follow-up in settled thread
            mission_input = f"MISSION: {user_request}"
            if mission_params:
                # CRITICAL: Injected SOURCE so the agent knows which sensor to use
                source = mission_params.get('source', 's2dr3')
                mission_input += f"\n[AUTO-TELEMETRY]: {json.dumps(mission_params.get('aoi'))} | T1: {mission_params.get('t1Date')} | T2: {mission_params.get('t2Date')} | SOURCE: {source.upper()}"
            elif aoi:
                mission_input += f"\nCONTEXT: AOI is {json.dumps(aoi)}"
            graph_input = {"messages": [HumanMessage(content=mission_input)]}
        elif is_approval:
            # RESUME: Passing None is the official way to continue an interrupted graph
            logger.info(f">>> [ORION] HITL Resume Signal detected for thread {session_id}. Triggering tools...")
            graph_input = None 
        else:
            # CONTEXT UPDATE: User gave info instead of permission. 
            last_msg = state.values.get("messages", [])[-1]
            if hasattr(last_msg, "tool_calls") and last_msg.tool_calls:
                logger.info(f">>> [ORION] Injecting ToolMessages to satisfy dangling calls in {session_id}")
                await graph.aupdate_state(config, {
                    "messages": [
                        ToolMessage(tool_call_id=t["id"], content=f"User clarified: '{user_request}'. Aborting previous plan.") 
                        for t in last_msg.tool_calls
                    ]
                })
            graph_input = {"messages": [HumanMessage(content=user_request)]}

        # 3. Execution Stream
        async for event in graph.astream_events(
            graph_input,
            config=config,
            version="v2"
        ):
            kind = event["event"]
            
            # Tool logic: Start and End events
            if kind == "on_tool_start":
                yield {"type": "TOOL_START", "tool": event["name"], "input": event["data"].get("input")}
            elif kind == "on_tool_end":
                raw_output = event["data"].get("output")
                # Normalize ToolMessage content for UI
                if hasattr(raw_output, 'content'):
                    try:
                        output = json.loads(raw_output.content)
                    except (json.JSONDecodeError, TypeError):
                        output = str(raw_output.content)
                elif isinstance(raw_output, (dict, list)):
                    output = raw_output
                else:
                    output = str(raw_output) if raw_output else ""
                
                yield {"type": "TOOL_END", "tool": event["name"], "output": output}
            
            # Model logic: Stream the textual narration
            elif kind == "on_chat_model_end":
                if "output" in event["data"]:
                    msg = event["data"]["output"]
                    content = msg.content if hasattr(msg, 'content') else str(msg)
                    if content:
                        yield {"type": "AGENT_MESSAGE", "content": content}

# 4. GLOBAL GRAPH EXPORT (For LangGraph CLI / Dev Server)
# We export a shared instance that uses the same checkpointer logic
llm_global = ChatGroq(
    api_key=GROQ_API_KEY,
    model="llama-3.3-70b-versatile",
    temperature=0.1
)

# Note: The CLI/Studio provides its own checkpointer, 
# but we MUST keep interrupt_before to ensure Studio also respects HITL.
graph = create_react_agent(
    llm_global, 
    tools=tools, 
    prompt=SYSTEM_PROMPT,
    interrupt_before=["tools"]
)

agent_manager = AgentManager()
