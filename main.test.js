const mapData = require('./src/data/map.json');
const { REINFORCE, ATTACK, FORTIFY, GAME_OVER } = require('./phases.js');

jest.mock('./territory-selection.js', () => jest.fn());
jest.mock('./move-prompt.js', () => jest.fn(() => Promise.resolve(1)));
jest.mock('./navigation.js', () => ({ navigateTo: jest.fn() }));

describe('main DOM interactions', () => {
  let main;
  let ui;
  beforeEach(async () => {
    jest.resetModules();
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
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
      Promise.resolve({ ok: true, json: () => Promise.resolve(mapData) })
    );
    global.logger = { info: jest.fn(), error: jest.fn() };
    main = require('./main.js');
    ui = require('./ui.js');
    await Promise.resolve();
    main.attachTerritoryHandlers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    if (typeof window !== 'undefined') {
      window.location.href = 'http://localhost/';
    }
  });

  test('reinforcement updates status and log', () => {
    const t1 = document.getElementById('t1');
    const status = document.getElementById('status');
    const log = document.getElementById('actionLog');

    t1.click();
    expect(log.textContent).toContain('reinforces t1');
    expect(status.textContent).toContain(REINFORCE);

    t1.click();
    t1.click();
    expect(status.textContent).toContain(ATTACK);
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
    expect(log.textContent).toContain('attacks t4 from t1');
    expect(t1.classList.contains('attack')).toBe(true);
    expect(t4.classList.contains('attack')).toBe(true);
  });

  test('fortify moves army and updates status/log', async () => {
    const t1 = document.getElementById('t1');
    const t2 = document.getElementById('t2');
    const log = document.getElementById('actionLog');
    const status = document.getElementById('status');
    const { game } = main;
    const { updateUI } = ui;

    t1.click();
    t1.click();
    t1.click();

    game.endTurn();
    updateUI();

    t1.click();
    expect(t1.classList.contains('selected')).toBe(true);
    t2.click();
    await Promise.resolve();
    expect(log.textContent).toContain('moves 1 from t1 to t2');
    expect(status.textContent).toContain(REINFORCE);
    expect(t1.classList.contains('selected')).toBe(false);
  });

  test('end turn now requires fortify step', () => {
    const t1 = document.getElementById('t1');
    const endTurnBtn = document.getElementById('endTurn');
    const status = document.getElementById('status');
    const log = document.getElementById('actionLog');

    t1.click();
    t1.click();
    t1.click();

    endTurnBtn.click();
    expect(status.textContent).toContain(FORTIFY);

    endTurnBtn.click();
    expect(log.textContent).toContain('ends turn');
    expect(status.textContent).toContain('Player 2');
    expect(status.textContent).toContain(REINFORCE);
  });

  test('state is saved and restored from localStorage', async () => {
    const t1 = document.getElementById('t1');
    t1.click();
    t1.click();
    t1.click();
    const armies = main.game.territoryById('t1').armies;
    const phase = main.game.getPhase();
    const saved = localStorage.getItem('netriskGame');
    expect(saved).toBeTruthy();

    // simulate reload
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
      Promise.resolve({ ok: true, json: () => Promise.resolve(mapData) })
    );
    global.logger = { info: jest.fn(), error: jest.fn() };
    const main2 = require('./main.js');
    require('./ui.js');
    await Promise.resolve();
    await Promise.resolve();
    expect(main2.game.territoryById('t1').armies).toBe(armies);
    expect(main2.game.getPhase()).toBe(phase);
  });

  test('invalid player color does not crash updateUI', () => {
    const t1 = document.getElementById('t1');
    main.game.players[0].color = '#notacolor';
    expect(() => ui.updateUI()).not.toThrow();
    const colorClasses = Array.from(t1.classList).filter((c) =>
      c.startsWith('player-color-'),
    );
    expect(colorClasses).toHaveLength(0);
  });

  test('unused player color classes are cleaned up', () => {
    const getSheet = () =>
      Array.from(document.styleSheets).find((s) =>
        Array.from(s.cssRules).some(
          (r) => r.selectorText && r.selectorText.startsWith('.player-color-'),
        ),
      );
    const t1 = document.getElementById('t1');
    const sheet = getSheet();
    const initialCount = sheet ? sheet.cssRules.length : 0;
    expect(t1.classList.contains('player-color-e6194b')).toBe(true);
    main.game.players[0].color = '#00ff00';
    ui.updateUI();
    expect(t1.classList.contains('player-color-00ff00')).toBe(true);
    expect(t1.classList.contains('player-color-e6194b')).toBe(false);
    const sheetAfter = getSheet();
    expect(sheetAfter.cssRules.length).toBe(initialCount);
  });

  test('army count text contrasts with player color', () => {
    const t1 = document.getElementById('t1');
    main.game.players[0].color = '#000000';
    ui.updateUI();
    expect(getComputedStyle(t1).color).toBe('rgb(255, 255, 255)');
    main.game.players[0].color = '#ffffff';
    ui.updateUI();
    expect(getComputedStyle(t1).color).toBe('rgb(0, 0, 0)');
  });

  test('startNewGame clears saved data', () => {
    localStorage.setItem('netriskPlayers', JSON.stringify([{ name: 'P1', color: '#000' }]));
    localStorage.setItem('netriskGame', 'dummy');
    expect(() => main.startNewGame()).not.toThrow();
    expect(localStorage.getItem('netriskPlayers')).toBeNull();
    expect(localStorage.getItem('netriskGame')).toBeNull();
    const navigation = require('./navigation.js');
    expect(navigation.navigateTo).toHaveBeenCalledWith('setup.html');
  });

  test('runAI processes AI turns', () => {
    main.game.setCurrentPlayer(2); // ensure AI player
    const perform = jest
      .spyOn(main.game, 'performAITurn')
      .mockImplementation(() => {
        main.game.setPhase(GAME_OVER);
      });
    const uiSpy = jest.spyOn(ui, 'updateUI').mockImplementation(() => {});
    main.runAI();
    jest.runOnlyPendingTimers();
    expect(perform).toHaveBeenCalled();
    expect(uiSpy).toHaveBeenCalled();
    perform.mockRestore();
    uiSpy.mockRestore();
  });
});

