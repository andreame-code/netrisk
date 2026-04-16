# Issue 3: Potential Information Disclosure: Creator User IDs in Public Game List

- **Component**: `backend/routes/game-overview.cts`, `handleGamesListRoute`
- **Description**: The `/api/games` endpoint returns a list of games, and for each game, it includes the `creatorUserId`.
- **Impact**: Exposing internal user IDs to all users can facilitate targeted attacks or profiling of users.
- **Recommendation**: Only return `creatorUserId` to authorized users (e.g., the creator themselves or admins) or use non-sensitive display names instead.
