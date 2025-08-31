export function createAuthModel(authPort) {
  const render = ui => {
    Promise.all([
      authPort.session({}).catch(() => null),
      authPort.currentUser({}).catch(() => null)
    ]).then(([, user]) => {
      ui.renderUserMenu({
        user,
        onLogout: async () => {
          try {
            await authPort.logout({});
          } catch {
            // ignore errors
          }
          render(ui);
        }
      });
    });
  };
  return { renderUserMenu: render };
}

export default createAuthModel;
