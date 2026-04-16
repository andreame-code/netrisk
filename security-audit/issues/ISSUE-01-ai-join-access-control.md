# Issue 1: Broken Access Control: Unauthorized AI Player Addition

- **Component**: `backend/routes/game-setup.cts`, `handleAiJoinRoute`
- **Description**: The endpoint `/api/ai/join` does not require authentication or any authorization checks.
- **Impact**: Any unauthenticated user can add an arbitrary number of AI players to any active game, potentially disrupting gameplay or causing denial of service by filling up player slots.
- **Recommendation**: Implement `requireAuth` and `authorize` checks similar to `handleJoinRoute`.
