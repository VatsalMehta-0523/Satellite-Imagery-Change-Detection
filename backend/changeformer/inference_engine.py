import os
import torch
import numpy as np
import cv2
from PIL import Image
import tifffile
from tqdm import tqdm

from models.basic_model import CDEvaluator
from misc.imutils import save_image

class InferenceEngine:
    def __init__(self, checkpoint_path, model_name='ChangeFormerV6', embed_dim=256, device=None):
        """
        Initialize the Inference Engine.
        """
        self.device = device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        print(f"Initializing InferenceEngine on {self.device}...")
        
        # Initialize the model wrapper
        self.evaluator = CDEvaluator(
            net_G=model_name,
            embed_dim=embed_dim,
            gpu_ids=[0] if self.device == "cuda" else [],
            checkpoint_dir=os.path.dirname(checkpoint_path)
        )
        
        # Load the checkpoint
        self.evaluator.load_checkpoint(checkpoint_path)
        self.evaluator.eval()

    def _load_geotiff(self, path, bands=[0, 1, 2]):
        """
        Robustly load a GeoTIFF/PNG and extract specific bands (0-indexed).
        For ChangeFormer V6, we strictly use RGB (bands 0,1,2 for PNG).
        """
        try:
            arr = tifffile.imread(path)
        except Exception:
            img = Image.open(path)
            arr = np.array(img)

        # Handle dimensions (H, W, C) vs (C, H, W)
        if arr.ndim == 3 and arr.shape[0] < arr.shape[1] and arr.shape[0] < arr.shape[2]:
            arr = arr.transpose(1, 2, 0)
        
        # Select bands and drop alpha if present
        if arr.ndim == 3:
            max_idx = arr.shape[2] - 1
            safe_bands = [min(b, max_idx) for b in bands]
            arr = arr[:, :, safe_bands]
        elif arr.ndim == 2:
            arr = np.stack([arr, arr, arr], axis=-1)

        # Normalization to [0, 1]
        if arr.dtype == np.uint16:
            arr = arr.astype(np.float32) / 65535.0
        elif arr.dtype == np.uint8:
            arr = arr.astype(np.float32) / 255.0
        else:
            arr = arr.astype(np.float32)
            if arr.max() > 1.0: arr /= arr.max()

        return arr

    def _preprocess_patch(self, patch):
        """
        Preprocess a single patch for the ChangeFormer V6 model.
        Uses standard ImageNet normalization: mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]
        """
        # Resize to 256x256 using OpenCV if needed
        if patch.shape[0] != 256 or patch.shape[1] != 256:
            patch = cv2.resize(patch, (256, 256), interpolation=cv2.INTER_LINEAR)

        # ImageNet Normalization
        mean = np.array([0.485, 0.456, 0.406])
        std = np.array([0.229, 0.224, 0.225])
        patch = (patch - mean) / std
        
        # Convert to Tensor (B, C, H, W)
        tensor = torch.from_numpy(patch).permute(2, 0, 1).unsqueeze(0).to(self.device).float()
        return tensor

    def predict_tiled(self, t1_path, t2_path, bands=[0, 1, 2], patch_size=256, stride=224):
        """
        Run inference. Uses a small overlap (stride < patch_size) for smoother edges.
        """
        img1 = self._load_geotiff(t1_path, bands=bands)
        img2 = self._load_geotiff(t2_path, bands=bands)

        h, w, _ = img1.shape
        full_mask = np.zeros((h, w), dtype=np.uint8)
        
        # --- SPECIAL CASE: SMALL IMAGE ---
        if h < patch_size or w < patch_size:
            print(f"Small image detected ({h}x{w}). Resizing to {patch_size} for optimal CD inference.")
            t1 = self._preprocess_patch(img1)
            t2 = self._preprocess_patch(img2)
            
            # Diagnostic
            print(f"Patch Meta -> T1: [min:{t1.min():.2f}, max:{t1.max():.2f}, mean:{t1.mean():.2f}]")

            with torch.no_grad():
                output = self.evaluator.net_G(t1, t2)
                pred = output[-1] if isinstance(output, (list, tuple)) else output
                pred = torch.argmax(pred, dim=1).squeeze().cpu().numpy().astype(np.uint8)
            
            # Debug change count
            changed_pixels = np.sum(pred == 1)
            print(f"Detected {changed_pixels} changed pixels in resized mask.")
            
            full_mask = cv2.resize(pred * 255, (w, h), interpolation=cv2.INTER_NEAREST)
            return full_mask

        # --- STANDARD CASE: TILED INFERENCE ---
        print(f"Running tiled inference on {h}x{w} image with stride {stride}...")
        with torch.no_grad():
            for y in tqdm(range(0, h, stride)):
                curr_y = y
                if curr_y + patch_size > h: curr_y = max(0, h - patch_size)
                
                for x in range(0, w, stride):
                    curr_x = x
                    if curr_x + patch_size > w: curr_x = max(0, w - patch_size)
                    
                    y_end = curr_y + patch_size
                    x_end = curr_x + patch_size
                    
                    p1 = img1[curr_y:y_end, curr_x:x_end, :]
                    p2 = img2[curr_y:y_end, curr_x:x_end, :]
                    
                    t1 = self._preprocess_patch(p1)
                    t2 = self._preprocess_patch(p2)

                    if x == 0 and y == 0:
                        print(f"Tile Meta -> T1: [min:{t1.min():.2f}, max:{t1.max():.2f}, mean:{t1.mean():.2f}]")

                    output = self.evaluator.net_G(t1, t2)
                    pred = output[-1] if isinstance(output, (list, tuple)) else output
                    pred = torch.argmax(pred, dim=1).squeeze().cpu().numpy()
                    
                    # Track changes in this tile
                    tile_changes = np.sum(pred == 1)
                    if tile_changes > 0:
                        print(f"Tile at ({curr_x}, {curr_y}): {tile_changes} change pixels.")

                    # Use argmax classes (0, 1) and scale to 255 for mask saving
                    full_mask[curr_y:y_end, curr_x:x_end] = np.maximum(full_mask[curr_y:y_end, curr_x:x_end], (pred * 255).astype(np.uint8))

        return full_mask

    def save_mask(self, mask, output_path):
        """
        Save the resulting binary mask.
        """
        save_image(mask, output_path)
        print(f"Mask saved to: {output_path}")

if __name__ == "__main__":
    # Internal test check
    print("InferenceEngine script loaded.")
