import {
  currentUserInputSchema,
  logoutInputSchema,
} from "../../shared/ports/auth";

export function createAuthModel(authPort) {
  return {
    async currentUser() {
      const input = currentUserInputSchema.parse({});
      try {
        const { id, email, name } = await authPort.currentUser(input);
        return { id, email, name };
      } catch {
        return null;
      }
    },
    async logout() {
      const input = logoutInputSchema.parse({});
      await authPort.logout(input);
    },
  };
}

export default createAuthModel;
