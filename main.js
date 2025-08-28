(async () => {
  const page = window.location.pathname.split('/').pop();

  switch (page) {
    case '':
    case 'index.html':
      await import('./src/home.js');
      break;
    case 'about.html':
      await import('./src/about.js');
      break;
    case 'lobby.html':
      await import('./src/lobby.js');
      break;
    case 'setup.html':
      await import('./src/setup.js');
      break;
    case 'game.html':
      await import('./src/logger.js');
      await import('./src/main.js');
      break;
    default:
      break;
  }
})();
