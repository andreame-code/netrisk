import initPhaseTimer from "../src/phase-timer.js";
import EventBus from "../src/core/event-bus.js";

jest.useFakeTimers();

afterEach(() => {
  jest.clearAllTimers();
});

function createGame() {
  const events = new EventBus();
  return {
    events,
    on: events.on.bind(events),
    endTurn: jest.fn(),
  };
}

test("displays countdown each second", () => {
  document.body.innerHTML = '<div id="phaseTimer"></div>';
  const game = createGame();
  initPhaseTimer({ game, duration: 3000 });

  const display = document.getElementById("phaseTimer");
  expect(display.textContent).toBe("3");
  jest.advanceTimersByTime(1000);
  expect(display.textContent).toBe("2");
  jest.advanceTimersByTime(1000);
  expect(display.textContent).toBe("1");
  jest.advanceTimersByTime(1000);
  expect(display.textContent).toBe("0");
});

test("invokes onTimeout when time elapses", () => {
  document.body.innerHTML = '<div id="phaseTimer"></div>';
  const game = createGame();
  const onTimeout = jest.fn();
  initPhaseTimer({ game, duration: 1000, onTimeout });

  jest.advanceTimersByTime(1000);
  expect(onTimeout).toHaveBeenCalled();
});

test("stop prevents countdown and timeout", () => {
  document.body.innerHTML = '<div id="phaseTimer"></div>';
  const game = createGame();
  const timer = initPhaseTimer({ game, duration: 3000 });

  timer.stop();
  jest.advanceTimersByTime(5000);

  expect(game.endTurn).not.toHaveBeenCalled();
  expect(document.getElementById("phaseTimer").textContent).toBe("3");
});
