const mapData = require('./src/data/map.json');
jest.mock('./territory-selection.js', () => jest.fn());
jest.mock('./move-prompt.js', () => jest.fn(() => Promise.resolve(1)));
jest.mock('./navigation.js', () => ({ navigateTo: jest.fn() }));

describe('main menu', () => {
  beforeEach(() => {
    jest.resetModules();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    document.body.innerHTML = `
      <div id="mainMenu"><button id="startGame"></button></div>
      <div id="gameContainer">
        <div id="status"></div>
        <div id="currentPlayer"></div>
        <div id="turnNumber"></div>
        <div id="actionLog"></div>
        <div id="diceResults"></div>
        <div id="uiPanel"></div>
        <button id="endTurn"></button>
        <div id="t1" class="territory" data-id="t1"></div>
        <div id="t2" class="territory" data-id="t2"></div>
        <div id="t3" class="territory" data-id="t3"></div>
        <div id="t4" class="territory" data-id="t4"></div>
        <div id="t5" class="territory" data-id="t5"></div>
        <div id="t6" class="territory" data-id="t6"></div>
      </div>`;
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(mapData) })
    );
    global.logger = { info: jest.fn(), error: jest.fn() };
  });

  test('initializes game after start button clicked', async () => {
    const main = require('./main.js');
    expect(main.game).toBeUndefined();
    document.getElementById('startGame').click();
    await Promise.resolve();
    await Promise.resolve();
    expect(main.game).toBeDefined();
  });
});
