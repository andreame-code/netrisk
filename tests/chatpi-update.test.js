const fs = require('fs');
const path = require('path');
const { spawnSync, execSync } = require('child_process');
const os = require('os');

const hasSystemd = spawnSync('systemd-run', ['--user', '--wait', '--pipe', 'true']);

(hasSystemd.status !== 0 ? describe.skip : describe)('chatpi systemd update', () => {
  const home = os.homedir();
  const systemdDir = path.join(home, '.config/systemd/user');
  const repoRoot = path.resolve(__dirname, '..');
  const systemdRepoDir = path.join(repoRoot, 'systemd');

  beforeAll(() => {
    fs.mkdirSync(systemdDir, { recursive: true });
    fs.copyFileSync(
      path.join(systemdRepoDir, 'chatpi.service'),
      path.join(systemdDir, 'chatpi.service'),
    );
    fs.copyFileSync(
      path.join(systemdRepoDir, 'chatpi-update.service'),
      path.join(systemdDir, 'chatpi-update.service'),
    );
    fs.copyFileSync(
      path.join(systemdRepoDir, 'chatpi-update.timer'),
      path.join(systemdDir, 'chatpi-update.timer'),
    );
    fs.copyFileSync(
      path.join(repoRoot, 'scripts', 'update.sh'),
      path.join(systemdDir, 'update.sh'),
    );
    fs.chmodSync(path.join(systemdDir, 'update.sh'), 0o755);
    execSync('systemctl --user daemon-reload');
  });

  afterAll(() => {
    try {
      execSync('systemctl --user stop chatpi-update.timer');
      execSync('systemctl --user stop chatpi.service');
    } catch (err) {
      // ignore cleanup errors
    }
  });

  test('timer triggers update script and restarts chatpi', () => {
    execSync('systemctl --user start chatpi.service');
    const logPath = path.join(home, 'chatpi.log');
    const initialLines = fs.existsSync(logPath)
      ? fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).length
      : 0;

    execSync('systemctl --user start chatpi-update.timer');
    const status = execSync('systemctl --user is-active chatpi-update.timer').toString().trim();
    expect(status).toBe('active');

    execSync('sleep 2');
    const updateLog = fs.readFileSync(path.join(home, 'chatpi-update.log'), 'utf8');
    expect(updateLog).toMatch(/update/);

    const afterLines = fs.readFileSync(logPath, 'utf8').trim().split('\n').filter(Boolean).length;
    expect(afterLines).toBeGreaterThan(initialLines);
  });
});
