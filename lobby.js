import { initThemeToggle } from './theme.js';
import { goHome } from './navigation.js';
import supabase from './src/init/supabase-client.js';
import EventBus from './src/core/event-bus.js';

const bus = new EventBus();

let ws = null;

const currentLobbies = [];

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
        ws.onmessage = e => {
          let msg;
          try {
            msg = JSON.parse(e.data);
          } catch {
            return;
          }
          if (msg.type === 'lobby') {
            currentLobbies.push(msg);
            renderLobbies(currentLobbies);
            if (dialog.close) dialog.close();
            else dialog.removeAttribute('open');
          }
        };
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
}

initLobby();

export default { initLobby, renderLobbies };
