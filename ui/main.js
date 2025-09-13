export async function initClient(url, key) {
  const isNode = typeof process !== 'undefined' && process.versions?.node
  const { createClient } = isNode
    ? await import('@supabase/supabase-js')
    : await import('https://esm.sh/@supabase/supabase-js@2')
  return createClient(url, key)
}

export function renderPlayers(element, players) {
  element.innerHTML = ''
  if (players.length === 0) {
    const li = document.createElement('li')
    li.className = 'empty'
    li.textContent = 'No players yet'
    element.appendChild(li)
    return
  }
  for (const name of players) {
    const li = document.createElement('li')
    li.textContent = name
    element.appendChild(li)
  }
}
