/* global logger game addLogEntry gameState attachTerritoryHandlers updateUI */
let selectedTerritory = null;
const infoPanel = document.getElementById('selectedTerritory');

function selectTerritory(el) {
  if (selectedTerritory && selectedTerritory.el) {
    selectedTerritory.el.classList.remove('selected');
  }
  if (el) {
    const name = el.dataset.name || el.id;
    el.classList.add('selected');
    selectedTerritory = { id: el.id, name, el };
    infoPanel.textContent = name;
    if (typeof logger !== 'undefined') {
      logger.info(`Selected territory: ${selectedTerritory.id} (${selectedTerritory.name})`);
    }
  } else {
    selectedTerritory = null;
    infoPanel.textContent = '';
  }
}

function moveToken(el) {
  if (!el) return;
  const phase = typeof game !== 'undefined' ? game.getPhase() : null;
  if (phase && !['attack', 'fortify'].includes(phase)) {
    if (typeof addLogEntry !== 'undefined') {
      addLogEntry(`Movimento non consentito nella fase ${phase}`);
    }
    return;
  }
  const box = el.getBBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const token = document.getElementById('token');
  if (token) {
    token.style.left = `${x}px`;
    token.style.top = `${y}px`;
  }
  if (typeof gameState !== 'undefined') {
    gameState.tokenPosition = { x, y };
  }
  if (typeof addLogEntry !== 'undefined' && typeof game !== 'undefined') {
    const name = el.dataset.name || el.id;
    addLogEntry(`${game.players[game.currentPlayer].name} muove il segnalino su ${name}`);
    if (typeof logger !== 'undefined') {
      logger.info(`${game.players[game.currentPlayer].name} moves token to ${name}`);
    }
  }
}

const moveBtn = document.getElementById('moveToken');
if (moveBtn) {
  moveBtn.addEventListener('click', () => {
    if (typeof logger !== 'undefined') {
      logger.info('Move token clicked');
    }
    try {
      if (selectedTerritory) {
        moveToken(selectedTerritory.el);
      } else if (typeof addLogEntry !== 'undefined') {
        addLogEntry('Nessun territorio selezionato');
      }
    } catch (err) {
      if (typeof logger !== 'undefined') {
        logger.error(err);
      }
    }
  });
}

fetch('map.svg')
  .then((r) => r.text())
  .then((svg) => {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = svg;
    const tokenEl = document.createElement('div');
    tokenEl.id = 'token';
    tokenEl.className = 'token';
    boardEl.appendChild(tokenEl);
    if (typeof game !== 'undefined') {
      game.territories.forEach((t) => {
        const terrEl = document.createElement('div');
        terrEl.id = t.id;
        terrEl.className = 'territory';
        terrEl.dataset.id = t.id;
        boardEl.appendChild(terrEl);
      });
      if (typeof attachTerritoryHandlers === 'function') {
        attachTerritoryHandlers();
      }
      if (typeof updateUI === 'function') {
        updateUI();
      }
    }
    if (typeof gameState !== 'undefined' && gameState.tokenPosition) {
      tokenEl.style.left = `${gameState.tokenPosition.x}px`;
      tokenEl.style.top = `${gameState.tokenPosition.y}px`;
    }
    const map = boardEl.querySelector('#map');
    map.addEventListener('click', (e) => {
      const target = e.target.closest('.map-territory');
      if (target) {
        selectTerritory(target);
      } else {
        selectTerritory(null);
      }
      e.stopPropagation();
    });
    map.addEventListener('dblclick', (e) => {
      const target = e.target.closest('.map-territory');
      if (target) {
        selectTerritory(target);
        moveToken(target);
      }
      e.stopPropagation();
    });
    document.addEventListener('click', (e) => {
      if (!map.contains(e.target)) {
        selectTerritory(null);
      }
    });
  })
  .catch((err) => {
    if (typeof logger !== 'undefined') {
      logger.error(err);
    }
  });
