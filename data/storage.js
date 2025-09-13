export function saveState(key, state) {
  localStorage.setItem(key, JSON.stringify(state))
}

export function loadState(key) {
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : null
}
