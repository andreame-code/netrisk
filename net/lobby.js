export function createLobby(client, name) {
  return client.from('lobbies').insert({ name }).select().single()
}

export function joinLobby(client, lobbyId, player) {
  return client.from('players').insert({ lobby_id: lobbyId, name: player })
}

export async function listPlayers(client, lobbyId) {
  const { data } = await client
    .from('players')
    .select('name')
    .eq('lobby_id', lobbyId)
  return data?.map((p) => p.name) || []
}
