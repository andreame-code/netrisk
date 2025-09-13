import { describe, it, expect } from 'vitest'
import { createGameState, recordMove } from '../../game/state.js'

describe('game state', () => {
  it('creates initial state', () => {
    const gs = createGameState(['A', 'B'])
    expect(gs).toEqual({ turn: 0, players: ['A', 'B'], moves: [] })
  })

  it('records move and advances turn', () => {
    let gs = createGameState(['A'])
    gs = recordMove(gs, { from: 1, to: 2 })
    expect(gs.turn).toBe(1)
    expect(gs.moves).toEqual([{ from: 1, to: 2 }])
  })
})
