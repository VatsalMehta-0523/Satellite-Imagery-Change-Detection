import argparse
import os
import matplotlib.pyplot as plt
from PIL import Image
import numpy as np
from inference_engine import InferenceEngine

def run_visual_inference(t1_path, t2_path, out_path, checkpoint="checkpoints/best_ckpt.pt", model_name="ChangeFormerV6"):
    if not os.path.exists(t1_path) or not os.path.exists(t2_path):
        print(f"Error: One or both input paths don't exist: {t1_path}, {t2_path}")
        return

    # Initialize Engine
    engine = InferenceEngine(checkpoint_path=checkpoint, model_name=model_name)

    # Run Inference
    mask = engine.predict_tiled(t1_path, t2_path, bands=[0, 1, 2])

    # Save mask to the requested path
    if isinstance(mask, np.ndarray):
        mask_img = Image.fromarray(mask.astype(np.uint8))
        mask_img.save(out_path)
    else:
        mask.save(out_path)

    print(f"[SUCCESS] Change mask saved to: {out_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ChangeFormer PNG Inference")
    parser.add_argument("--t1", required=True, help="Path to T1 PNG")
    parser.add_argument("--t2", required=True, help="Path to T2 PNG")
    parser.add_argument("--out", required=True, help="Path to output mask PNG")
    parser.add_argument("--ckpt", default="checkpoints/best_ckpt.pt", help="Path to model checkpoint")
    parser.add_argument("--model", default="ChangeFormerV6", help="Model name")
    
    args = parser.parse_args()
    run_visual_inference(args.t1, args.t2, args.out, args.ckpt, args.model)
