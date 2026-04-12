import os
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/satellite_saas")
S2DR3_BASE_URL = os.getenv("S2DR3_BASE_URL", "https://s2dr3-job-20250428-862134799361.europe-west1.run.app")
S2DR3_USER_ID = int(os.getenv("S2DR3_USER_ID", "32459320"))
DATA_DIR = os.getenv("DATA_DIR", "data")
CHANGE_DETECTION_DIR = os.getenv("CHANGE_DETECTION_DIR", "changeformer")
PL_API_KEY = os.getenv("PL_API_KEY", "")
CHANGEFORMER_PYTHON_PATH = os.getenv("CHANGEFORMER_PYTHON_PATH", "python")
GEE_JSON_PATH = os.getenv("GEE_JSON_PATH", "gee_service_acconut.json")

os.makedirs(DATA_DIR, exist_ok=True)
