jest.mock('../src/navigation.js', () => ({
  navigateTo: jest.fn(),
  goHome: jest.fn(),
  exitGame: jest.fn(),
}));

describe('home navigation', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="playBtn" class="btn"></button>
      <button id="multiplayerBtn" class="btn"></button>
      <button id="setupBtn" class="btn"></button>
      <button id="howToPlayBtn" class="btn"></button>
      <button id="aboutBtn" class="btn"></button>
    `;
  });

  test('buttons navigate to pages', () => {
    const { navigateTo } = require('../src/navigation.js');
    require('../src/home.js');
    document.getElementById('playBtn').click();
    document.getElementById('multiplayerBtn').click();
    document.getElementById('setupBtn').click();
    document.getElementById('howToPlayBtn').click();
    document.getElementById('aboutBtn').click();
    expect(navigateTo).toHaveBeenNthCalledWith(1, 'game.html');
    expect(navigateTo).toHaveBeenNthCalledWith(2, 'lobby.html');
    expect(navigateTo).toHaveBeenNthCalledWith(3, 'setup.html');
    expect(navigateTo).toHaveBeenNthCalledWith(4, 'how-to-play.html');
    expect(navigateTo).toHaveBeenNthCalledWith(5, 'about.html');
  });
});
