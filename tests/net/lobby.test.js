import { describe, it, expect } from 'vitest'
import { createLobby, joinLobby, listPlayers } from '../../net/lobby.js'

function mockClient() {
  const players = []
  return {
    from(table) {
      if (table === 'lobbies') {
        return {
          insert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { id: 1 } }),
            }),
          }),
        }
      }
      if (table === 'players') {
        return {
          insert: (row) => {
            players.push(row)
            return Promise.resolve({ data: row })
          },
          select: () => ({
            eq: (col, value) =>
              Promise.resolve({
                data: players.filter((p) => p[col] === value),
              }),
          }),
        }
      }
      return {}
    },
  }
}

describe('lobby', () => {
  it('allows players to join and list players', async () => {
    const client = mockClient()
    await createLobby(client, 'room')
    await joinLobby(client, 1, 'Alice')
    const players = await listPlayers(client, 1)
    expect(players).toEqual(['Alice'])
  })
})
