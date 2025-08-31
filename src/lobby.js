import { initThemeToggle } from './theme.js';
import * as navigation from './navigation.js';
import { WS_URL } from './config.js';
import { info as logInfo, error as logError } from './logger.js';
import createLobbyAdapter from './infra/supabase/lobby.adapter.ts';
import createAuthAdapter from './infra/supabase/auth.adapter.ts';
import createLobbyModel from './features/lobby/model/lobby-list.js';
import { renderLobbies as renderLobbiesUI } from './features/lobby/ui/lobby-list.js';

export { renderLobbiesUI as renderLobbies };

const lobbyPort = createLobbyAdapter();
const authPort = createAuthAdapter();
const lobbyModel = createLobbyModel(lobbyPort);

let ws = null;
let heartbeatInterval = null;
const currentLobbies = [];
const playerNames = new Map();
let currentCode = null;
let currentPlayerId = null;
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

async function fetchLobbies() {
  try {
    const lobbies = await lobbyModel.fetchLobbies();
    currentLobbies.splice(0, currentLobbies.length, ...(lobbies || []));
    renderLobbiesUI(currentLobbies);
    hideLobbyError();
  } catch {
    currentLobbies.splice(0, currentLobbies.length);
    renderLobbiesUI([]);
    showLobbyError('Impossibile caricare la lista delle lobby. Riprova.', fetchLobbies);
  }
}

export async function initLobby() {
  initThemeToggle();
  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', () => navigation.goHome());
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
    showLobbyError(
      'Supabase non è configurato. Riprova.',
      () => location.reload()
    );
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
      user = await authPort.currentUser({});
      logInfo('Requested Supabase session and user');
    } catch (err) {
      logError('Auth currentUser error', err?.message);
    }
    const url = WS_URL;
    const playerName = user?.name || user?.email;
    logInfo('Creating new game lobby');
    try {
      if (!url) {
        showLobbyError('Server multiplayer non disponibile. Riprova.', () => location.reload());
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
            showLobbyError('Impossibile connettersi al server multiplayer. Riprova.', () => createGame(payload, dlg));
          }
        };
        ws.onmessage = e => handleMessage(e, dlg);
        ws.onerror = errEvent => {
          logError('WebSocket connection error', errEvent?.message);
          showLobbyError('Impossibile connettersi al server multiplayer. Riprova.', () => createGame(payload, dlg));
        };
        ws.onclose = () =>
          showLobbyError('Connessione al server multiplayer persa. Riprova.', () => createGame(payload, dlg));
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
      showLobbyError('Impossibile creare la lobby. Riprova.', () => createGame(payload, dlg));
    }
  }
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const roomName = document.getElementById('roomName')?.value.trim();
      const maxPlayers = parseInt(document.getElementById('maxPlayers')?.value, 10);
      const map = document.getElementById('map')?.value || undefined;
      if (!roomName || Number.isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 8) {
        if (typeof form.reportValidity === 'function') form.reportValidity();
        return;
      }
      createGame({ roomName, maxPlayers, map }, dialog);
    });
  }
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', e => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text || text.length > MAX_CHAT_LENGTH) return;
      if (ws && ws.readyState === WebSocket.OPEN && currentCode && currentPlayerId) {
        ws.send(
          JSON.stringify({ type: 'chat', code: currentCode, id: currentPlayerId, text })
        );
      }
      chatInput.value = '';
    });
  }
  function addChatMessage(id, text, time = new Date()) {
    if (!chatMessages) return;
    const li = document.createElement('li');
    const name = playerNames.get(id) || id;
    const ts = time instanceof Date ? time.toLocaleTimeString() : new Date(time).toLocaleTimeString();
    li.textContent = `[${ts}] ${name}: ${text}`;
    chatMessages.appendChild(li);
  }
  async function loadChatHistory() {
    return;
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
        renderLobbiesUI(currentLobbies);
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
        showLobbyError('Si è verificato un errore. Riprova.', () => location.reload());
        break;
      }
      default:
        break;
    }
  }
  const storedCode = localStorage.getItem('lobbyCode');
  const storedId = localStorage.getItem('playerId');
  if (storedCode && storedId && WS_URL) {
    ws = new WebSocket(WS_URL);
    ws.onopen = () => {
      hideLobbyError();
      ws.send(JSON.stringify({ type: 'reconnect', code: storedCode, id: storedId }));
    };
    ws.onmessage = e => handleMessage(e, null);
    ws.onerror = () =>
      showLobbyError('Impossibile connettersi al server multiplayer. Riprova.', () => {
        location.reload();
      });
    ws.onclose = () =>
      showLobbyError('Connessione al server multiplayer persa. Riprova.', () => {
        location.reload();
      });
  } else if (storedCode || storedId) {
    localStorage.removeItem('lobbyCode');
    localStorage.removeItem('playerId');
  }
  try {
    const user = await authPort.currentUser({});
    if (!user) {
      const redirectPath = window.location.pathname + window.location.search;
      navigation.navigateTo(`login.html?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }
  } catch (err) {
    logError('Auth currentUser error', err?.message);
    const redirectPath = window.location.pathname + window.location.search;
    navigation.navigateTo(`login.html?redirect=${encodeURIComponent(redirectPath)}`);
    return;
  }
  await fetchLobbies();
  lobbyModel.subscribe(() => {
    fetchLobbies();
  });
  try {
    const { exists } = await authPort.session({});
    if (!exists) {
      if (createBtn) createBtn.disabled = true;
      showLobbyError('Effettua il login per creare una lobby.');
    }
  } catch (err) {
    logError('Auth session error', err?.message);
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

export default { initLobby, renderLobbies: renderLobbiesUI };
