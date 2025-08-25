const mapData = require('./src/data/map.json');
const Game = require('./game');

jest.mock('./territory-selection.js', () => jest.fn());

describe('script DOM interactions', () => {
  let mod;
  beforeEach(async () => {
    jest.resetModules();
    document.body.innerHTML = `
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
      <div id="t6" class="territory" data-id="t6"></div>`;
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve(mapData) })
    );
    global.logger = { info: jest.fn(), error: jest.fn() };
    window.Game = Game;
    mod = require('./script.js');
    await Promise.resolve();
    mod.attachTerritoryHandlers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('reinforcement updates status and log', () => {
    const t1 = document.getElementById('t1');
    const status = document.getElementById('status');
    const log = document.getElementById('actionLog');

    t1.click();
    expect(log.textContent).toContain('rinforza t1');
    expect(status.textContent).toContain('reinforce');

    t1.click();
    t1.click();
    expect(status.textContent).toContain('attack');
  });

  test('attack updates log and highlights', () => {
    const t1 = document.getElementById('t1');
    const t4 = document.getElementById('t4');
    const log = document.getElementById('actionLog');

    t1.click();
    t1.click();
    t1.click();

    t1.click();
    expect(t1.classList.contains('selected')).toBe(true);

    t4.click();
    expect(log.textContent).toContain('attacca t4 da t1');
    expect(t1.classList.contains('attack')).toBe(true);
    expect(t4.classList.contains('attack')).toBe(true);
  });

  test('fortify moves army and updates status/log', () => {
    const t1 = document.getElementById('t1');
    const t2 = document.getElementById('t2');
    const log = document.getElementById('actionLog');
    const status = document.getElementById('status');
    const { game, updateUI } = mod;

    t1.click();
    t1.click();
    t1.click();

    game.endTurn();
    updateUI();

    t1.click();
    expect(t1.classList.contains('selected')).toBe(true);
    t2.click();
    expect(log.textContent).toContain('sposta da t1 a t2');
    expect(status.textContent).toContain('reinforce');
    expect(t1.classList.contains('selected')).toBe(false);
  });

  test('end turn updates to next player reinforce', () => {
    const t1 = document.getElementById('t1');
    const endTurnBtn = document.getElementById('endTurn');
    const status = document.getElementById('status');
    const log = document.getElementById('actionLog');

    t1.click();
    t1.click();
    t1.click();

    endTurnBtn.click();
    expect(log.textContent).toContain('termina il turno');
    expect(status.textContent).toContain('Player 2');
    expect(status.textContent).toContain('reinforce');
  });
});

