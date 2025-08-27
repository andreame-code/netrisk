jest.mock('./navigation.js', () => ({ goHome: jest.fn() }));
jest.mock('./theme.js', () => ({ initThemeToggle: jest.fn() }));
jest.mock('./src/init/supabase-client.js', () => null);

describe('lobby screen', () => {
  beforeEach(() => {
    jest.resetModules();
    document.body.innerHTML = `
      <button id="backBtn" class="btn"></button>
      <ul id="lobbyList"></ul>
    `;
  });

  test('back button goes home', () => {
    const { goHome } = require('./navigation.js');
    require('./lobby.js');
    document.getElementById('backBtn').click();
    expect(goHome).toHaveBeenCalled();
  });

  test('renderLobbies displays info', () => {
    const { renderLobbies } = require('./lobby.js');
    const data = [
      { code: 'abc', host: 'host', players: [{}, {}], map: 'earth', started: false },
    ];
    renderLobbies(data);
    const text = document.getElementById('lobbyList').textContent;
    expect(text).toContain('abc');
    expect(text).toContain('host');
    expect(text).toContain('2/6');
    expect(text).toContain('earth');
    expect(text).toContain('open');
  });
});
