import logging
from logging.handlers import RotatingFileHandler
import os
import sys

def setup_logging():
    """
    Initializes the centralized UrbanEye logging system.
    Handles both console output and rolling file logs.
    """
    # Ensure logs directory exists
    os.makedirs("logs", exist_ok=True)
    log_file = os.path.join("logs", "app.log")

    # 1. Configuration
    log_level = logging.INFO
    log_format = '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
    formatter = logging.Formatter(log_format)

    # 2. Handlers
    # 10MB Rolling File Logger
    file_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=10)
    file_handler.setFormatter(formatter)
    
    # Standard Stream (Console) Logger
    stream_handler = logging.StreamHandler(sys.stdout)
    stream_handler.setFormatter(formatter)

    # 3. Configure Root Logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Clear existing handlers to avoid duplicates
    if root_logger.hasHandlers():
        root_logger.handlers.clear()
        
    root_logger.addHandler(file_handler)
    root_logger.addHandler(stream_handler)

    # 4. Hook into Uvicorn Loggers
    for logger_name in ["uvicorn", "uvicorn.error", "uvicorn.access"]:
        u_logger = logging.getLogger(logger_name)
        u_logger.handlers = [file_handler, stream_handler]
        u_logger.propagate = False 

    logging.getLogger("uvicorn.error").info(">>> [SYSTEM] Centralized Neural Logging Pipeline Online.")

def get_logger(name: str):
    """
    Factory function to get a named logger.
    """
    return logging.getLogger(name)

# Export a default app logger
logger = logging.getLogger("app")
