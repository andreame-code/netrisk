import { initThemeToggle } from './theme.js';
import { goHome } from './navigation.js';
import supabase from './init/supabase-client.js';
import EventBus from './core/event-bus.js';

const bus = new EventBus();

let ws = null;
let heartbeatInterval = null;

const currentLobbies = [];
const playerNames = new Map();
let currentCode = null;
let currentPlayerId = null;
let chatHistoryLoaded = false;
const MAX_CHAT_LENGTH = 200;

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
  if (createBtn && dialog) {
    createBtn.addEventListener('click', () => {
      if (dialog.showModal) dialog.showModal();
      else dialog.setAttribute('open', '');
    });
  }
  if (form) {
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const name = document.getElementById('roomName').value.trim();
      const maxPlayers = parseInt(document.getElementById('maxPlayers').value, 10);
      const map = document.getElementById('map').value.trim();
      if (!name || isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 6) return;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        ws = new WebSocket('ws://localhost:8081');
        ws.onopen = () => {
          ws.send(
            JSON.stringify({
              type: 'createLobby',
              player: { name },
              maxPlayers,
              ...(map ? { map } : {}),
            })
          );
        };
        ws.onmessage = e => handleMessage(e, dialog);
      } else {
        ws.send(
          JSON.stringify({
            type: 'createLobby',
            player: { name },
            maxPlayers,
            ...(map ? { map } : {}),
          })
        );
      }
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
    ws = new WebSocket('ws://localhost:8081');
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'reconnect', code: storedCode, id: storedId }));
    };
    ws.onmessage = e => handleMessage(e, null);
  }
  fetchLobbies();
  if (supabase) {
    supabase
      .channel('public:lobbies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lobbies' }, () => {
        bus.emit('lobbiesChanged');
      })
      .subscribe();
    bus.on('lobbiesChanged', fetchLobbies);
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
