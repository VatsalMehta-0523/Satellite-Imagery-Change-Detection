import os
import psycopg2
from dotenv import load_dotenv

def check_connection():
    # Attempt to load .env from current directory or parent
    load_dotenv()
    
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("FAILED: DATABASE_URL not found in .env file.")
        return

    print(f"Connecting to: {db_url.split('@')[-1]}")
    
    try:
        # Standard psycopg2 connection test
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        db_version = cursor.fetchone()
        print(f"SUCCESS: Connected to Database!")
        print(f"   PostgreSQL Version: {db_version[0]}")
        
        # Check for existing tables
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
        tables = cursor.fetchall()
        print(f"   Tables in 'public' schema: {[t[0] for t in tables]}")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"CONNECTION FAILED: {e}")

if __name__ == "__main__":
    check_connection()
