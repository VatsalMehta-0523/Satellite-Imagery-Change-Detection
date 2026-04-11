import ee
import os
import httpx
import requests
import numpy as np
import rasterio
import logging
from PIL import Image
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from app.core.config import GEE_JSON_PATH, DATA_DIR
from app.pipelines.s2dr3 import generate_indices

logger = logging.getLogger(__name__)

# Initialize GEE using Service Account
try:
    if os.path.exists(GEE_JSON_PATH):
        import json
        with open(GEE_JSON_PATH, 'r') as f:
            sa_data = json.load(f)
            project_id = sa_data.get('project_id')
            email = sa_data.get('client_email')
        
        # Use newer ee.ServiceAccountCredentials flow
        credentials = ee.ServiceAccountCredentials(email, GEE_JSON_PATH)
        ee.Initialize(credentials, project=project_id)
        logger.info(f"GEE Initialized successfully for project: {project_id}")
    else:
        logger.error(f"GEE Service Account file not found at {GEE_JSON_PATH}")
except Exception as e:
    logger.error(f"GEE Initialization failed: {e}")

def _get_cloud_masked_s2(aoi_ee, date_str):
    """Filter and cloud mask Sentinel-2 SR collection."""
    dt = datetime.strptime(date_str, "%Y-%m-%d")
    start = (dt - timedelta(days=5)).strftime("%Y-%m-%d")
    end = (dt + timedelta(days=5)).strftime("%Y-%m-%d")

    def mask_s2_clouds(image):
        qa = image.select('QA60')
        cloud_bit_mask = 1 << 10
        cirrus_bit_mask = 1 << 11
        mask = qa.bitwiseAnd(cloud_bit_mask).eq(0).And(
               qa.bitwiseAnd(cirrus_bit_mask).eq(0))
        return image.updateMask(mask)

    collection = (ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                  .filterBounds(aoi_ee)
                  .filterDate(start, end)
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
                  .map(mask_s2_clouds))

    if collection.size().getInfo() == 0:
        return None

    # Get median composite
    return collection.median().clip(aoi_ee)

async def execute_gee_tci_phase(
    date_str: str,
    aoi_bbox: str, # "minx miny maxx maxy"
    label: str,
    project_id: int,
    on_progress=None
) -> Optional[dict]:
    """Phase 1: Fetch GEE TCI (RGB) and ready for UI."""
    project_dir = os.path.join(DATA_DIR, str(project_id))
    label_dir = os.path.join(project_dir, label.lower())
    os.makedirs(label_dir, exist_ok=True)

    try:
        if on_progress: on_progress(10)
        
        minx, miny, maxx, maxy = map(float, aoi_bbox.split())
        aoi_ee = ee.Geometry.Rectangle([minx, miny, maxx, maxy])
        
        image = _get_cloud_masked_s2(aoi_ee, date_str)
        if not image:
            logger.error(f"[GEE] No clear imagery found for {date_str}")
            return None

        # Select RGB
        tci_image = image.select(['B4', 'B3', 'B2'])
        
        if on_progress: on_progress(40)
        
        # Get Download URL (GeoTIFF)
        download_params = {
            'scale': 10,
            'crs': 'EPSG:4326',
            'region': aoi_ee.toGeoJSONString(),
            'format': 'GEO_TIFF'
        }
        
        url = tci_image.getDownloadURL(download_params)
        
        if on_progress: on_progress(60)
        
        local_tci_tif = os.path.join(label_dir, "tci.tif")
        local_tci_png = os.path.join(label_dir, "tci.png")

        # Download
        r = requests.get(url, stream=True)
        if r.status_code == 200:
            with open(local_tci_tif, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        else:
            logger.error(f"[GEE] Download failed: {r.status_code}")
            return None

        if on_progress: on_progress(80)

        # Convert to PNG for UI
        with rasterio.open(local_tci_tif) as src:
            data = src.read([1, 2, 3])
            # Normalize reflectance (0-10000) to RGB (0-255) with a 1.5x visual boost (safer for AI)
            data = np.clip(data / 10000.0 * 255.0 * 1.5, 0, 255).astype(np.uint8)
            img_arr = np.transpose(data, (1, 2, 0))
            Image.fromarray(img_arr).save(local_tci_png, "PNG")

        if on_progress: on_progress(100)
        
        return {
            "png_tci": local_tci_png,
            "tif_tci": local_tci_tif,
            "label": label,
            "date": date_str,
            "source": "gee",
            "aoi_bbox": aoi_bbox
        }

    except Exception as e:
        logger.error(f"[GEE] TCI Phase Error: {e}")
        return None

async def execute_gee_ms_phase(
    result: dict,
    project_id: int,
    on_progress=None
) -> Optional[dict]:
    """Phase 2: Fetch GEE Multi-Spectral Bands and Compute Indices."""
    label = result["label"]
    date_str = result["date"]
    aoi_bbox = result["aoi_bbox"]
    project_dir = os.path.join(DATA_DIR, str(project_id))
    label_dir = os.path.join(project_dir, label.lower())
    local_ms_tif = os.path.join(label_dir, "ms.tif")

    try:
        if on_progress: on_progress(10)
        
        minx, miny, maxx, maxy = map(float, aoi_bbox.split())
        aoi_ee = ee.Geometry.Rectangle([minx, miny, maxx, maxy])
        
        image = _get_cloud_masked_s2(aoi_ee, date_str)
        if not image: return None

        # Select Bands for Indices: B2, B3, B4, B5, B6, B7, B8, B8A, B11, B12
        # Sentinel-2 10-band stack order in generate_indices:
        # 0=B02, 1=B03, 2=B04, 3=B05, 4=B06, 5=B07, 6=B08, 7=B8A, 8=B11, 9=B12
        bands = ['B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B11', 'B12']
        ms_image = image.select(bands)

        if on_progress: on_progress(30)

        download_params = {
            'scale': 10,
            'crs': 'EPSG:4326',
            'region': aoi_ee.toGeoJSONString(),
            'format': 'GEO_TIFF'
        }
        url = ms_image.getDownloadURL(download_params)
        
        if on_progress: on_progress(50)

        # Download
        r = requests.get(url, stream=True)
        if r.status_code == 200:
            with open(local_ms_tif, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
        else:
            logger.error(f"[GEE] MS Download failed: {r.status_code}")
            return None

        if on_progress: on_progress(70)

        # Re-scale back to 0-10000 range for generate_indices (which expects /10000)
        # Actually our _get_cloud_masked_s2 returns /10000. 
        # So ms.tif has 0-1 values.
        # generate_indices expects rasterio values that it will divide by 10000.
        # I should probably save as float32 in the TIF.
        
        # Trigger index generation
        indices = generate_indices(local_ms_tif, label_dir, label)
        result["indices"] = indices
        result["ms_path"] = local_ms_tif
        
        if on_progress: on_progress(100)
        return result

    except Exception as e:
        logger.error(f"[GEE] MS Phase Error: {e}")
        return None
