from dataclasses import dataclass
from typing import Dict


@dataclass(frozen=True)
class GameState:
    territories: Dict[str, str]


def move(
    state: GameState, from_territory: str, to_territory: str, player: str
) -> GameState:
    """Move ownership from one territory to another."""
    territories = dict(state.territories)
    territories.pop(from_territory, None)
    territories[to_territory] = player
    return GameState(territories)
