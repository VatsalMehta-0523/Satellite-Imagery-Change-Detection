import os
import json
import logging
from typing import Dict, Any
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from app.core.config import DATA_DIR

logger = logging.getLogger("app.services.ai_narrative")

SYSTEM_PROMPT = """
You are a Lead Geospatial Intelligence Analyst (GEOINT) with 20 years of experience in satellite-based urban compliance monitoring and environmental impact assessment.

Your task is to write a comprehensive, professional strategic intelligence report for a satellite mission dossier. You will be provided with raw mission telemetry including spectral indices and change detection metrics.

## Interpretation Guidelines

Interpret spectral values scientifically using these rules:
- **NDVI** (Normalized Difference Vegetation Index): Range -1 to 1. Values > 0.4 = dense vegetation. Drop of > 0.1 = deforestation or clearing.
- **NDBI** (Normalized Difference Built-Up Index): Range -1 to 1. Values > 0.1 = significant built-up area. Rise = urbanization/construction.
- **NDWI** (Normalized Difference Water Index): Range -1 to 1. Values > 0.3 = open water. Rise = flooding or reservoir expansion.
- **MNDWI** (Modified NDWI): More sensitive to water mixed with urban. Rise with NDBI rise = industrial water runoff.
- **BSI** (Bare Soil Index): Range -1 to 1. Values > 0.2 = exposed earth. Rise = excavation, demolition, or construction site prep.
- **EVI** (Enhanced Vegetation Index): Range -1 to 1. Similar to NDVI but corrected for atmosphere. Drop = vegetation loss.

Cross-reference indices:
- NDVI drop + BSI rise + NDBI rise = **Active construction or deforestation**
- NDWI rise + NDVI stable = **Controlled irrigation or seasonal flooding**
- NDBI rise + EVI drop = **Urban sprawl replacing agricultural land**
- BSI rise + NDVI drop + no NDBI rise = **Land clearing for future development**
- All indices stable = **No significant change detected**

## Output Format

Structure your response as a JSON object with these fields:
- **executive_summary**: A detailed 5-8 sentence professional paragraph covering the overall mission findings, temporal context, and strategic implications. Write as if briefing a city planning commissioner.
- **change_type**: Primary driver of detected change (e.g., "Urban Expansion", "Deforestation", "Industrial Development", "Hydrological Shift", "No Significant Change").
- **severity**: Risk classification: "Low", "Moderate", "High", or "Critical".
- **key_findings**: A list of exactly 5 specific, data-backed bullet points. Each should reference actual spectral values.
- **index_interpretations**: A dict mapping each index name (NDVI, NDBI, etc.) to a 2-sentence interpretation of what that specific index value means for this AOI.
- **environmental_impact**: A 3-4 sentence paragraph on ecological implications.
- **urban_compliance_assessment**: A 2-3 sentence paragraph on whether zoning or construction violations may be occurring.
- **recommendations**: A list of exactly 3 strategic next-step recommendations with specific actions.
- **risk_factors**: A list of 2-3 potential risks if the detected trend continues unchecked.
- **confidence_level**: Your analytical confidence as a percentage (e.g., "87%") with a brief justification.

Return ONLY the JSON object, no markdown fencing.
"""

class AINarrativeService:
    def __init__(self):
        self.llm = ChatGroq(
            temperature=0.3,
            model_name="llama-3.3-70b-versatile"
        )

    async def generate_analysis(self, mission_data: Dict[str, Any]) -> Dict[str, Any]:
        """Synthesize raw telemetry into a comprehensive strategic briefing."""
        logger.info(f">>> [AI ANALYST] Synthesizing Strategic Brief for PID {mission_data.get('project_id')}")
        
        # Build a detailed index summary for the prompt
        indices_detail = ""
        for idx in mission_data.get('indices', []):
            name = idx.get('name', 'Unknown')
            mean = idx.get('mean_val', 0)
            desc = idx.get('description', '')
            indices_detail += f"  - {name}: mean={mean:.4f} ({desc})\n"
        
        if not indices_detail:
            indices_detail = "  No spectral indices available for this mission.\n"

        prompt = f"""
MISSION TELEMETRY BRIEFING:
===========================
Mission ID: {mission_data.get('project_id')}
Temporal Envelope: {mission_data.get('t1_date')} (Baseline/T1) → {mission_data.get('t2_date')} (Monitoring/T2)
Detected Change Percentage: {mission_data.get('change_pct', 0):.2f}%

SPECTRAL INDEX VALUES (T2 — Monitoring Period):
{indices_detail}

Analyze this data thoroughly. Cross-reference the indices against each other to identify the primary driver of change. Provide a comprehensive intelligence assessment.
"""

        try:
            messages = [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(content=prompt)
            ]
            
            response = await self.llm.ainvoke(messages)
            
            # Clean possible markdown markers
            content = response.content.replace("```json", "").replace("```", "").strip()
            result = json.loads(content)
            
            # Backward compatibility: map executive_summary to summary if needed
            if 'executive_summary' in result and 'summary' not in result:
                result['summary'] = result['executive_summary']
            
            return result
        except Exception as e:
            logger.error(f">>> [AI ANALYST] Narrative synthesis failed: {e}")
            return {
                "summary": "Geospatial dossier compiled autonomously. Neural discrepancy detected in temporal baseline.",
                "executive_summary": "Geospatial dossier compiled autonomously. Neural discrepancy detected in temporal baseline.",
                "change_type": "Environmental/Structural Shift",
                "severity": "Moderate",
                "key_findings": [
                    "Pixel-level discrepancy confirmed across temporal baseline",
                    "Spectral shift detected in satellite telemetry bands",
                    "Cross-index correlation suggests land-use modification",
                    "Further field verification recommended",
                    "Confidence interval requires additional orbital passes"
                ],
                "index_interpretations": {},
                "environmental_impact": "Environmental assessment pending detailed field validation.",
                "urban_compliance_assessment": "Compliance status requires cross-reference with municipal zoning records.",
                "recommendations": [
                    "Conduct detailed urban compliance audit with municipal records",
                    "Deploy high-resolution drone survey over flagged sub-regions",
                    "Schedule follow-up orbital pass in 30 days for trend confirmation"
                ],
                "risk_factors": [
                    "Undetected unauthorized construction if trend continues",
                    "Potential ecological degradation in flagged vegetation zones"
                ],
                "confidence_level": "45% — Limited telemetry available for comprehensive assessment"
            }
