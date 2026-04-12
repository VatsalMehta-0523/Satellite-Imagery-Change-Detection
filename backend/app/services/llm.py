"""
LLM Service using Groq API
Provides high-speed AI-generated contextual summaries, change explanations, and reports
Using Llama-3 models for robust geospatial analysis
"""
import json
import re
from typing import Optional
from groq import Groq
from app.core.config import GROQ_API_KEY
import asyncio

def get_client():
    if not GROQ_API_KEY:
        return None
    return Groq(api_key=GROQ_API_KEY)

async def _safe_generate(prompt: str, expect_json: bool = False) -> str:
    client = get_client()
    if not client:
        if expect_json:
            return json.dumps({"error": "LLM not configured", "summary": "GROQ_API_KEY not set."})
        return "LLM not configured. Please set GROQ_API_KEY."
    
    try:
        # Use llama3-70b-8192 as it is the most stable for JSON mode on Groq
        response = await asyncio.to_thread(
            client.chat.completions.create,
            messages=[{"role": "user", "content": prompt}],
            model="llama-3.3-70b-versatile",
            temperature=0.4,
            max_tokens=2048,
            top_p=1,
            stream=False,
            response_format={"type": "json_object"} if expect_json else None
        )
        text = response.choices[0].message.content.strip()
        return text
    except Exception as e:
        if expect_json:
            return json.dumps({"error": str(e), "summary": "AI Insight Generation Offline."})
        return f"Telemetry Sync Error: {e}"

async def generate_index_briefings(name: str, t1_val: float, t2_val: float, meta: dict) -> str:
    """Generate a 1-sentence AI briefing for a specific index fluctuation."""
    delta = t2_val - t1_val
    trend = "increase" if delta > 0 else "decrease"
    
    prompt = f"""
    Explain the following spectral index change in 1 short sentence for a satellite dashboard.
    Index: {name} ({meta.get('full_name')})
    Description: {meta.get('description')}
    Trend: {trend} of {abs(delta):.3f} (from {t1_val:.3f} to {t2_val:.3f})
    
    Focus on the real-world implication (e.g., vegetation growth, loss of surface water, urban spread).
    DO NOT use markdown. Return as plain text.
    """
    return await _safe_generate(prompt)

async def generate_prefetch_context(aoi_geojson: dict, t1_date: str, t2_date: str) -> str:
    """Generate contextual text while images are loading."""
    coords = aoi_geojson.get("coordinates", [])
    prompt = f"""
You are a geospatial analyst. A user has selected an area of interest and is fetching satellite imagery.
AOI coordinates: {coords}
Time period 1: {t1_date}
Time period 2: {t2_date}

Generate a brief, engaging contextual paragraph (2-3 sentences) about what kind of changes might be 
observable between these time periods for this area. Be specific about the time gap and potential 
environmental or urban changes. Keep it clean and professional for a SaaS platform UI.
Return plain text only, no markdown.
"""
    return await _safe_generate(prompt)

async def generate_change_explanation(
    mask_confidence: float,
    t1_date: str,
    t2_date: str,
    indices_t1: dict,
    indices_t2: dict,
) -> dict:
    """Generate structured explanation of detected changes."""
    ndvi_delta = indices_t2.get("NDVI", {}).get("mean", 0) - indices_t1.get("NDVI", {}).get("mean", 0)
    ndbi_delta = indices_t2.get("NDBI", {}).get("mean", 0) - indices_t1.get("NDBI", {}).get("mean", 0)

    prompt = f"""
Analyze satellite change detection results and provide a JSON response.

Detection results:
- Change confidence (% pixels changed): {mask_confidence * 100:.1f}%
- T1 date: {t1_date}, T2 date: {t2_date}
- NDVI change (vegetation): {ndvi_delta:+.3f}
- NDBI change (built-up): {ndbi_delta:+.3f}
- T1 indices: {indices_t1}
- T2 indices: {indices_t2}

Return ONLY a valid JSON object with these exact keys:
{{
  "summary": "2-3 sentence plain text summary of changes",
  "change_type": "one of: urbanization, deforestation, flood, drought, construction, vegetation_growth, unknown",
  "severity": "one of: low, moderate, high, critical",
  "key_findings": ["finding 1", "finding 2", "finding 3"],
  "recommendation": "single actionable recommendation"
}}
"""
    raw = await _safe_generate(prompt, expect_json=True)
    try:
        return json.loads(raw)
    except Exception:
        return {
            "summary": f"Changes detected with {mask_confidence*100:.1f}% pixel-level change.",
            "change_type": "unknown",
            "severity": "moderate",
            "key_findings": ["Significant land use change detected"],
            "recommendation": "Conduct field verification.",
        }

async def generate_insights_report(
    aoi_geojson: dict,
    t1_date: str,
    t2_date: str,
    indices_t1: dict,
    indices_t2: dict,
    change_data: dict,
    compliance_rules: list,
    report_type: str = "standard",
    detail_level: str = "standard",
) -> dict:
    """Generate comprehensive insights report."""
    prompt = f"""
Generate a comprehensive change detection report in JSON format.

DATA:
- AOI: {aoi_geojson.get('coordinates', 'Unknown')}
- T1 date: {t1_date}, T2 date: {t2_date}
- Change confidence: {change_data.get('confidence', 0) * 100:.1f}%
- T1 spectral indices: {indices_t1}
- T2 spectral indices: {indices_t2}
- Compliance rules: {[r.get('rule_name') for r in compliance_rules]}

Return ONLY a valid JSON object with this structure:
{{
  "title": "Report title",
  "executive_summary": "3-4 sentence overview",
  "key_metrics": {{
    "vegetation_change_pct": number,
    "urban_expansion_pct": number,
    "water_change_pct": number,
    "overall_risk_score": number (0-100)
  }},
  "sections": [
    {{
      "heading": "Section name",
      "content": "Detailed paragraph",
      "severity": "info|warning|critical"
    }}
  ],
  "compliance_assessment": [
    {{
      "rule": "rule name",
      "status": "compliant|warning|violation",
      "reason": "brief explanation"
    }}
  ],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "confidence_note": "Note about data quality"
}}
"""
    raw = await _safe_generate(prompt, expect_json=True)
    try:
        return json.loads(raw)
    except Exception:
        return {
            "title": f"Mission Intelligence Report",
            "executive_summary": "Analysis complete.",
            "key_metrics": {"vegetation_change_pct": 0, "urban_expansion_pct": 0, "water_change_pct": 0, "overall_risk_score": 50},
            "sections": [],
            "compliance_assessment": [],
            "recommendations": [],
            "confidence_note": "Final review pending.",
        }
