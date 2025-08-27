import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const functionUrl = `${SUPABASE_URL}/functions/v1/netrisk`;

async function call(body: any) {
  const res = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const createMatch = (player: any) =>
  call({ action: 'create_match', player });
export const joinMatch = (matchId: string, player: any) =>
  call({ action: 'join_match', matchId, player });
export const startMatch = (matchId: string) =>
  call({ action: 'start_match', matchId });
export const sendAction = (
  matchId: string,
  playerId: string,
  action: any
) => call({ action: 'action', matchId, playerId, action });

export default { createMatch, joinMatch, startMatch, sendAction };
