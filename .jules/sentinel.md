## 2026-04-23 - [Enforcement of Password Security Policy]
**Vulnerability:** Weak password requirements (4 characters minimum) and lack of maximum length (DoS risk via scrypt).
**Learning:** Hashing extremely long passwords can be computationally expensive. Without a maximum length, an attacker can submit very long strings to exhaust server CPU.
**Prevention:** Enforce a reasonable range for password length (e.g., 8-128 characters) consistently across backend, frontend, and API validation schemas.

## 2026-05-15 - [Mitigation of Timing Attacks in Auth Flow]
**Vulnerability:** Username enumeration via response time differences and potential timing leaks in hash comparison.
**Learning:** Verification of non-existent users is often faster than existing users because it skips hashing. Also, comparing hashes of different lengths can leak information or crash `timingSafeEqual`.
**Prevention:** Perform a dummy hash operation (e.g., `scryptSync` with a fixed salt) when a user is not found. When comparing hashes of potentially different lengths, perform a dummy `timingSafeEqual` with identical buffers to maintain a constant-time path before returning early.
