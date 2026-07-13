from pathlib import Path
from dotenv import load_dotenv

_LOADED = False

def load_env():
    global _LOADED
    if _LOADED:
        return

    root = Path(__file__).resolve().parents[3]

    load_dotenv(root / ".env", override=False)
    load_dotenv(root / "backend" / ".env", override=False)

    _LOADED = True