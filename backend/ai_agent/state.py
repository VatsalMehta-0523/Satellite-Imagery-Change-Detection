from typing import List, Optional, Dict, Any, Union
from typing_extensions import TypedDict

class AgentState(TypedDict):
    # Mission Identifiers
    mission_id: Optional[str]
    project_id: Optional[int]
    session_id: str
    mission_name: Optional[str]
    
    # Intent & Parameters
    intent: Optional[str]
    user_request: str
    aoi_geojson: Optional[dict]
    aoi_wkt: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    status: str # current phase, e.g., 'init', 'fetching', 'indexing', etc.
    
    # Pipeline Data
    source: Optional[str]
    selected_dates: Dict[str, str] # e.g., {"T1": "2022-03-15", "T2": "2024-09-14"}
    image_ids: Dict[str, int] # e.g., {"T1": 12, "T2": 15}
    indices_ready: List[str] # List of image_ids that finished spectral compute
    change_detection_job_id: Optional[str]
    compliance_results: Optional[dict]
    
    # UI & Telemetry
    ui_actions: List[Dict[str, Any]] # Queue of actions to send to frontend
    telemetry_logs: List[str]
    progress: int # 0-100
    
    # Human-in-the-loop
    needs_human: bool
    human_response: Optional[str]
    available_dates_buffer: List[Dict[str, Any]] # Stored search results for user selection
    
    # Final Output
    report_url: Optional[str]
    pdf_url: Optional[str]
    narrative: Optional[str]
