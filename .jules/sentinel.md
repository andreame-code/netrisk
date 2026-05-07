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
