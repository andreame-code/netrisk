import json
from pathlib import Path


def save_state(path: str, state: dict) -> None:
    """Persist state to a JSON file."""
    Path(path).write_text(json.dumps(state))


def load_state(path: str) -> dict:
    """Load state from a JSON file."""
    return json.loads(Path(path).read_text())
