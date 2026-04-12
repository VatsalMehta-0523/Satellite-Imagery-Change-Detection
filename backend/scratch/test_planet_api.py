import httpx
import asyncio
import json
import os
from datetime import datetime, timedelta

# Load API Key from .env manually
def get_api_key():
    with open("backend/.env", "r") as f:
        for line in f:
            if line.startswith("PL_API_KEY="):
                return line.split("=")[1].strip()
    return None

API_KEY = get_api_key()
PLANET_DATA_URL = "https://api.planet.com/data/v1"

async def test_planet_access():
    if not API_KEY:
        print("ERROR: PL_API_KEY not found in .env")
        return

    print(f"Testing Planet API with Key: {API_KEY[:5]}...")
    auth = (API_KEY, "")

    async with httpx.AsyncClient(auth=auth, timeout=30.0) as client:
        # 1. Check Account Info / Quota
        print("\n--- [1] Account & Quota Check ---")
        # Note: Planet doesn't have a direct 'quota' endpoint in Data v1, but we can check the stats
        stats_url = f"{PLANET_DATA_URL}/stats"
        stats_body = {
            "item_types": ["PSScene"],
            "interval": "year",
            "filter": {"type": "DateRangeFilter", "field_name": "acquired", "config": {"gte": "2024-01-01T00:00:00Z"}}
        }
        res = await client.post(stats_url, json=stats_body)
        if res.status_code == 200:
            print("Successfully accessed Statistics API.")
        else:
            print(f"Stats API Failed: {res.status_code} - {res.text}")

        # 2. Test Search for the failing item 
        print("\n--- [2] Targeted Search ( Ahmedabad ) ---")
        # Ahmedabad BBox roughly
        aoi_geom = {
            "type": "Polygon",
            "coordinates": [[
                [72.50, 22.95], [72.65, 22.95], [72.65, 23.05],
                [72.50, 23.05], [72.50, 22.95]
            ]]
        }
        
        search_body = {
            "item_types": ["PSScene"],
            "filter": {
                "type": "AndFilter",
                "config": [
                    {"type": "DateRangeFilter", "field_name": "acquired", "config": {"gte": "2026-03-24T00:00:00Z", "lte": "2026-03-30T23:59:59Z"}},
                    {"type": "GeometryFilter", "field_name": "geometry", "config": aoi_geom},
                    {"type": "PermissionFilter", "config": ["assets:download"]}
                ]
            }
        }
        
        search_res = await client.post(f"{PLANET_DATA_URL}/quick-search", json=search_body)
        if search_res.status_code == 200:
            features = search_res.json().get("features", [])
            print(f"Found {len(features)} items with 'assets:download' permission.")
            
            if not features:
                print("RE-TRYING SEARCH WITHOUT PERMISSION FILTER...")
                del search_body["filter"]["config"][2]
                search_res = await client.post(f"{PLANET_DATA_URL}/quick-search", json=search_body)
                features = search_res.json().get("features", [])
                print(f"Found {len(features)} total items (license ignored).")
            
            if features:
                best = features[0]
                item_id = best["id"]
                print(f"\nAnalyzing Item ID: {item_id}")
                print(f"Permissions: {json.dumps(best.get('_permissions', []), indent=2)}")
                
                # 3. Check Assets
                print("\n--- [3] Asset Availability ---")
                assets_url = f"{PLANET_DATA_URL}/item-types/PSScene/items/{item_id}/assets"
                assets_res = await client.get(assets_url)
                if assets_res.status_code == 200:
                    assets = assets_res.json()
                    print(f"Available Assets: {list(assets.keys())}")
                    for name in ["ortho_analytic_8b_sr", "ortho_analytic_4b_sr", "ortho_analytic_4b"]:
                        if name in assets:
                            print(f"  - {name}: FOUND (Status: {assets[name].get('status')})")
                        else:
                            print(f"  - {name}: MISSING")
                else:
                    print(f"Assets API Request Failed: {assets_res.status_code}")
        else:
            print(f"Search API Failed: {search_res.status_code} - {search_res.text}")

if __name__ == "__main__":
    asyncio.run(test_planet_access())
