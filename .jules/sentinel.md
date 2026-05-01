## 2025-05-15 - Timing-Safe Legacy Password Verification
**Vulnerability:** Legacy plaintext passwords were being compared using standard string equality (`!==`), which is susceptible to timing attacks.
**Learning:** Even when migrating to secure hashes like scrypt, the legacy fallback path must remain timing-safe. Node.js's `crypto.timingSafeEqual` requires buffers of equal length. For variable-length secrets, a robust pattern is to check for length equality first and perform a dummy comparison on mismatch to maintain constant-time execution paths without using potentially insecure hashes on password data.
**Prevention:** Always use timing-safe comparison for any secret-derived data, and normalize lengths via hashing before comparison when the inputs can have different lengths.

## 2025-05-20 - Unauthenticated AI Join Endpoint
**Vulnerability:** The `/api/ai/join` endpoint was completely unauthenticated and unauthorized, allowing anyone to fill game lobbies with AI bots.
**Learning:** Security controls must be applied consistently across all endpoints that mutate game state, regardless of whether they represent "human" or "system" actions. Partial authentication (securing `/api/join` but not `/api/ai/join`) creates easy bypasses for disruptive behavior.
**Prevention:** Audit all endpoints in a feature set (e.g., game setup) to ensure they share the same security posture. Use centralized authorization policies (like `game:start`) to enforce consistent permissions.
