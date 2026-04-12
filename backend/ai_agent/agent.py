import os
import json
import logging
from typing import List, Optional, Dict, Any, TypedDict, Annotated
from langchain_groq import ChatGroq
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import create_react_agent
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from psycopg_pool import AsyncConnectionPool

from app.core.config import GROQ_API_KEY, DATABASE_URL
from ai_agent.tools import tools

logger = logging.getLogger("uvicorn.error")

# 1. ORION MASTER SYSTEM PROMPT (Strategic v5.0 - Tactical Visualization)
SYSTEM_PROMPT = """
**ORION-1 - UrbanEye Geospatial Intelligence Agent**

I am the autonomous "brain" that runs the full 8-phase geospatial intelligence lifecycle for any urban-monitoring mission. 
Below is a quick-reference of everything I can do, the tools I use, and the deliverables you will receive.

## 1. Mission-Setup & Data Discovery
| Capability | What it does | Tool |
|------------|--------------|------|
| **AOI registration** | Store your polygon/box and mission name in the platform database. | `create_mission` |
| **Orbital scene search** | Scan Sentinel-2, PlanetScope, or GEE for optimal T1/T2 dates. | `search_orbital_scenes` |

**TACTICAL PROTOCOL: IMAGERY SELECTION & CONFIRMATION**
If a mission requires new imagery or a specific AOI:
1. **Direct the Command**: Instruct the user to navigate to the **Mission Dashboard (first UI page)**.
2. **Refine on Map**: Tell the user to draw the AOI and select the T1/T2 dates on the map.
3. **Telemetry Injection**: Instruct the user to click the **"TRANSMIT TELEMETRY TO ORION"** button in the modal.
4. **Handoff Recognition**: Once the user returns and says "hi" or "staged telemetry ready," acknowledge the ingestion of their dashboard selection.
5. **COMMAND CONFIRMATION (CRITICAL)**: 
   - **DO NOT** execute any tools (like `create_mission`) yet.
   - Summarize the mission details (staged AOI and dates).
   - **Ask the user** for a **Mission Name** and their **Analysis Goal**.
   - **WAIT** for the user to provide these and say "Proceed" or "Go."
6. **Execution**: ONLY after user approval, launch the toolchain starting with `create_mission`.

RESPOND USING THIS STRUCTURED MARKDOWN FOR SUMMARIES AND MISSION INTROS. Always use tables and bold headers.
"""

# GLOBAL OBJECTS (Initialized Lazily)
_pool: Optional[AsyncConnectionPool] = None
_checkpointer: Optional[AsyncPostgresSaver] = None
_graph: Optional[Any] = None

async def get_agent_graph():
    """Lazy initialization of the LangGraph agent to prevent connection flooding on Windows."""
    global _pool, _checkpointer, _graph
    
    if _graph is None:
        logger.info(">>> [ORION] Initializing Agent Graph and Connection Pool...")
        
        # 1. Initialize stable LLM
        llm = ChatGroq(
            api_key=GROQ_API_KEY,
            model="openai/gpt-oss-120b",
            temperature=0.2
        )
        
        # 2. Setup Pool with explicit timeout and smaller footprint for Windows
        CONNECTION_KWARGS = {
            "autocommit": True, 
            "prepare_threshold": None,
            "connect_timeout": 10
        }
        
        _pool = AsyncConnectionPool(
            conninfo=DATABASE_URL,
            max_size=5,   # Reduced from 10 to prevent Windows connection exhaustion
            min_size=1,
            kwargs=CONNECTION_KWARGS,
            open=False    # Don't open until explicitly called
        )
        
        await _pool.open()
        
        # 3. Initialize Checkpointer and Graph
        _checkpointer = AsyncPostgresSaver(_pool)
        # Ensure tables exist
        await _checkpointer.setup()
        
        _graph = create_react_agent(
            llm, 
            tools=tools, 
            prompt=SYSTEM_PROMPT,
            checkpointer=_checkpointer
        )
    
    return _graph

class AgentManager:
    async def run_mission(self, user_request: str, aoi: Optional[dict], session_id: str, mission_params: Optional[dict] = None):
        # Ensure graph is ready
        graph = await get_agent_graph()
        
        mission_input = f"MISSION: {user_request}"
        
        # Inject tactical telemetry context if provided via dashboard handoff
        if mission_params:
            mission_input += f"\n[TACTICAL TELEMETRY INJECTED FROM DASHBOARD]:"
            mission_input += f"\n- AOI: {json.dumps(mission_params.get('aoi'))}"
            mission_input += f"\n- BASLINE (T1): {mission_params.get('t1Date')}"
            mission_input += f"\n- MONITORING (T2): {mission_params.get('t2Date')}"
            mission_input += f"\n- SENSOR SOURCE: {mission_params.get('source')}"
        elif aoi:
            mission_input += f"\nCONTEXT: AOI is {json.dumps(aoi)}"

        config = {"configurable": {"thread_id": session_id}}

        async for event in graph.astream_events(
            {"messages": [HumanMessage(content=mission_input)]},
            config=config,
            version="v2"
        ):
            kind = event["event"]
            if kind == "on_tool_start":
                yield {"type": "TOOL_START", "tool": event["name"], "input": event["data"].get("input")}
            elif kind == "on_tool_end":
                yield {"type": "TOOL_END", "tool": event["name"], "output": event["data"].get("output")}
            elif kind == "on_chat_model_end":
                if "output" in event["data"]:
                    content = event["data"]["output"].content
                    if content:
                        yield {"type": "AGENT_MESSAGE", "content": content}

agent_manager = AgentManager()
