import askArmiesToMove from '../src/move-prompt.js';

describe('askArmiesToMove', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('resolves 0 immediately when max <= 0', async () => {
    const result = await askArmiesToMove(0);
    expect(result).toBe(0);
    expect(document.getElementById('moveArmiesModal')).toBeNull();
  });

  test('prompts for armies and clamps value', async () => {
    const promise = askArmiesToMove(5, 1);
    const input = document.getElementById('moveArmiesInput');
    const button = document.getElementById('moveArmiesOk');
    input.value = '10';
    button.click();
    const result = await promise;
    expect(result).toBe(5);
    expect(document.getElementById('moveArmiesModal')).toBeNull();
  });
});
