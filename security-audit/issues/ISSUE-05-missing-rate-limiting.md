# Issue 5: Missing Rate Limiting on Sensitive Endpoints

- **Component**: `backend/server.cts`, `backend/routes/password-auth.cts`
- **Description**: There is no rate limiting implemented for sensitive endpoints like `/api/auth/login`, `/api/auth/register`, and `/api/games`.
- **Impact**: The application is vulnerable to brute-force attacks on user passwords and potential denial of service (DoS) through rapid resource creation.
- **Recommendation**: Implement rate limiting middleware for all API endpoints, with stricter limits on authentication and resource-intensive routes.
