# Networking

The `net` module wraps Supabase calls for lobby management.

Assumptions:

- Lobbies are stored in Supabase tables (`lobbies`, `players`).
- Clients handle state synchronization via real-time subscriptions (not yet implemented).
