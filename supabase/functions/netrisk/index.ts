import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { initialState, applyAction, publicState, Player, Action } from './rules.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey);

interface RequestBody {
  action: string;
  [key: string]: any;
}

function jsonResponse(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method not allowed' }, { status: 405 });
  }

  const body: RequestBody = await req.json();

  try {
    switch (body.action) {
      case 'create_match': {
        const player: Player = body.player;
        const { data: match } = await supabase
          .from('matches')
          .insert({})
          .select()
          .single();
        const { data: p } = await supabase
          .from('players')
          .insert({ match_id: match.id, name: player.name, color: player.color })
          .select()
          .single();
        const state = initialState([{ id: p.id, name: p.name, color: p.color }]);
        await supabase.from('game_states').insert({ match_id: match.id, state });
        await supabase.from('events').insert({
          match_id: match.id,
          player_id: p.id,
          action: { type: 'create_match' },
          result: null,
        });
        return jsonResponse({ matchId: match.id, playerId: p.id, state: publicState(state) });
      }
      case 'join_match': {
        const { matchId, player } = body;
        const { data: p } = await supabase
          .from('players')
          .insert({ match_id: matchId, name: player.name, color: player.color })
          .select()
          .single();
        const gs = await supabase
          .from('game_states')
          .select('id,state')
          .eq('match_id', matchId)
          .single();
        const state: any = gs.data.state;
        state.players.push({ id: p.id, name: p.name, color: p.color });
        await supabase
          .from('game_states')
          .update({ state, updated_at: new Date().toISOString() })
          .eq('id', gs.data.id);
        await supabase.from('events').insert({
          match_id: matchId,
          player_id: p.id,
          action: { type: 'join_match' },
          result: null,
        });
        return jsonResponse({ playerId: p.id, state: publicState(state) });
      }
      case 'start_match': {
        const { matchId } = body;
        const { data: players } = await supabase
          .from('players')
          .select('id,name,color')
          .eq('match_id', matchId)
          .order('created_at', { ascending: true });
        let state = initialState(players);
        state.phase = 'active';
        state.currentPlayer = players[0]?.id ?? null;
        await supabase
          .from('game_states')
          .update({ state, updated_at: new Date().toISOString() })
          .eq('match_id', matchId);
        await supabase
          .from('matches')
          .update({ status: 'active' })
          .eq('id', matchId);
        await supabase.from('events').insert({
          match_id: matchId,
          action: { type: 'start_match' },
          result: null,
        });
        return jsonResponse({ state: publicState(state) });
      }
      case 'action': {
        const { matchId, playerId, action } = body as {
          matchId: string;
          playerId: string;
          action: Action;
        };
        const gs = await supabase
          .from('game_states')
          .select('id,state')
          .eq('match_id', matchId)
          .single();
        const { state, result } = applyAction(gs.data.state, action);
        await supabase
          .from('game_states')
          .update({ state, updated_at: new Date().toISOString() })
          .eq('id', gs.data.id);
        await supabase.from('events').insert({
          match_id: matchId,
          player_id: playerId,
          action,
          result,
        });
        return jsonResponse({ state: publicState(state), result });
      }
      default:
        return jsonResponse({ error: 'unknown action' }, { status: 400 });
    }
  } catch (err) {
    return jsonResponse({ error: String(err) }, { status: 500 });
  }
});
