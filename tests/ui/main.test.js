import { describe, it, expect } from 'vitest'
import { initClient, renderPlayers } from '../../ui/main.js'

// @vitest-environment jsdom

describe('ui helpers', () => {
  it('renders player names', () => {
    const ul = document.createElement('ul')
    renderPlayers(ul, ['Alice', 'Bob'])
    expect([...ul.children].map((li) => li.textContent)).toEqual([
      'Alice',
      'Bob',
    ])
  })

  it('initializes a supabase client', async () => {
    const client = await initClient('https://example.supabase.co', 'anon')
    expect(client).toHaveProperty('from')
  })
})
