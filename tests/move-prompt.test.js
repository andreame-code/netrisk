import askArmiesToMove from '../src/move-prompt.js';

describe('askArmiesToMove', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('resolves 0 immediately when max <= 0', async () => {
    const spy = jest.spyOn(window, 'prompt');
    const result = await askArmiesToMove(0);
    expect(result).toBe(0);
    expect(spy).not.toHaveBeenCalled();
  });

  test('prompts for armies and clamps value', async () => {
    const spy = jest.spyOn(window, 'prompt').mockReturnValue('10');
    const result = await askArmiesToMove(5, 1);
    expect(spy).toHaveBeenCalledWith('How many armies to move? (1-5)', '5');
    expect(result).toBe(5);
  });
});
