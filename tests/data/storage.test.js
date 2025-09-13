import { describe, it, expect, beforeEach } from 'vitest'
import { saveState, loadState } from '../../data/storage.js'

beforeEach(() => localStorage.clear())

describe('storage', () => {
  it('saves and loads state', () => {
    const state = { a: 1 }
    saveState('key', state)
    expect(loadState('key')).toEqual(state)
  })

  it('returns null for missing state', () => {
    expect(loadState('missing')).toBeNull()
  })
})
