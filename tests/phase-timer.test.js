import initPhaseTimer from '../phase-timer.js';
import EventBus from '../src/core/event-bus.js';

jest.useFakeTimers();

function createGame() {
  const events = new EventBus();
  return {
    events,
    on: events.on.bind(events),
    endTurn: jest.fn(),
  };
}

test('calls endTurn when timer expires', () => {
  document.body.innerHTML = '<div id="phaseTimer"></div>';
  const game = createGame();
  initPhaseTimer({ game, duration: 1000 });
  jest.advanceTimersByTime(1000);
  expect(game.endTurn).toHaveBeenCalled();
});

test('resets on phase change', () => {
  document.body.innerHTML = '<div id="phaseTimer"></div>';
  const game = createGame();
  initPhaseTimer({ game, duration: 1000 });
  jest.advanceTimersByTime(500);
  game.events.emit('phaseChange');
  jest.advanceTimersByTime(700);
  expect(game.endTurn).not.toHaveBeenCalled();
  jest.advanceTimersByTime(300);
  expect(game.endTurn).toHaveBeenCalled();
});
