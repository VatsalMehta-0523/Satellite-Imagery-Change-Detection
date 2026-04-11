"""
Change Detection Pipeline
Uses ChangeFormer model via png_inference.py
"""
import os
import numpy as np
import logging
from PIL import Image
from app.core.config import CHANGE_DETECTION_DIR, DATA_DIR
from app.utils.subprocess import safe_run_subprocess

logger = logging.getLogger(__name__)

def get_confidence(mask_path: str) -> float:
    """Compute confidence as % of changed pixels in mask."""
    try:
        img = Image.open(mask_path).convert("L")
        arr = np.array(img)
        changed = np.sum(arr > 127)
        total = arr.size
        if total == 0:
            return 0.0
        return round(float(changed) / total, 4)
    except Exception:
        return 0.0

import sys

async def run_change_detection(
    t1_png: str,
    t2_png: str,
    output_dir: str,
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
        print(msg)
        if on_log: on_log(msg)
    
    # Use the currently running Python interpreter directly
    python_exe = sys.executable
    cmd = [python_exe, inference_script, "--t1", os.path.abspath(t1_png), "--t2", os.path.abspath(t2_png), "--out", os.path.abspath(mask_path), "--ckpt", os.path.abspath(ckpt_path)]
    
    msg = f">>> [MISSION] Triggering ChangeFormer: {' '.join(cmd)}"
    print(msg)
    if on_log: on_log(msg)

    success = await safe_run_subprocess(cmd, on_log=on_log, cwd=CHANGE_DETECTION_DIR)

    if not success:
        msg = ">>> [MISSION] ChangeFormer Subprocess Failed."
        print(msg)
        if on_log: on_log(msg)
        return {"mask_path": "", "confidence": 0.0}

    if not os.path.exists(mask_path):
        msg = ">>> [MISSION] ChangeFormer finished but NO MASK was generated."
        print(msg)
        if on_log: on_log(msg)
        return {"mask_path": "", "confidence": 0.0}

    confidence = get_confidence(mask_path)
    msg = f">>> [MISSION] Change Detection Complete. Mask produced with {confidence*100:.2f}% change."
    print(msg)
    if on_log: on_log(msg)
    return {"mask_path": mask_path, "confidence": confidence}
