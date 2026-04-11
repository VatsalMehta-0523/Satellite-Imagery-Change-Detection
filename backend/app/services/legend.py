"""
Spectral Index Metadata & Legend Definitions
Provided by User for professional geospatial visualization
"""

INDEX_LEGEND = {
    "NDVI": {
        "full_name"  : "Normalized Difference Vegetation Index",
        "formula"    : "(B08 - B04) / (B08 + B04)",
        "cmap"       : "RdYlGn",
        "range"      : (-1.0, 1.0),
        "description": "Measures live green vegetation. High values = dense canopy; low/negative = bare soil, urban or water.",
        "bands_used" : ["B08 (NIR)", "B04 (Red)"],
        "stops": [
            (-1.0, "#A50026", "Water / Deep Shadow"),
            (-0.1, "#F88E52", "Bare soil / Rock"),
            ( 0.0, "#FEFEBD", "Sparse dry vegetation / Urban"),
            ( 0.3, "#84CA66", "Moderate vegetation"),
            ( 1.0, "#006837", "Dense green canopy"),
        ],
        "ui_note": "Threshold ~0.2 separates vegetation from non-vegetation.",
    },
    "NDBI": {
        "full_name"  : "Normalized Difference Built-up Index",
        "formula"    : "(B11 - B08) / (B11 + B08)",
        "cmap"       : "YlOrRd",
        "range"      : (-1.0, 1.0),
        "description": "Highlights impervious surfaces (roads, buildings). Positive = urban; negative = vegetation/water.",
        "bands_used" : ["B11 (SWIR1)", "B08 (NIR)"],
        "stops": [
            (-1.0, "#FFFFCC", "Water / Dense vegetation"),
            ( 0.0, "#FC8C3B", "Mixed / Transitional"),
            ( 0.5, "#E2191C", "Dense built-up"),
            ( 1.0, "#800026", "High-intensity urban / Bare rock"),
        ],
        "ui_note": "Bright red = high urban density.",
    },
    "NDWI": {
        "full_name"  : "Normalized Difference Water Index",
        "formula"    : "(B03 - B08) / (B03 + B08)",
        "cmap"       : "Blues",
        "range"      : (-1.0, 1.0),
        "description": "McFeeters (1996). Detects open water bodies. Positive = water; negative = land.",
        "bands_used" : ["B03 (Green)", "B08 (NIR)"],
        "stops": [
            (-1.0, "#F7FBFF", "Dry land / Urban"),
            ( 0.0, "#6AADD5", "Moist soil / Wetland margin"),
            ( 1.0, "#08306B", "Open water (lake / river)"),
        ],
        "ui_note": "Threshold 0.0 is the standard water/land boundary.",
    },
    "MNDWI": {
        "full_name"  : "Modified Normalized Difference Water Index",
        "formula"    : "(B03 - B11) / (B03 + B11)",
        "cmap"       : "GnBu",
        "range"      : (-1.0, 1.0),
        "description": "Xu (2006). SWIR better suppresses built-up signal than NIR.",
        "bands_used" : ["B03 (Green)", "B11 (SWIR1)"],
        "stops": [
            (-1.0, "#F7FCF0", "Bare soil / Built-up"),
            ( 0.0, "#7ACBC4", "Vegetation / Moist surface"),
            ( 1.0, "#084081", "Clear open water"),
        ],
        "ui_note": "Prefer MNDWI over NDWI in urban scenes.",
    },
    "BSI": {
        "full_name"  : "Bare Soil Index",
        "formula"    : "((B11 + B04) - (B08 + B02)) / ((B11 + B04) + (B08 + B02))",
        "cmap"       : "BrBG_r",
        "range"      : (-1.0, 1.0),
        "description": "Highlights exposed/bare soil. High positive = bare/dry soil; negative = vegetation-covered.",
        "bands_used" : ["B11 (SWIR1)", "B04 (Red)", "B08 (NIR)", "B02 (Blue)"],
        "stops": [
            (-1.0, "#003C30", "Dense vegetation"),
            ( 0.0, "#F5F4F4", "Mixed / Transitional"),
            ( 0.5, "#CE9F52", "Dry / Partially bare soil"),
            ( 1.0, "#543005", "Exposed bare soil / Fallow land"),
        ],
        "ui_note": "Brown tones = bare/degraded land. Teal/green = vegetated.",
    },
    "EVI": {
        "full_name"  : "Enhanced Vegetation Index",
        "formula"    : "2.5 × (B08 - B04) / (B08 + 6×B04 - 7.5×B02 + 1)",
        "cmap"       : "RdYlGn",
        "range"      : (-1.0, 1.0),
        "description": "NASA formula. Reduces atmospheric influences and background noise.",
        "bands_used" : ["B08 (NIR)", "B04 (Red)", "B02 (Blue)"],
        "stops": [
            (-0.5, "#A50026", "Non-vegetated / Urban / Water"),
            ( 0.0, "#FEFEBD", "Sparse / Stressed vegetation"),
            ( 0.3, "#84CA66", "Moderate healthy vegetation"),
            ( 1.0, "#006837", "Dense lush canopy"),
        ],
        "ui_note": "Less saturated than NDVI in dense canopy.",
    },
}
