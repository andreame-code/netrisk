jest.mock('../theme.js', () => ({ initThemeToggle: jest.fn() }));
jest.mock('../navigation.js', () => ({ navigateTo: jest.fn() }));

describe('home page initialization', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = `
      <button id="playBtn"></button>
      <button id="multiplayerBtn"></button>
      <button id="setupBtn"></button>
      <button id="howToPlayBtn"></button>
      <button id="aboutBtn"></button>
    `;
  });

  test('initHome sets up theme and navigation handlers', () => {
    const { initThemeToggle } = require('../theme.js');
    const { navigateTo } = require('../navigation.js');
    require('../home.js');

    document.getElementById('playBtn').click();
    document.getElementById('aboutBtn').click();

    expect(initThemeToggle).toHaveBeenCalledTimes(1);
    expect(navigateTo).toHaveBeenCalledWith('game.html');
    expect(navigateTo).toHaveBeenCalledWith('about.html');
    expect(navigateTo).toHaveBeenCalledTimes(2);
  });
});
