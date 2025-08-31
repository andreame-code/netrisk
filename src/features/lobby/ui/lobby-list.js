export function renderLobbies(lobbies) {
  const list = document.getElementById('lobbyList');
  if (!list) return;
  list.innerHTML = '';
  lobbies.forEach(lobby => {
    const li = document.createElement('li');
    const playerCount =
      Array.isArray(lobby.players)
        ? lobby.players.length
        : lobby.playerCount ?? 0;
    const max = lobby.maxPlayers || lobby.max_players || 8;
    const status = lobby.started ? 'started' : 'open';
    const code = lobby.code || lobby.id || '';
    li.textContent = `${code} – host: ${lobby.host || ''} – players: ${playerCount}/${max} – map: ${lobby.map || '-'} – status: ${status}`;
    list.appendChild(li);
  });
}
