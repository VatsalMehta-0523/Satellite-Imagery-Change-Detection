"""
Change Detection Pipeline
Uses ChangeFormer model via png_inference.py
"""
import os
import cv2
import numpy as np
import logging
from PIL import Image
from app.core.config import CHANGE_DETECTION_DIR, DATA_DIR
from app.utils.subprocess import safe_run_subprocess
from app.core.logger import get_logger

logger = get_logger("app.pipelines.changeformer")

def calculate_geospatial_stats(mask_path: str, resolution: float = 1.0) -> dict:
    """
    Compute geospatial stats from binary mask.
    Resolution: pixel width in meters (e.g., 10 for Sentinel-2, 4 for Planet).
    Uses OpenCV for robust white-pixel frequency counting.
    """
    try:
        # Load mask in grayscale
        mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
        if mask is None:
            raise FileNotFoundError(f"Could not read mask at {mask_path}")
            
        # Threshold to ensure binary (0 or 255)
        _, thresh = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        
        # Count white pixels (non-zero)
        changed_pixels = cv2.countNonZero(thresh)
        total_pixels = thresh.size
        
        if total_pixels == 0:
            return {
                "change_percentage": 0.0,
                "area_m2": 0.0,
                "area_km2": 0.0,
                "area_hectares": 0.0
            }
            
        change_pct = (float(changed_pixels) / total_pixels) * 100
        area_m2 = float(changed_pixels) * (resolution ** 2)
        area_km2 = area_m2 / 1_000_000
        area_hectares = area_m2 / 10_000
        
        return {
            "change_percentage": round(change_pct, 2),
            "area_m2": round(area_m2, 2),
            "area_km2": round(area_km2, 4),
            "area_hectares": round(area_hectares, 4)
        }
    except Exception as e:
        logger.error(f"Failed to calculate geospatial stats: {e}")
        return {
            "change_percentage": 0.0,
            "area_m2": 0.0,
            "area_km2": 0.0,
            "area_hectares": 0.0
        }

import sys

async def run_change_detection(
    t1_png: str,
    t2_png: str,
    output_dir: str,
    resolution: float = 1.0,
    on_log=None
) -> dict:
    """
    Run ChangeFormer inference using the currently active python interpreter.
    """
    os.makedirs(output_dir, exist_ok=True)
    mask_path = os.path.join(output_dir, "change_mask.png")
    inference_script = "png_inference.py"

    # Check for model weights
    ckpt_path = os.path.join(CHANGE_DETECTION_DIR, "checkpoints", "best_ckpt.pt")
    if not os.path.exists(ckpt_path):
        msg = f">>> [SYSTEM] CRITICAL: ChangeFormer weights missing at {ckpt_path}"
        logger.error(msg)
        if on_log: on_log(msg)
    
    # Use the configured external Python interpreter for the ML model
    from app.core.config import CHANGEFORMER_PYTHON_PATH
    python_exe = os.path.normpath(CHANGEFORMER_PYTHON_PATH)
    
    # Verify weights
    ckpt_abs = os.path.abspath(ckpt_path)
    if not os.path.exists(ckpt_abs):
        logger.error(f">>> [SYSTEM] CRITICAL: Weights missing at {ckpt_abs}")
        if on_log: on_log(f"CRITICAL ERROR: weights not found at {ckpt_abs}")
        return {"mask_path": "", "stats": {}}

    cmd = [python_exe, inference_script, "--t1", os.path.abspath(t1_png), "--t2", os.path.abspath(t2_png), "--out", os.path.abspath(mask_path), "--ckpt", ckpt_abs]
    
    msg = f">>> [MISSION] Triggering Neural Inference Bridge..."
    logger.info(msg)
    logger.info(f">>> [COMMAND] {' '.join(cmd)}")
    if on_log: on_log(msg)

    success = await safe_run_subprocess(cmd, on_log=on_log, cwd=CHANGE_DETECTION_DIR)

    if not success:
        msg = ">>> [MISSION] ChangeFormer Subprocess Failed."
        logger.info(msg)
        if on_log: on_log(msg)
        return {"mask_path": "", "stats": {}}

    if not os.path.exists(mask_path):
        msg = ">>> [MISSION] ChangeFormer finished but NO MASK was generated."
        logger.info(msg)
        if on_log: on_log(msg)
        return {"mask_path": "", "stats": {}}

    stats = calculate_geospatial_stats(mask_path, resolution)
    msg = f">>> [MISSION] Change Detection Complete. Mask produced with {stats['change_percentage']}% change."
    print(msg)
    if on_log: on_log(msg)
    return {"mask_path": mask_path, "stats": stats}
