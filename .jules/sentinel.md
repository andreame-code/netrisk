## 2025-05-15 - Timing-Safe Legacy Password Verification
**Vulnerability:** Legacy plaintext passwords were being compared using standard string equality (`!==`), which is susceptible to timing attacks.
**Learning:** Even when migrating to secure hashes like scrypt, the legacy fallback path must remain timing-safe. Node.js's `crypto.timingSafeEqual` requires buffers of equal length. For variable-length secrets, a robust pattern is to check for length equality first and perform a dummy comparison on mismatch to maintain constant-time execution paths without using potentially insecure hashes on password data.
**Prevention:** Always use timing-safe comparison for any secret-derived data, and normalize lengths via hashing before comparison when the inputs can have different lengths.

## 2025-05-20 - Unauthenticated AI Join Endpoint
**Vulnerability:** The `/api/ai/join` endpoint was completely unauthenticated and unauthorized, allowing anyone to fill game lobbies with AI bots.
**Learning:** Security controls must be applied consistently across all endpoints that mutate game state, regardless of whether they represent "human" or "system" actions. Partial authentication (securing `/api/join` but not `/api/ai/join`) creates easy bypasses for disruptive behavior.
**Prevention:** Audit all endpoints in a feature set (e.g., game setup) to ensure they share the same security posture. Use centralized authorization policies (like `game:start`) to enforce consistent permissions.

## 2026-05-07 - Hardened Request Parsing and Early Security Headers
**Vulnerability:** Malformed Host headers caused the custom HTTP server to throw unhandled TypeErrors during URL initialization, potentially leading to service instability or ungraceful error states.
**Learning:** Node.js's `new URL()` constructor throws on invalid input. In a custom server implementation, this must be handled explicitly at the boundary. Furthermore, applying security headers *after* potential crash points leaves error responses unprotected.
**Prevention:** Wrap request boundary parsing in try-catch blocks and prioritize the application of security headers to ensure all response paths, including early failures, are hardened.

## 2026-05-25 - Timing-Safe Authentication and Username Enumeration Mitigation
**Vulnerability:** The authentication flow was susceptible to timing-based username enumeration. If a user did not exist or had no password record (e.g., OAuth only), the system would skip hashing and return early, significantly faster than a successful or failed password check.
**Learning:** Security-sensitive operations like password verification must maintain consistent timing profiles across all logic branches. Partial mitigations (like dummy hashing only when a user is found but credentials are missing) still leave gaps for non-existent users.
**Prevention:** Hardened the core `verifyPassword` utility to always perform a hashing operation (using dummy salt/hash if necessary) even when user records are missing. This ensures consistent timing parity across the entire authentication boundary.

## 2026-05-15 - Defensive Security Header Management with Mock Compatibility
**Vulnerability:** Security hardening that relies on standard Node.js HTTP response methods like `res.removeHeader` can cause runtime errors in test suites where response objects are mocked without full API parity.
**Learning:** When applying security headers at the global server level, defensive checks for method existence (e.g., `typeof res.removeHeader === 'function'`) ensure that security logic doesn't break gameplay or regression tests that use lightweight mocks. Additionally, HSTS must be applied conditionally (only over secure connections or in test environments) to align with RFC 6797 and maintain local development accessibility.
**Prevention:** Always wrap non-standard or late-added response methods in defensive type checks and ensure HSTS application logic respects the connection's security state.

## 2026-06-01 - Strict Content-Type Enforcement and Request Hardening
**Vulnerability:** Permissive API mutation endpoints (POST, PUT, PATCH) did not strictly enforce `Content-Type: application/json`, potentially allowing bypasses of CORS preflight triggers for certain payloads. Additionally, client-side body parsing errors were masked as 500 errors, obscuring security-relevant client failures.
**Learning:** Hardening the request boundary requires both strict header enforcement and transparent error propagation. However, adding specific CSS classes to interactive elements is often necessary to prevent integration test regressions when security changes affect components with localized labels, as `screen.getByRole` becomes ambiguous when multiple instances (e.g., mobile vs. desktop) share the same translated text.
**Prevention:** Enforce strict `application/json` Content-Type for all mutating endpoints to ensure standard browser security (CORS) is consistently triggered. Always use unique, non-localized selectors (like specific CSS classes or data-testids) in integration tests to maintain robustness across UI-wide security enhancements.
