from fastapi import FastAPI

app = FastAPI()
_lobbies: dict[str, list[str]] = {}


def create_lobby(lobby_id: str) -> None:
    """Create a new lobby if it doesn't exist."""
    _lobbies.setdefault(lobby_id, [])


def join_lobby(lobby_id: str, player: str) -> None:
    """Add a player to a lobby."""
    _lobbies.setdefault(lobby_id, []).append(player)


def list_players(lobby_id: str) -> list[str]:
    """Return players currently in the lobby."""
    return list(_lobbies.get(lobby_id, []))
