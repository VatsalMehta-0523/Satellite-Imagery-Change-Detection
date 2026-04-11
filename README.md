# GeoVision — AI-Powered Satellite Change Detection SaaS

A modular SaaS platform for satellite imagery acquisition, deep learning change detection, spectral index validation, compliance management, and AI-generated geospatial intelligence reports.

---

## 📁 Project Structure

```
satellite-saas/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry point
│   │   ├── api/
│   │   │   ├── fetch.py             # Satellite image fetch endpoints
│   │   │   ├── change_detection.py  # ChangeFormer inference endpoints
│   │   │   ├── indices.py           # Spectral index endpoints
│   │   │   ├── compliance.py        # Compliance rule CRUD
│   │   │   ├── insights.py          # LLM report generation
│   │   │   └── projects.py          # Project listing
│   │   ├── core/
│   │   │   ├── config.py            # Environment config
│   │   │   └── database.py          # asyncpg pool + table creation
│   │   ├── pipelines/
│   │   │   ├── s2dr3.py             # S2DR3 satellite fetch pipeline
│   │   │   └── changeformer.py      # ChangeFormer inference wrapper
│   │   └── services/
│   │       └── llm.py               # Gemini API integration
│   ├── data/                        # Auto-created: stores all images
│   │   └── {project_id}/
│   │       ├── t1/
│   │       │   ├── tci.png
│   │       │   ├── t1_NDVI.png
│   │       │   └── ...
│   │       ├── t2/
│   │       │   └── ...
│   │       └── change/
│   │           └── change_mask.png
│   ├── changeformer/                # ← PLACE YOUR MODEL FOLDER HERE
│   │   ├── png_inference.py
│   │   ├── inference_engine.py
│   │   ├── models/
│   │   ├── checkpoints/
│   │   │   └── best_ckpt.pt
│   │   ├── misc/
│   │   └── venv/                    # model's own venv (optional)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── App.js
│   │   ├── index.js
│   │   ├── styles/
│   │   │   └── globals.css
│   │   ├── utils/
│   │   │   ├── api.js               # Axios API client
│   │   │   └── leaflet-shim.js
│   │   └── components/
│   │       ├── sidebar/
│   │       │   └── Sidebar.js
│   │       ├── shared/
│   │       │   ├── Header.js
│   │       │   └── DrawControl.js   # Leaflet-draw wrapper
│   │       └── pages/
│   │           ├── FetchPage.js
│   │           ├── OverviewPage.js
│   │           ├── ChangeDetectionPage.js
│   │           ├── IndexValidationPage.js
│   │           ├── CompliancePage.js
│   │           └── InsightsPage.js
│   └── package.json
├── scripts/
│   └── init_db.sql                  # PostgreSQL schema
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- `gcloud` CLI authenticated (for S2DR3 GCS downloads)

---

## 1. Database Setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE satellite_saas;"

# Run schema
psql -U postgres -d satellite_saas -f scripts/init_db.sql
```

---

## 2. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/satellite_saas
GEMINI_API_KEY=your_gemini_api_key_here
S2DR3_BASE_URL=https://s2dr3-job-20250428-862134799361.europe-west1.run.app
S2DR3_USER_ID=32459320
DATA_DIR=data
CHANGE_DETECTION_DIR=changeformer
```

```bash
# Start the backend
uvicorn app.main:app --reload --port 8000
```

Backend will be available at: `http://localhost:8000`
API docs at: `http://localhost:8000/docs`

---

## 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start the dev server
npm start
```

Frontend will be available at: `http://localhost:3000`

The `proxy` field in `package.json` automatically forwards `/api` requests to the backend at port 8000.

---

## 4. ChangeFormer Model Setup

The ChangeFormer model folder must be placed at:

```
backend/changeformer/
```

This folder (from your provided zip) should have the following structure:

```
backend/changeformer/
├── png_inference.py          ← REQUIRED (called by the backend)
├── inference_engine.py
├── inference.py
├── models/
├── checkpoints/
│   └── best_ckpt.pt          ← model weights
├── misc/
├── my_requirements.txt
└── venv/                     ← optional: model's own venv
    └── bin/python             (Linux/Mac)
    └── Scripts/python.exe     (Windows)
```

### How the model is invoked

The backend calls `png_inference.py` from inside the `changeformer/` directory:

```bash
python png_inference.py --t1 /path/to/t1.png --t2 /path/to/t2.png --out /path/to/mask.png
```

Make sure `png_inference.py` accepts `--t1`, `--t2`, and `--out` arguments. If your script uses different argument names, update `backend/app/pipelines/changeformer.py` accordingly.

### Model venv

If your ChangeFormer model has its own venv (as recommended in the README):

```bash
cd backend/changeformer
python -m venv venv
source venv/bin/activate
pip install -r my_requirements.txt
```

The backend auto-detects and uses `changeformer/venv/bin/python` if present.

---

## 5. S2DR3 Pipeline

The S2DR3 pipeline is integrated directly into `backend/app/pipelines/s2dr3.py`.

It uses the same logic as `s2dr_legend_info_pipeline.py` but accepts AOI and dates from user input (not hardcoded).

### Requirements

- `gcloud` CLI must be installed and authenticated
- Your GCP project must have access to the GCS buckets used by S2DR3

```bash
# Authenticate gcloud
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### Flow

1. User draws AOI polygon on map → GeoJSON coordinates sent to backend
2. Backend converts polygon to bbox string: `minLon minLat maxLon maxLat`
3. Two parallel jobs submitted to S2DR3 API (T1 and T2)
4. Each job polls until complete, then downloads TCI immediately (reactive)
5. PNG preview shown in UI as soon as each TCI is ready
6. MS band data downloaded next → 6 spectral indices computed

---

## 6. Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/satellite_saas` |
| `GEMINI_API_KEY` | Google Gemini API key | _(required for AI features)_ |
| `S2DR3_BASE_URL` | S2DR3 service URL | _(from pipeline config)_ |
| `S2DR3_USER_ID` | S2DR3 user ID | `32459320` |
| `DATA_DIR` | Directory for storing processed images | `data` |
| `CHANGE_DETECTION_DIR` | Path to ChangeFormer folder | `changeformer` |

---

## 7. API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/fetch/context` | Get LLM context for AOI |
| `POST` | `/api/fetch/start` | Start parallel image fetch |
| `GET` | `/api/fetch/status/{project_id}` | Poll fetch progress |
| `GET` | `/api/fetch/project/{project_id}` | Get full project data |
| `POST` | `/api/change-detection/run` | Run ChangeFormer model |
| `GET` | `/api/change-detection/result/{project_id}` | Get detection result |
| `GET` | `/api/indices/{project_id}` | Get spectral indices |
| `GET` | `/api/compliance/{project_id}` | List compliance rules |
| `POST` | `/api/compliance/` | Add rule |
| `PUT` | `/api/compliance/{id}` | Update rule |
| `DELETE` | `/api/compliance/{id}` | Delete rule |
| `POST` | `/api/insights/generate` | Generate AI report |

---

## 8. Adding Planet Labs / GEE (Future)

The system is designed for easy source extension. To add a new source:

1. Create `backend/app/pipelines/planet.py` (or `gee.py`)
2. Implement `execute_fetch_job(date, aoi, label, project_id, on_tci_ready)` with the same signature as `s2dr3.py`
3. In `backend/app/api/fetch.py`, update `_run_fetch_pipeline()` to route based on `source`

The frontend already shows Planet Labs and GEE as "COMING SOON" — set `available: true` in `FetchPage.js` to enable them.

---

## 9. Storage Layout

All processed images are stored locally under `backend/data/`:

```
backend/data/
└── {project_id}/
    ├── t1/
    │   ├── tci.tif          (downloaded, source)
    │   ├── tci.png          (RGB preview, served to UI)
    │   ├── ms.tif           (downloaded, used for indices)
    │   ├── t1_NDVI.png
    │   ├── t1_NDBI.png
    │   ├── t1_NDWI.png
    │   ├── t1_MNDWI.png
    │   ├── t1_BSI.png
    │   └── t1_EVI.png
    ├── t2/
    │   └── (same structure)
    └── change/
        └── change_mask.png
```

Images are served as static files via FastAPI at `/data/...`

---

## 10. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Leaflet, leaflet-draw, Axios |
| Backend | FastAPI, asyncpg, httpx |
| ML Model | ChangeFormer (PyTorch) via subprocess |
| Raster Processing | rasterio, numpy, matplotlib, Pillow |
| Database | PostgreSQL 14+ |
| LLM | Google Gemini 1.5 Flash |
| Satellite Data | S2DR3 (Sentinel-2) → GCS → local |

---

## 11. Development Notes

- The backend uses **in-memory status tracking** (`_fetch_status` dict in `fetch.py`) for low-latency polling. In production, replace with Redis.
- Change detection runs as an **async subprocess** — it does not block the FastAPI event loop.
- If `changeformer/` folder is missing, the backend generates a **placeholder mask** so the UI remains functional during development.
- All API calls from frontend use the **`/api` proxy** configured in `package.json` — no hardcoded ports needed.
