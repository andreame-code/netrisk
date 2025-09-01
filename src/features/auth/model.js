export function createAuthModel(authPort) {
  return {
    async currentUser() {
      try {
        const { id, email, name } = await authPort.currentUser({});
        return { id, email, name };
      } catch {
        return null;
      }
    },
    async logout() {
      await authPort.logout({});
    },
  };
}

export default createAuthModel;
