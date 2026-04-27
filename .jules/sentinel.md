## 2025-05-15 - Timing-Safe Legacy Password Verification
**Vulnerability:** Legacy plaintext passwords were being compared using standard string equality (`!==`), which is susceptible to timing attacks.
**Learning:** Even when migrating to secure hashes like scrypt, the legacy fallback path must remain timing-safe. Node.js's `crypto.timingSafeEqual` requires buffers of equal length, so hashing both the expected and provided secrets (e.g., with SHA-256) is a robust pattern to achieve this for variable-length inputs.
**Prevention:** Always use timing-safe comparison for any secret-derived data, and normalize lengths via hashing before comparison when the inputs can have different lengths.
