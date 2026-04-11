import os
import sys
import numpy as np
from PIL import Image

# Ensure local imports work
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from inference_engine import InferenceEngine
    print(">>> [DEMO] Successfully imported InferenceEngine")
except ImportError as e:
    print(f">>> [DEMO] FAILED to import InferenceEngine: {e}")
    sys.exit(1)

def run_test():
    t1 = "South_bopal_1_2018_TCI_try.png"
    t2 = "South_bopal_1_2026_TCI_try.png"
    out = "demo_mask.png"
    ckpt = "checkpoints/best_ckpt.pt"

    if not os.path.exists(t1) or not os.path.exists(t2):
        print(">>> [DEMO] Error: Input images missing in current directory.")
        return

    print(f">>> [DEMO] Running inference on {t1} vs {t2}...")
    try:
        engine = InferenceEngine(checkpoint_path=ckpt)
        # Using a small patch for speed if testing, but the user wants actual verification
        mask = engine.predict_tiled(t1, t2, bands=[0, 1, 2])
        
        # Save output
        if isinstance(mask, np.ndarray):
            mask_img = Image.fromarray(mask.astype(np.uint8))
            mask_img.save(out)
        else:
            mask.save(out)
            
        print(f">>> [DEMO] SUCCESS! Mask saved to {out}")
        
        # Compute confidence
        changed = np.sum(mask > 127)
        confidence = float(changed) / mask.size
        print(f">>> [DEMO] Detected change: {confidence*100:.2f}%")
        
    except Exception as e:
        print(f">>> [DEMO] CRITICAL FAILURE: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_test()
