const http = require('http');

describe('API CORS', () => {
  let server;

  beforeAll((done) => {
    process.env.PORT = 0;
    global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => [] }));
    server = require('../server');
    server.on('listening', done);
  });

  afterAll((done) => {
    server.close(done);
  });

  const send = (method, origin) =>
    new Promise((resolve, reject) => {
      const port = server.address().port;
      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/api/login',
          method,
          headers: {
            'Content-Type': 'application/json',
            Origin: origin,
          },
        },
        (res) => {
          res.on('data', () => {});
          res.on('end', () => resolve(res));
        }
      );
      req.on('error', reject);
      if (method === 'POST') {
        req.write(JSON.stringify({ username: 'a', password: 'b' }));
      }
      req.end();
    });

  test('allows requests from whitelisted origin', async () => {
    const res = await send('POST', 'https://andreame-code.github.io');
    expect(res.statusCode).not.toBe(403);
    expect(res.headers['access-control-allow-origin']).toBe('https://andreame-code.github.io');
  });

  test('rejects requests from unapproved origin', async () => {
    const res = await send('OPTIONS', 'https://evil.example.com');
    expect(res.statusCode).toBe(403);
  });
});

