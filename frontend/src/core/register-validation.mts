export type RegistrationValidationInput = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export type RegistrationValidationKey =
  | "register.errors.requiredFields"
  | "register.errors.invalidUsername"
  | "register.errors.shortPassword"
  | "register.errors.passwordMismatch"
  | "register.errors.invalidEmail";

const usernamePattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]{2,31}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateRegistrationInput(
  input: RegistrationValidationInput
): RegistrationValidationKey | null {
  if (!input.username || !input.password || !input.confirmPassword) {
    return "register.errors.requiredFields";
  }

  if (!usernamePattern.test(input.username)) {
    return "register.errors.invalidUsername";
  }

  if (input.password.length < 4) {
    return "register.errors.shortPassword";
  }

  if (input.password !== input.confirmPassword) {
    return "register.errors.passwordMismatch";
  }

  if (input.email && !emailPattern.test(input.email)) {
    return "register.errors.invalidEmail";
  }

  return null;
}
