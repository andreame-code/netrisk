import { initThemeToggle } from './theme.js';
import { goHome } from './navigation.js';
import { WS_URL } from './config.js';
import EventBus from './core/event-bus.js';

const bus = new EventBus();

let ws = null;
let heartbeatInterval = null;
let supabase = null;

const currentLobbies = [];
const playerNames = new Map();
let currentCode = null;
let currentPlayerId = null;
let chatHistoryLoaded = false;
const MAX_CHAT_LENGTH = 200;

function notifyUser(msg) {
  if (typeof alert === 'function') {
    alert(msg);
  } else {
    console.error(msg); // eslint-disable-line no-console
  }
}

export function renderLobbies(lobbies) {
  const list = document.getElementById('lobbyList');
  if (!list) return;
  list.innerHTML = '';
  lobbies.forEach(lobby => {
    const li = document.createElement('li');
    const playerCount = Array.isArray(lobby.players) ? lobby.players.length : 0;
    const max = lobby.maxPlayers || 6;
    const status = lobby.started ? 'started' : 'open';
    li.textContent = `${lobby.code} – host: ${lobby.host} – players: ${playerCount}/${max} – map: ${lobby.map || '-' } – status: ${status}`;
    list.appendChild(li);
  });
}

async function fetchLobbies() {
  if (!supabase) {
    renderLobbies([]);
    return;
  }
  const { data } = await supabase.from('lobbies').select();
  currentLobbies.splice(0, currentLobbies.length, ...(data || []));
  renderLobbies(currentLobbies);
}

export function initLobby() {
  initThemeToggle();
  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', () => goHome());
  const createBtn = document.getElementById('createBtn');
  const dialog = document.getElementById('createDialog');
  const cancelBtn = document.getElementById('cancelCreate');
  const form = document.getElementById('createForm');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatMessages = document.getElementById('chatMessages');
  // populate map select from manifest
  (async () => {
    const select = document.getElementById('map');
    if (!select) return;
    try {
      const res = await fetch('./map-manifest.json');
      const data = await res.json();
      data.maps.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.name;
        select.appendChild(opt);
      });
    } catch {
      // ignore fetch errors
    }
  })();
  if (!WS_URL && createBtn) {
    createBtn.disabled = true;
    notifyUser('WebSocket server is not available.');
  }
  if (createBtn && dialog) {
    createBtn.addEventListener('click', () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  }
  if (cancelBtn && dialog) {
    cancelBtn.addEventListener('click', () => {
      if (dialog.close) dialog.close();
      else dialog.removeAttribute('open');
    });
  }
  async function createGame(payload, dlg) {
    console.log('window.__ENV:', window.__ENV); // eslint-disable-line no-console
    if (!window.__ENV || Object.keys(window.__ENV).length === 0) {
      notifyUser('Configuration error: env.js not loaded');
    }
    try {
      const session = supabase ? await supabase.auth.getSession() : null;
      console.log('Supabase session:', session); // eslint-disable-line no-console
    } catch (err) {
      console.error('Supabase getSession error:', err); // eslint-disable-line no-console
    }
    const url = WS_URL;
    console.log('Create Game URL:', url); // eslint-disable-line no-console
    console.log('Create Game payload:', payload); // eslint-disable-line no-console
    try {
      if (!url) {
        notifyUser('WebSocket server is not available.');
        return;
      }
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = new WebSocket(url);
        ws.onopen = () => {
          try {
            ws.send(
              JSON.stringify({
                type: 'createLobby',
                player: { name: payload.name },
                maxPlayers: payload.maxPlayers,
                ...(payload.map ? { map: payload.map } : {}),
              })
            );
          } catch (err2) {
            console.error('WebSocket send error:', err2); // eslint-disable-line no-console
            notifyUser(err2 instanceof Error ? err2.message : String(err2));
          }
        };
        ws.onmessage = e => handleMessage(e, dlg);
        ws.onerror = errEvent => {
          console.error('WebSocket connection error:', errEvent); // eslint-disable-line no-console
          notifyUser('WebSocket connection error.');
        };
        ws.onclose = () => notifyUser('WebSocket connection closed.');
      } else {
        ws.send(
          JSON.stringify({
            type: 'createLobby',
            player: { name: payload.name },
            maxPlayers: payload.maxPlayers,
            ...(payload.map ? { map: payload.map } : {}),
          })
        );
      }
    } catch (err) {
      console.error('createGame failed:', err); // eslint-disable-line no-console
      notifyUser(err instanceof Error ? err.message : String(err));
    }
  }

  if (form) {
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const name = document.getElementById('roomName').value.trim();
      const maxPlayers = parseInt(document.getElementById('maxPlayers').value, 10);
      const map = document.getElementById('map').value.trim();
      if (!name || isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 6) {
        if (typeof form.reportValidity === 'function') {
          form.reportValidity();
        }
        return;
      }
      createGame({ name, maxPlayers, map }, dialog);
    });
  }

  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', ev => {
      ev.preventDefault();
      let text = chatInput.value.trim();
      if (!text) return;
      if (text.length > MAX_CHAT_LENGTH) text = text.slice(0, MAX_CHAT_LENGTH);
      if (!ws || ws.readyState !== WebSocket.OPEN || !currentCode || !currentPlayerId) return;
      ws.send(
        JSON.stringify({ type: 'chat', code: currentCode, id: currentPlayerId, text })
      );
      chatInput.value = '';
    });
  }
  const storedCode = localStorage.getItem('lobbyCode');
  const storedId = localStorage.getItem('playerId');
  if (storedCode && storedId) {
    const url = WS_URL;
    if (url) {
      ws = new WebSocket(url);
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'reconnect', code: storedCode, id: storedId }));
      };
      ws.onmessage = e => handleMessage(e, null);
      ws.onerror = () => notifyUser('WebSocket connection error.');
      ws.onclose = () => notifyUser('WebSocket connection closed.');
    } else {
      notifyUser('WebSocket server is not available.');
    }
  }
  fetchLobbies();
  import('./init/supabase-client.js')
    .then(mod => {
      if (mod && Object.prototype.hasOwnProperty.call(mod, 'default')) {
        supabase = mod.default;
      } else {
        supabase = mod;
      }
      if (!supabase) return;
      fetchLobbies();
      supabase
        .channel('public:lobbies')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, () => {
          bus.emit('lobbiesChanged');
        })
        .subscribe();
      bus.on('lobbiesChanged', fetchLobbies);
    })
    .catch(() => {});

  function addChatMessage(id, text, time = new Date()) {
    if (!chatMessages) return;
    const li = document.createElement('li');
    const name = playerNames.get(id) || id;
    const ts = time instanceof Date ? time.toLocaleTimeString() : new Date(time).toLocaleTimeString();
    li.textContent = `[${ts}] ${name}: ${text}`;
    chatMessages.appendChild(li);
  }

  async function loadChatHistory() {
    if (chatHistoryLoaded || !supabase || !currentCode) return;
    chatHistoryLoaded = true;
    try {
      const { data } = await supabase
        .from('lobby_chat')
        .select()
        .eq('code', currentCode)
        .order('created_at', { ascending: true });
      (data || []).forEach(row => addChatMessage(row.id, row.text, new Date(row.created_at)));
    } catch {
      // ignore fetch errors
    }
  }

  function handleMessage(e, dlg) {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    console.log('WS response:', msg); // eslint-disable-line no-console
    switch (msg.type) {
      case 'joined': {
        currentCode = msg.code;
        currentPlayerId = msg.id;
        localStorage.setItem('lobbyCode', currentCode);
        localStorage.setItem('playerId', currentPlayerId);
        startHeartbeat();
        loadChatHistory();
        break;
      }
      case 'lobby': {
        currentCode = msg.code;
        if (!currentPlayerId) currentPlayerId = msg.host;
        playerNames.clear();
        (msg.players || []).forEach(p => {
          playerNames.set(p.id, p.name || p.id);
        });
        loadChatHistory();
        currentLobbies.push(msg);
        renderLobbies(currentLobbies);
        if (dlg && dlg.close) dlg.close();
        else if (dlg) dlg.removeAttribute('open');
        break;
      }
      case 'reconnected': {
        currentCode = msg.code;
        currentPlayerId = msg.player?.id || null;
        if (currentCode && currentPlayerId) {
          localStorage.setItem('lobbyCode', currentCode);
          localStorage.setItem('playerId', currentPlayerId);
          startHeartbeat();
        }
        break;
      }
      case 'chat': {
        addChatMessage(msg.id, msg.text, new Date());
        break;
      }
      case 'error': {
        notifyUser(msg.error || 'An error occurred.');
        break;
      }
      default:
        break;
    }
  }
}

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  if (!ws) return;
  heartbeatInterval = setInterval(() => {
    if (
      ws &&
      ws.readyState === WebSocket.OPEN &&
      currentCode &&
      currentPlayerId
    ) {
      ws.send(
        JSON.stringify({ type: 'heartbeat', code: currentCode, id: currentPlayerId })
      );
    }
  }, 30000);
}

initLobby();

export default { initLobby, renderLobbies };
