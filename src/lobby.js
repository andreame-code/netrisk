import { initThemeToggle } from './theme.js';
import { goHome } from './navigation.js';
import { WS_URL } from './config.js';
import EventBus from './core/event-bus.js';
import { info as logInfo, error as logError } from './logger.js';

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

const lobbyErrorEl = document.getElementById('lobbyError');
const lobbyErrorMsg = document.getElementById('lobbyErrorMsg');
const retryBtn = document.getElementById('retryLobby');
let retryAction = null;

function showLobbyError(message, action) {
  if (lobbyErrorEl && lobbyErrorMsg && retryBtn) {
    lobbyErrorMsg.textContent = message;
    lobbyErrorEl.classList.remove('hidden');
    retryAction = action;
  } else {
    notifyUser(message);
  }
}

function hideLobbyError() {
  if (lobbyErrorEl) lobbyErrorEl.classList.add('hidden');
  retryAction = null;
}

if (retryBtn) {
  retryBtn.addEventListener('click', () => {
    const action = retryAction;
    hideLobbyError();
    if (typeof action === 'function') action();
  });
}

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
    const max = lobby.maxPlayers || 8;
    const status = lobby.started ? 'started' : 'open';
    li.textContent = `${lobby.code} – host: ${lobby.host} – players: ${playerCount}/${max} – map: ${lobby.map || '-' } – status: ${status}`;
    list.appendChild(li);
  });
}

async function fetchLobbies() {
  if (!supabase) {
    renderLobbies([]);
    logError('Supabase not initialized; cannot fetch lobbies');
    showLobbyError('Unable to load lobby list. Check your connection and try again.', fetchLobbies);
    return;
  }
  try {
    logInfo('Fetching lobbies from database');
    const { data, error } = await supabase.from('lobbies').select();
    if (error) {
      logError('Error fetching lobbies', error.message);
      showLobbyError('Unable to load lobby list. Check your connection and try again.', fetchLobbies);
      return;
    }
    currentLobbies.splice(0, currentLobbies.length, ...(data || []));
    renderLobbies(currentLobbies);
    hideLobbyError();
    logInfo(`Loaded ${currentLobbies.length} lobbies`);
  } catch (err) {
    logError('Unexpected error fetching lobbies', err?.message);
    showLobbyError('Unable to load lobby list. Check your connection and try again.', fetchLobbies);
  }
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
    let res;
    try {
      res = await fetch('./assets/maps/map-manifest.json');
      if (res && res.ok === false) throw new Error('not ok');
    } catch {
      try {
        res = await fetch('./public/assets/maps/map-manifest.json');
        if (res && res.ok === false) throw new Error('not ok');
      } catch {
        return;
      }
    }
    try {
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
    showLobbyError('Multiplayer server is not available.', () => location.reload());
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
    let user = null;
    try {
      if (supabase) {
        await supabase.auth.getSession();
        ({ data: { user } = {} } = await supabase.auth.getUser());
        logInfo('Requested Supabase session and user');
      }
    } catch (err) {
      logError('Supabase getSession/getUser error', err?.message);
    }
    const url = WS_URL;
    const playerName = user?.user_metadata?.username || user?.email;
    logInfo('Creating new game lobby');
    try {
      if (!url) {
        showLobbyError('Multiplayer server is not available.', () => location.reload());
        return;
      }
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = new WebSocket(url);
        ws.onopen = () => {
          hideLobbyError();
          try {
            ws.send(
              JSON.stringify({
                type: 'createLobby',
                name: payload.roomName,
                player: { name: playerName },
                maxPlayers: payload.maxPlayers,
                ...(payload.map ? { map: payload.map } : {}),
              })
            );
          } catch (err2) {
            logError('WebSocket send error', err2?.message);
            showLobbyError('Unable to connect to multiplayer server. Please try again.', () => createGame(payload, dlg));
          }
        };
        ws.onmessage = e => handleMessage(e, dlg);
        ws.onerror = errEvent => {
          logError('WebSocket connection error', errEvent?.message);
          showLobbyError('Unable to connect to multiplayer server. Please try again.', () => createGame(payload, dlg));
        };
        ws.onclose = () =>
          showLobbyError('Connection to multiplayer server lost. Please try again.', () => createGame(payload, dlg));
      } else {
        ws.send(
          JSON.stringify({
            type: 'createLobby',
            name: payload.roomName,
            player: { name: playerName },
            maxPlayers: payload.maxPlayers,
            ...(payload.map ? { map: payload.map } : {}),
          })
        );
      }
    } catch (err) {
      logError('createGame failed', err?.message);
      showLobbyError('Unable to create lobby. Please try again.', () => createGame(payload, dlg));
    }
  }

  if (form) {
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const roomName = document.getElementById('roomName').value.trim();
      const maxPlayers = parseInt(document.getElementById('maxPlayers').value, 10);
      const map = document.getElementById('map').value.trim();
      if (!roomName || isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) {
        if (typeof form.reportValidity === 'function') {
          form.reportValidity();
        }
        return;
      }
      createGame({ roomName, maxPlayers, map }, dialog);
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
        hideLobbyError();
        ws.send(JSON.stringify({ type: 'reconnect', code: storedCode, id: storedId }));
      };
      ws.onmessage = e => handleMessage(e, null);
      ws.onerror = () =>
        showLobbyError('Unable to connect to multiplayer server. Please try again.', () => {
          location.reload();
        });
      ws.onclose = () =>
        showLobbyError('Connection to multiplayer server lost. Please try again.', () => {
          location.reload();
        });
    } else {
      showLobbyError('Multiplayer server is not available.', () => location.reload());
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
      if (!supabase) {
        logError('Supabase client not initialized');
        return;
      }
      logInfo('Supabase client ready on lobby page');
      fetchLobbies();
      supabase
        .channel('public:lobbies')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, () => {
          bus.emit('lobbiesChanged');
        })
        .subscribe();
      bus.on('lobbiesChanged', fetchLobbies);
    })
    .catch(err => {
      logError('Failed to load Supabase client', err?.message);
    });

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
      logInfo(`Loading chat history for ${currentCode}`);
      const { data, error } = await supabase
        .from('lobby_chat')
        .select()
        .eq('code', currentCode)
        .order('created_at', { ascending: true });
      if (error) {
        logError('Error loading chat history', error.message);
        return;
      }
      (data || []).forEach(row => addChatMessage(row.id, row.text, new Date(row.created_at)));
    } catch (err) {
      logError('Unexpected error loading chat history', err?.message);
    }
  }

  function handleMessage(e, dlg) {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    logInfo(`WS response type: ${msg.type}`);
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
        showLobbyError('An error occurred. Please try again.', () => location.reload());
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
