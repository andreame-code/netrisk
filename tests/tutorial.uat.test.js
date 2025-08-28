
describe('tutorial', () => {
  beforeEach(() => {
    jest.resetModules();
    localStorage.clear();
    document.body.innerHTML = '<div id="board"></div><div id="uiPanel"></div><div id="actionLog"></div>' +
      '<button id="endTurn"></button><button id="startGame"></button>';
    Object.defineProperty(navigator, 'language', { value: 'en', configurable: true });
  });

  test('uses English translations by default', () => {
    const { startTutorial } = require('../src/tutorial.js');
    startTutorial();
    const overlay = document.getElementById('tutorialOverlay');
    const buttons = overlay.querySelectorAll('button');
    expect(buttons[0].textContent).toBe('Next');
    expect(buttons[1].textContent).toBe('Skip');
  });

  test('supports Italian translations', () => {
    Object.defineProperty(navigator, 'language', { value: 'it', configurable: true });
    const { startTutorial } = require('../src/tutorial.js');
    startTutorial();
    const overlay = document.getElementById('tutorialOverlay');
    const buttons = overlay.querySelectorAll('button');
    expect(buttons[0].textContent).toBe('Avanti');
    expect(buttons[1].textContent).toBe('Salta');
  });

  test('tracks steps and highlights elements', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { startTutorial } = require('../src/tutorial.js');
    startTutorial();
    const overlay = document.getElementById('tutorialOverlay');
    expect(overlay.querySelector('#tutorialHighlight')).not.toBeNull();
    expect(logSpy).toHaveBeenCalledWith('analytics', 'tutorial_start', undefined);
    expect(logSpy).toHaveBeenCalledWith('analytics', 'tutorial_step', 0);
    overlay.querySelector('button').click();
    expect(logSpy).toHaveBeenCalledWith('analytics', 'tutorial_step', 1);
    logSpy.mockRestore();
  });

  test('completes and starts game when confirmed', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const startBtn = document.getElementById('startGame');
    const startSpy = jest.spyOn(startBtn, 'click');
    const { startTutorial } = require('../src/tutorial.js');
    startTutorial();
    let overlay = document.getElementById('tutorialOverlay');
    for (let i = 0; i < 4; i++) {
      overlay.querySelector('button').click();
      overlay = document.getElementById('tutorialOverlay') || overlay;
    }
    expect(logSpy).toHaveBeenCalledWith('analytics', 'tutorial_complete', undefined);
    expect(localStorage.getItem('tutorialCompleted')).toBe('true');
    expect(document.getElementById('tutorialOverlay')).toBeNull();
    expect(startSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  test('user can cancel and restart tutorial', () => {
    document.body.innerHTML += '<button id="playTutorial"></button><button id="replayTutorial"></button>';
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const startClick = jest.spyOn(document.getElementById('startGame'), 'click');
    const tutorial = require('../src/tutorial.js');
    tutorial.initTutorialButtons();
    document.getElementById('playTutorial').click();
    let overlay = document.getElementById('tutorialOverlay');
    overlay.querySelectorAll('button')[1].click(); // skip
    expect(startClick).not.toHaveBeenCalled();
    tutorial.initTutorialButtons();
    expect(document.getElementById('playTutorial').classList.contains('hidden')).toBe(true);
    document.getElementById('replayTutorial').click();
    expect(document.getElementById('tutorialOverlay')).not.toBeNull();
    logSpy.mockRestore();
  });
});
