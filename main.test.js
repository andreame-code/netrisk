const mapData = require('./src/data/map.json');

jest.mock('./territory-selection.js', () => jest.fn());
jest.mock('./move-prompt.js', () => jest.fn(() => Promise.resolve(1)));

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
      Promise.resolve({ json: () => Promise.resolve(mapData) })
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
    expect(log.textContent).toContain('sposta 1 da t1 a t2');
    expect(status.textContent).toContain('reinforce');
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
    expect(status.textContent).toContain('fortify');

    endTurnBtn.click();
    expect(log.textContent).toContain('termina il turno');
    expect(status.textContent).toContain('Player 2');
    expect(status.textContent).toContain('reinforce');
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
      Promise.resolve({ json: () => Promise.resolve(mapData) })
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
    expect(t1.style.background).toBe('');
  });

  test('army count text contrasts with player color', () => {
    const t1 = document.getElementById('t1');
    main.game.players[0].color = '#000000';
    ui.updateUI();
    expect(t1.style.color).toBe('rgb(255, 255, 255)');
    main.game.players[0].color = '#ffffff';
    ui.updateUI();
    expect(t1.style.color).toBe('rgb(0, 0, 0)');
  });

  test('startNewGame clears saved data', () => {
    localStorage.setItem('netriskPlayers', JSON.stringify([{ name: 'P1', color: '#000' }]));
    localStorage.setItem('netriskGame', 'dummy');
    expect(() => main.startNewGame()).not.toThrow();
    expect(localStorage.getItem('netriskPlayers')).toBeNull();
    expect(localStorage.getItem('netriskGame')).toBeNull();
  });

  test('runAI processes AI turns', () => {
    main.game.setCurrentPlayer(2); // ensure AI player
    const perform = jest
      .spyOn(main.game, 'performAITurn')
      .mockImplementation(() => {
        main.game.setPhase('gameover');
      });
    const uiSpy = jest.spyOn(ui, 'updateUI').mockImplementation(() => {});
    main.runAI();
    expect(perform).toHaveBeenCalled();
    expect(uiSpy).toHaveBeenCalled();
    perform.mockRestore();
    uiSpy.mockRestore();
  });
});

