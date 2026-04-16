# Issue 6: Insufficient Password Complexity Policy

- **Component**: `backend/auth.cts`, `registrationValidationError`
- **Description**: The minimum password length is set to only 4 characters, and there are no requirements for complexity (e.g., mixed case, numbers, symbols).
- **Impact**: Users may choose weak passwords that are easily guessed or cracked.
- **Recommendation**: Increase the minimum password length (e.g., to 8 or 12 characters) and enforce complexity requirements.
