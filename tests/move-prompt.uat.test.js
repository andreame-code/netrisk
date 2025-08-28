import askArmiesToMove from '../src/move-prompt.js';

describe('askArmiesToMove user input bounds', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('clamps below minimum', async () => {
    jest.spyOn(window, 'prompt').mockReturnValue('-5');
    const result = await askArmiesToMove(5, 1);
    expect(result).toBe(1);
  });

  test('clamps above maximum', async () => {
    jest.spyOn(window, 'prompt').mockReturnValue('10');
    const result = await askArmiesToMove(5, 1);
    expect(result).toBe(5);
  });

  test('defaults to max when input invalid', async () => {
    jest.spyOn(window, 'prompt').mockReturnValue('');
    const result = await askArmiesToMove(5, 1);
    expect(result).toBe(5);
  });

  test('returns 0 on cancel', async () => {
    jest.spyOn(window, 'prompt').mockReturnValue(null);
    const result = await askArmiesToMove(5, 1);
    expect(result).toBe(0);
  });
});
