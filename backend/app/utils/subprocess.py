import asyncio
import subprocess
import re
from app.core.logger import logger

def _sync_subprocess_run(command: str, on_progress=None, on_log=None, cwd=None) -> bool:
    """
    Synchronous helper to run commands and parse progress.
    Exposed to asyncio via to_thread to bypass Windows NotImplementedError.
    """
    try:
        import os
        env = os.environ.copy()
        if cwd:
            env["PYTHONPATH"] = cwd + os.pathsep + env.get("PYTHONPATH", "")

        with subprocess.Popen(
            command, 
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, 
            text=True, 
            shell=isinstance(command, str),
            bufsize=1,
            cwd=cwd,
            env=env
        ) as proc:
            # Check both streams
            for stream in [proc.stdout, proc.stderr]:
                if not stream: continue
                for line in stream:
                    line_clean = line.strip()
                    if not line_clean: continue
                    logger.info(f"[SUBPROCESS] {line_clean}")
                    
                    if on_log:
                        on_log(line_clean)
                        
                    match = re.search(r"(\d+)%", line_clean)
                    if match and on_progress:
                        try:
                            pct = int(match.group(1))
                            on_progress(pct)
                        except: pass
            
            proc.wait()
            return proc.returncode == 0
    except Exception as e:
        logger.error(f">>> [SUBPROCESS] CRITICAL ERROR: {e}")
        return False

async def safe_run_subprocess(command: str, on_progress=None, on_log=None, cwd=None) -> bool:
    """Robust command execution using thread-based Popen."""
    return await asyncio.to_thread(_sync_subprocess_run, command, on_progress, on_log, cwd)
