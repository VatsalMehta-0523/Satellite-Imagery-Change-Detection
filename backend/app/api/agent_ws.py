import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Optional
from ai_agent.agent import agent_manager
from app.core.logger import get_logger

router = APIRouter()
logger = get_logger("app.agent")

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, session_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def send_json(self, session_id: str, message: dict):
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_json(message)
            except Exception as e:
                logger.error(f">>> [AGENT] Failed to send JSON to {session_id}: {e}")
                self.disconnect(session_id)

manager = ConnectionManager()

@router.websocket("/ws/agent/{session_id}")
async def agent_websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(session_id, websocket)
    logger.info(f">>> [AGENT] Session {session_id} connected (Postgres Persistence Active).")
    
    # Heartbeat task to keep connection alive
    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(20)
                if session_id in manager.active_connections:
                    await websocket.send_json({"type": "HEARTBEAT"})
        except Exception: pass

    heartbeat_task = asyncio.create_task(heartbeat())

    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message.get("type") in ["START_MISSION", "CHAT_MESSAGE", "HUMAN_INPUT"]:
                user_content = message.get("user_request", message.get("content"))
                aoi = message.get("aoi") if message.get("type") == "START_MISSION" else None
                mission_params = message.get("mission_params")
                asyncio.create_task(run_agent_cycle(session_id, user_content, aoi, mission_params))

    except WebSocketDisconnect:
        manager.disconnect(session_id)
        heartbeat_task.cancel()
        logger.info(f">>> [AGENT] Session {session_id} disconnected.")
    except Exception as e:
        manager.disconnect(session_id)
        heartbeat_task.cancel()
        logger.error(f">>> [AGENT] WS CRITICAL FAILURE: {str(e)}")

async def run_agent_cycle(session_id: str, content: str, aoi: Optional[dict], mission_params: Optional[dict] = None):
    """Standardized bridge between LangChain events and the UrbanEye UI."""
    try:
        async for event in agent_manager.run_mission(content, aoi, session_id, mission_params):
            e_type = event["type"]
            
            if e_type == "TOOL_START":
                await manager.send_json(session_id, {
                    "type": "TOOL_EXECUTION",
                    "tool": event["tool"],
                    "status": "initiating",
                    "result": f"Executing orbital tool: {event['tool']}..."
                })
            
            elif e_type == "TOOL_END":
                tool_name = event.get("tool")
                tool_output = event.get("output")
                
                # Neural Sync: If a mission was created, notify the UI to start global polling
                if tool_name == "create_mission" and isinstance(tool_output, dict):
                    p_id = tool_output.get("project_id")
                    if p_id:
                        await manager.send_json(session_id, {
                            "type": "MISSION_SYNC_TRIGGER",
                            "project_id": p_id
                        })

                await manager.send_json(session_id, {
                    "type": "TOOL_EXECUTION",
                    "tool": tool_name,
                    "status": "accomplished",
                    "result": f"Task completed successfully."
                })
            
            elif e_type == "AGENT_MESSAGE":
                await manager.send_json(session_id, {
                    "type": "AGENT_MESSAGE",
                    "content": event["content"]
                })
        
        await manager.send_json(session_id, {"type": "CYCLE_COMPLETE"})

    except Exception as e:
        logger.error(f">>> [AGENT] CYCLE ERROR: {str(e)}")
        await manager.send_json(session_id, {
            "type": "ERROR",
            "content": "ORION is currently re-aligning its neural weights due to a connection discrepancy. Please re-initiate your mission in a moment."
        })
