# Issue 7: Lack of CSRF Protection for State-Changing Operations

- **Component**: `backend/server.cts`
- **Description**: While session cookies are set with `SameSite=Lax`, there is no explicit CSRF protection (like anti-CSRF tokens) for POST/PUT/DELETE requests.
- **Impact**: Under certain conditions, users could be tricked into performing unintended actions on the site if they are logged in.
- **Recommendation**: Implement a CSRF protection mechanism, such as synchronizer tokens or Double Submit Cookies, especially for sensitive operations.
