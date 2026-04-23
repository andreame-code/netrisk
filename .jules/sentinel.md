## 2026-04-23 - [Enforcement of Password Security Policy]
**Vulnerability:** Weak password requirements (4 characters minimum) and lack of maximum length (DoS risk via scrypt).
**Learning:** Hashing extremely long passwords can be computationally expensive. Without a maximum length, an attacker can submit very long strings to exhaust server CPU.
**Prevention:** Enforce a reasonable range for password length (e.g., 8-128 characters) consistently across backend, frontend, and API validation schemas.
