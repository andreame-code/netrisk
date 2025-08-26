import EventBus from './src/core/event-bus.js';

export default function initPhaseTimer({ game, elementId = 'phaseTimer', duration = 60000, serverOffset = 0, onTimeout }) {
  const display = document.getElementById(elementId);
  let endTime = 0;
  let timerId;
  const getNow = () => Date.now() + serverOffset;

  function update() {
    const remaining = endTime - getNow();
    if (remaining <= 0) {
      if (display) display.textContent = '0';
      clearInterval(timerId);
      if (onTimeout) {
        onTimeout();
      } else if (game && typeof game.endTurn === 'function') {
        game.endTurn();
      }
      return;
    }
    if (display) display.textContent = Math.ceil(remaining / 1000).toString();
  }

  function start() {
    endTime = getNow() + duration;
    clearInterval(timerId);
    update();
    timerId = setInterval(update, 1000);
  }

  if (game && typeof game.on === 'function') {
    game.on('phaseChange', start);
    game.on('turnStart', start);
  } else if (game && game.events instanceof EventBus) {
    game.events.on('phaseChange', start);
    game.events.on('turnStart', start);
  }

  start();

  return {
    stop() {
      clearInterval(timerId);
    },
  };
}
