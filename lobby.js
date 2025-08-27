import { initThemeToggle } from './theme.js';
import { goHome } from './navigation.js';
import supabase from './src/init/supabase-client.js';
import EventBus from './src/core/event-bus.js';

const bus = new EventBus();

export function renderLobbies(lobbies) {
  const list = document.getElementById('lobbyList');
  if (!list) return;
  list.innerHTML = '';
  lobbies.forEach(lobby => {
    const li = document.createElement('li');
    const playerCount = Array.isArray(lobby.players) ? lobby.players.length : 0;
    const status = lobby.started ? 'started' : 'open';
    li.textContent = `${lobby.code} – host: ${lobby.host} – players: ${playerCount}/6 – map: ${lobby.map || '-' } – status: ${status}`;
    list.appendChild(li);
  });
}

async function fetchLobbies() {
  if (!supabase) {
    renderLobbies([]);
    return;
  }
  const { data } = await supabase.from('lobbies').select();
  renderLobbies(data || []);
}

export function initLobby() {
  initThemeToggle();
  const backBtn = document.getElementById('backBtn');
  if (backBtn) backBtn.addEventListener('click', () => goHome());
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
