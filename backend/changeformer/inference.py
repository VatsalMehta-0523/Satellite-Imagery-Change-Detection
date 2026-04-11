import argparse
import os
import glob
from inference_engine import InferenceEngine

def get_args():
    parser = argparse.ArgumentParser(description="ChangeFormer Robust Inference Pipeline")
    
    # Input options
    parser.add_argument("--t1", type=str, help="Path to Time 1 image (GeoTIFF/JPG/PNG)")
    parser.add_argument("--t2", type=str, help="Path to Time 2 image (GeoTIFF/JPG/PNG)")
    parser.add_argument("--input_dir", type=str, help="Batch mode: Directory containing images in A/ and B/ subfolders")
    
    # Output options
    parser.add_argument("--out", type=str, default="output_mask.png", help="Path to save output mask (Single mode)")
    parser.add_argument("--out_dir", type=str, default="predictions", help="Directory to save output masks (Batch mode)")
    
    # Model options
    parser.add_argument("--checkpoint", type=str, default="checkpoints/best_ckpt.pt", help="Path to model checkpoint")
    parser.add_argument("--model_name", type=str, default="ChangeFormerV6", help="ChangeFormer model version")
    parser.add_argument("--embed_dim", type=int, default=256, help="Embedding dimension")
    
    # Preprocessing options
    parser.add_argument("--bands", type=str, default="3,2,1", help="Band indices (0-indexed) for Sentinel-2 RGB (default: 3,2,1 for B4,B3,B2)")
    parser.add_argument("--stride", type=int, default=256, help="Stride for tiled inference (default: 256 for no overlap)")
    
    return parser.parse_args()

def run_single(engine, args):
    if not args.t1 or not args.t2:
        print("Error: Single mode requires both --t1 and --t2")
        return

    bands = [int(b) for b in args.bands.split(",")]
    mask = engine.predict_tiled(args.t1, args.t2, bands=bands, stride=args.stride)
    engine.save_mask(mask, args.out)

def run_batch(engine, args):
    if not os.path.exists(args.input_dir):
        print(f"Error: Input directory {args.input_dir} not found")
        return

    # Look for standard A/ and B/ structure
    a_dir = os.path.join(args.input_dir, "A")
    b_dir = os.path.join(args.input_dir, "B")
    
    if not os.path.exists(a_dir) or not os.path.exists(b_dir):
        print(f"Error: Batch mode expects {args.input_dir}/A and {args.input_dir}/B subfolders")
        return

    os.makedirs(args.out_dir, exist_ok=True)
    
    # Get common images
    a_files = sorted(os.listdir(a_dir))
    bands = [int(b) for b in args.bands.split(",")]

    print(f"Found {len(a_files)} image pairs. Starting batch inference...")
    
    for filename in a_files:
        if filename.endswith(('.tif', '.tiff', '.png', '.jpg', '.jpeg')):
            t1_path = os.path.join(a_dir, filename)
            t2_path = os.path.join(b_dir, filename)
            
            if not os.path.exists(t2_path):
                print(f"Warning: Corresponding image for {filename} not found in {b_dir}. Skipping.")
                continue
                
            print(f"\nProcessing {filename}...")
            out_path = os.path.join(args.out_dir, os.path.splitext(filename)[0] + "_mask.png")
            
            mask = engine.predict_tiled(t1_path, t2_path, bands=bands, stride=args.stride)
            engine.save_mask(mask, out_path)

if __name__ == "__main__":
    args = get_args()
    
    # Initialize Engine
    engine = InferenceEngine(
        checkpoint_path=args.checkpoint,
        model_name=args.model_name,
        embed_dim=args.embed_dim
    )
    
    if args.input_dir:
        run_batch(engine, args)
    else:
        run_single(engine, args)
    
    print("\nInference complete!")
