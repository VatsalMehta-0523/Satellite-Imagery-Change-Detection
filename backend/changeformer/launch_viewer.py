import http.server
import socketserver
import webbrowser
import os
import time

# --- Configuration ---
PORT = 8000
HTML_FILE = "slider.html"
IMAGE_1 = "South_bopal_1_2018_TCI_try.png"
IMAGE_2 = "South_bopal_1_2026_TCI_try.png"

def check_files():
    files = [HTML_FILE, IMAGE_1, IMAGE_2]
    missing = [f for f in files if not os.path.exists(f)]
    if missing:
        print(f"Error: Missing required files: {', '.join(missing)}")
        return False
    return True

def launch():
    if not check_files():
        return

    Handler = http.server.SimpleHTTPRequestHandler

    print(f"Starting server at http://localhost:{PORT}")
    print("Press Ctrl+C to stop the application.")

    # Open browser slightly after starting
    def open_browser():
        time.sleep(1)
        webbrowser.open_new_tab(f"http://localhost:{PORT}/{HTML_FILE}")

    import threading
    threading.Thread(target=open_browser, daemon=True).start()

    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.server_close()

if __name__ == "__main__":
    launch()
