# Issue 2: Information Disclosure: Sensitive Server Paths and Database Metadata

- **Component**: `backend/routes/health.cts`, `backend/datastore.cts`
- **Description**: The `/api/health` endpoint exposes the absolute path to the SQLite database file on the server (`dbFile`) and provides counts of users, games, and sessions.
- **Impact**: Knowledge of absolute file paths can be used in further attacks (e.g., local file inclusion if such a vulnerability exists elsewhere). Metadata about the number of users and games may also be considered sensitive.
- **Recommendation**: Remove sensitive fields like `dbFile` from the health summary returned to the client.
