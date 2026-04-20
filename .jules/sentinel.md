## 2026-04-20 - Enforced stricter password policy
**Vulnerability:** Weak password requirements (minimum 4 characters, no maximum) permitted easily guessable credentials and potential DoS via long passwords.
**Learning:** The application used a minimum length of 4 for both frontend and backend validation, which is below modern security standards. Hashing algorithms like scrypt can be CPU-intensive; not enforcing a maximum length could be exploited for DoS.
**Prevention:** Enforce a minimum of 8 characters and a maximum of 128 characters at both the API boundary and the frontend form. Synchronize localization strings to clearly communicate these requirements to the user.
