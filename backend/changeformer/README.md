# Change Detection Model Pipeline (ChangeFormer)

This repository contains a production-ready inference pipeline for detect building and structural changes using the ChangeFormer (Transformer-based Siamese Network) model.

## 📂 Project Structure

- **checkpoints/**: Contains the `best_ckpt.pt` model weights.
- **models/**: The core neural network architecture and model definitions.
- **misc/**: Image processing and logging utilities.
- **inference_engine.py**: The central engine that handles tiling, normalization, and Sentinel-2 band mapping.
- **inference.py**: Command-line tool for single-pair or batch inference on directories.
- **png_inference.py**: Quick visualization script to compare two PNGs in a side-by-side plot.
- **my_requirements.txt**: List of all Python dependencies for the pipeline.
- **launch_viewer.py**: Optional script to launch a local server for interactive comparison.

## 🚀 Setup Instructions

1. **Create a Virtual Environment** (Recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install Dependencies**:
   ```bash
   pip install -r my_requirements.txt
   ```

## 🛠️ How to Use

### 1. Simple Visual Comparison (PNG)
Open `png_inference.py`, update the `T1_PATH` and `T2_PATH` variables at the top, then run:
```bash
python png_inference.py
```

### 2. Standard Inference (GeoTIFF / Single Pair)
To generate a binary change mask for two satellite scenes:
```bash
python inference.py --t1 image_2018.tif --t2 image_2026.tif --out mask.png --bands 3,2,1
```

### 3. Batch Mode
To process entire folders of images (arranged in `A/` and `B/` subfolders):
```bash
python inference.py --input_dir path/to/dataset --out_dir outputs
```

## 📋 Compatibility Notes
- This system is optimized for **Sentinel-2 L2A** imagery but works with any RGB source.
- Built for **PyTorch 2.6+** compatibility.
- Uses **Tiled Inference** to preserve spatial resolution in large satellite scenes.
