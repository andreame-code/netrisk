# Networking

The `net` package exposes a FastAPI application and helper functions for lobby
management. Lobbies store player identifiers and can broadcast messages.

Assumptions:
- Lobbies are ephemeral and kept in memory.
- State synchronization is responsibility of the caller.
