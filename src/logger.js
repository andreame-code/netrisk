let overlay;
let logBox;
if (typeof document !== 'undefined') {
  overlay = document.createElement('div');
  overlay.id = 'error-overlay';
  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    background: 'rgba(255,0,0,0.9)',
    color: '#fff',
    padding: '4px',
    zIndex: '1000',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  });
  overlay.classList.add('hidden');
  document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(overlay);
    logBox = document.getElementById('debugLog');
  });
}

function showError(message) {
  if (overlay) {
    overlay.textContent = message;
    overlay.classList.remove('hidden');
  }
}

function appendLog(level, args) {
  if (typeof document === 'undefined') return;
  if (!logBox) logBox = document.getElementById('debugLog');
  if (!logBox) return;
  const line = document.createElement('div');
  const text = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  line.textContent = `[${level}] ${text}`;
  if (typeof logBox.prepend === 'function') logBox.prepend(line);
  else logBox.insertBefore(line, logBox.firstChild);
}

export function info(...args) {
  console.log('[INFO]', ...args);
  appendLog('INFO', args);
}

export function warn(...args) {
  console.warn('[WARN]', ...args);
  appendLog('WARN', args);
}

export function error(...args) {
  console.error('[ERROR]', ...args);
  appendLog('ERROR', args);
}

if (typeof window !== 'undefined') {
  window.onerror = function (msg) {
    error(msg);
    showError(msg);
  };

  window.onunhandledrejection = function (event) {
    const msg = event.reason && event.reason.message ? event.reason.message : String(event.reason);
    error(msg);
    showError(msg);
  };
}
