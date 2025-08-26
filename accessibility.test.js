import { initAccessibility } from './accessibility.js';

describe('accessibility controls', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="accessibilityMenu">
        <button id="themeToggle" class="btn">High Contrast</button>
        <label for="fontScale">Font size:</label>
        <select id="fontScale">
          <option value="1">100%</option>
          <option value="1.5">150%</option>
        </select>
        <button id="colorBlindToggle" class="btn">Color Blind Mode</button>
      </div>`;
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  test('font scaling updates CSS variable and stores preference', () => {
    initAccessibility();
    const select = document.getElementById('fontScale');
    select.value = '1.5';
    select.dispatchEvent(new Event('change'));
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.5');
    expect(localStorage.getItem('font-scale')).toBe('1.5');
  });

  test('color blind toggle switches class and stores setting', () => {
    initAccessibility();
    const btn = document.getElementById('colorBlindToggle');
    btn.click();
    expect(document.body.classList.contains('colorblind')).toBe(true);
    expect(btn.textContent).toBe('Standard Colors');
    expect(localStorage.getItem('colorblind')).toBe('on');
  });
});
