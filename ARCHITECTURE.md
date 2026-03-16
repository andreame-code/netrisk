# NetRisk Architecture

Core folders

/frontend
UI and map rendering

/backend
Game server and orchestration

/backend/engine
Pure game logic

/shared
Shared types and models

## Engine modules

GameEngine
TurnManager
CombatResolver
ReinforcementSystem
MapGraph

The engine must be deterministic and independent from UI.

Frontend must never implement game rules.
