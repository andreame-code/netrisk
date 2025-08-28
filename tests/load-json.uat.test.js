import fs from 'node:fs';
import path from 'node:path';
import loadJson from '../src/utils/load-json.js';

describe('loadJson fetch handling', () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  test('returns data when fetch succeeds', async () => {
    const sample = { hello: 'world' };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(sample),
    });

    const result = await loadJson('/some-path');
    expect(fetch).toHaveBeenCalledWith('/some-path');
    expect(result).toEqual(sample);
  });

  test('throws when fetch fails and file is missing', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network'));
    await expect(loadJson('missing.json')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  test('throws SyntaxError when JSON is invalid', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockRejectedValue(new SyntaxError('bad json')),
    });

    const tmpFile = path.join(__dirname, 'tmp-invalid.json');
    fs.writeFileSync(tmpFile, '{ invalid');
    try {
      await expect(loadJson(tmpFile)).rejects.toThrow(SyntaxError);
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});

