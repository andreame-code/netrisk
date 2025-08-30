jest.mock('../src/init/supabase-client.js', () => ({
  __esModule: true,
  default: {
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({}),
      signInAnonymously: jest.fn().mockResolvedValue({}),
    },
  },
}));

describe('login page', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    document.body.innerHTML = `
      <form id="loginForm">
        <input id="username" />
        <input id="password" />
        <button type="submit" class="btn">Login</button>
        <a id="registerBtn" class="btn" href="./register.html">Register</a>
        <button type="button" id="anonymousBtn" class="btn">Login anonymously</button>
      </form>
      <p id="message" role="alert"></p>
    `;
  });

  test('anonymous login uses supabase', () => {
    const { default: supabase } = require('../src/init/supabase-client.js');
    require('../src/login.js');
    document.getElementById('anonymousBtn').click();
    expect(supabase.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });
});
