/* global logger */
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

fetch('map.svg')
  .then((r) => r.text())
  .then((svg) => {
    document.getElementById('board').innerHTML = svg;
    const map = document.getElementById('board').querySelector('#map');
    map.addEventListener('click', (e) => {
      const target = e.target.closest('.map-territory');
      if (target) {
        selectTerritory(target);
      } else {
        selectTerritory(null);
      }
      e.stopPropagation();
    });
    document.addEventListener('click', (e) => {
      if (!map.contains(e.target)) {
        selectTerritory(null);
      }
    });
  });
