import { colorPalette } from './colors.js';
jest.mock('./navigation.js', () => ({ navigateTo: jest.fn() }));

function setupDOM() {
  document.body.innerHTML = `
      <form id="setupForm">
        <input id="humanCount" />
        <input id="aiCount" />
        <div id="players"></div>
        <select id="mapSelect">
          <option value="map">Classic</option>
          <option value="map2">Desert</option>
          <option value="map-roman">Roman Empire</option>
        </select>
      </form>`;
  }

describe('setup map selection', () => {
  beforeEach(() => {
    setupDOM();
    localStorage.clear();
    // mock colorPalette usage
    window.alert = jest.fn();
  });

  test('saves selected map to localStorage and navigates to game', () => {
    const { navigateTo } = require('./navigation.js');
    require('./setup.js');
    document.getElementById('humanCount').value = '1';
    document.getElementById('aiCount').value = '0';
    // setup.js rendered player input
    document.getElementById('name0').value = 'P1';
    document.getElementById('color0').value = colorPalette[0];
      const mapSel = document.getElementById('mapSelect');
      mapSel.value = 'map-roman';
      document.getElementById('setupForm').dispatchEvent(new Event('submit'));
      expect(localStorage.getItem('netriskMap')).toBe('map-roman');
      expect(navigateTo).toHaveBeenCalledWith('index.html');
    });
  });
