import os
import psycopg
from dotenv import load_dotenv

def check_connection_v3():
    load_dotenv()
    db_url = os.getenv("DATABASE_URL")
    print(f"Testing Psycopg3 connection to: {db_url.split('@')[-1]}")
    
    try:
        # Test 1: Full URL
        conn = psycopg.connect(db_url)
        print("SUCCESS: Raw Psycopg3 connection with URI worked!")
        conn.close()
    except Exception as e:
        print(f"FAILED (URI): {e}")
        
    try:
        # Test 2: TCP connection
        conn = psycopg.connect(host="127.0.0.1", user="postgres", password="vatsal123", port=5432, dbname="satellite_saas")
        print("SUCCESS: Raw Psycopg3 connection with 127.0.0.1 worked!")
        conn.close()
    except Exception as e:
        print(f"FAILED (127.0.0.1): {e}")

if __name__ == "__main__":
    check_connection_v3()
