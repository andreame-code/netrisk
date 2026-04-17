## 2026-04-17 - Enhanced Password Security
**Vulnerability:** Weak password policy (minimum 4 characters) and missing maximum length (potential hashing DoS).
**Learning:** The application had a very permissive password policy that didn't meet modern standards and lacked protection against long-password DoS attacks on the scrypt hashing function.
**Prevention:** Always enforce a minimum of 8 characters and a reasonable maximum (e.g., 128) for passwords.
