jest.mock('./navigation.js', () => ({ navigateTo: jest.fn() }));

describe('home navigation', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="playBtn" class="btn"></button>
      <button id="setupBtn" class="btn"></button>
      <button id="howToPlayBtn" class="btn"></button>
      <button id="aboutBtn" class="btn"></button>
    `;
  });

  test('buttons navigate to pages', () => {
    const { navigateTo } = require('./navigation.js');
    require('./home.js');
    document.getElementById('playBtn').click();
    document.getElementById('setupBtn').click();
    document.getElementById('howToPlayBtn').click();
    document.getElementById('aboutBtn').click();
    expect(navigateTo).toHaveBeenNthCalledWith(1, 'game.html');
    expect(navigateTo).toHaveBeenNthCalledWith(2, 'setup.html');
    expect(navigateTo).toHaveBeenNthCalledWith(3, 'how-to-play.html');
    expect(navigateTo).toHaveBeenNthCalledWith(4, 'about.html');
  });
});
