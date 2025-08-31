export function createAuthModel(authPort, navigation) {
  const render = ui => {
    const handleLogout = async () => {
      try {
        await authPort.logout({});
      } catch {
        // ignore errors
      }
      render(ui);
      try {
        sessionStorage.setItem('flashMessage', "Sei uscito dall'account");
      } catch {
        // ignore storage errors
      }
      navigation.navigateTo('index.html');
    };
    ui.renderUserMenu({ user: null, onLogout: handleLogout });
    authPort
      .currentUser({})
      .then(user => {
        ui.renderUserMenu({ user, onLogout: handleLogout });
      })
      .catch(() => {
        /* already rendered logged-out state */
      });
  };
  return { renderUserMenu: render };
}

export default createAuthModel;
