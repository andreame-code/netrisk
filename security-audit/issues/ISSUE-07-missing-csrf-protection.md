# Issue 7: Absence of Explicit CSRF Protection (Hardening Recommendation)

- **Component**: `backend/server.cts`
- **Description**: The application currently lacks explicit CSRF protection (e.g., anti-CSRF tokens) for state-changing operations.
- **Status**: Low severity hardening. Most write operations are JSON-based API calls, and session cookies are already configured with `SameSite=Lax`, providing a significant baseline defense.
- **Impact**: While the risk is mitigated by current cookie settings and request types, the absence of an explicit secondary defense mechanism is a noted hardening gap.
- **Recommendation**: Reassess the need for explicit CSRF protection (like Double Submit Cookies) after the authentication and cookie model is finalized, particularly for any non-JSON or sensitive state-changing routes.
