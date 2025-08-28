jest.mock('../src/theme.js', () => ({ initThemeToggle: jest.fn() }));
jest.mock('../src/navigation.js', () => ({ navigateTo: jest.fn() }));

describe('home page UAT', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('initHome wires up all buttons to navigation', () => {
    document.body.innerHTML = `
      <button id="playBtn"></button>
      <button id="multiplayerBtn"></button>
      <button id="setupBtn"></button>
      <button id="howToPlayBtn"></button>
      <button id="aboutBtn"></button>
    `;

    const { navigateTo } = require('../src/navigation.js');
    require('../src/home.js');

    document.getElementById('playBtn').click();
    document.getElementById('multiplayerBtn').click();
    document.getElementById('setupBtn').click();
    document.getElementById('howToPlayBtn').click();
    document.getElementById('aboutBtn').click();

    expect(navigateTo).toHaveBeenNthCalledWith(1, './game.html');
    expect(navigateTo).toHaveBeenNthCalledWith(2, './lobby.html');
    expect(navigateTo).toHaveBeenNthCalledWith(3, './setup.html');
    expect(navigateTo).toHaveBeenNthCalledWith(4, './how-to-play.html');
    expect(navigateTo).toHaveBeenNthCalledWith(5, './about.html');
    expect(navigateTo).toHaveBeenCalledTimes(5);
  });

  test('initHome skips missing buttons without error', () => {
    document.body.innerHTML = `
      <button id="playBtn"></button>
    `;

    const { navigateTo } = require('../src/navigation.js');
    expect(() => require('../src/home.js')).not.toThrow();

    document.getElementById('playBtn').click();
    expect(navigateTo).toHaveBeenCalledWith('./game.html');
    expect(navigateTo).toHaveBeenCalledTimes(1);
  });

  test('initHome with no buttons does not trigger navigation', () => {
    document.body.innerHTML = '';
    const { navigateTo } = require('../src/navigation.js');

    expect(() => require('../src/home.js')).not.toThrow();
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
