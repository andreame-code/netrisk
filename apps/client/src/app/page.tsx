'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  canStartGame,
  calculateReinforcements,
  createInitialGameState,
  defaultGameRules,
} from '@netrisk/core';

const previewPlayerCount = 3;

export default function Home() {
  const previewState = useMemo(() => createInitialGameState('RISK-ALPHA'), []);
  const canLaunch = canStartGame(previewPlayerCount, defaultGameRules);
  const reinforcements = calculateReinforcements(9);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-4 text-center sm:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">netrisk platform</p>
          <h1 className="text-4xl font-semibold sm:text-5xl">Build &amp; battle in real time</h1>
          <p className="text-base text-slate-300 sm:max-w-2xl">
            Scaffolded with a shared core library, real-time Socket.IO backend, and a modern Next.js
            client ready for competitive strategy gameplay.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-medium text-slate-100">Session preview</h2>
            <p className="mt-2 text-sm text-slate-400">Game code</p>
            <p className="text-xl font-semibold text-emerald-400">{previewState.code}</p>
            <p className="mt-4 text-sm text-slate-400">Players ready</p>
            <p className="text-2xl font-semibold">{previewPlayerCount}</p>
          </article>
          <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-medium text-slate-100">Rule summary</h2>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              <li>
                Min players: <strong>{defaultGameRules.minPlayers}</strong>
              </li>
              <li>
                Max players: <strong>{defaultGameRules.maxPlayers}</strong>
              </li>
              <li>
                Reinforcement floor: <strong>{defaultGameRules.reinforcement.minimum}</strong>
              </li>
            </ul>
          </article>
          <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-lg font-medium text-slate-100">Status</h2>
            <p className="mt-2 text-sm text-slate-300">
              {canLaunch
                ? 'Enough commanders are assembled to start the campaign.'
                : 'Waiting for more commanders to join the lobby.'}
            </p>
            <p className="mt-4 text-sm text-slate-400">Reinforcements next turn</p>
            <p className="text-2xl font-semibold text-emerald-400">{reinforcements}</p>
          </article>
        </div>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/api/docs"
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
          >
            Explore API docs
          </Link>
          <Link
            href="https://github.com"
            className="inline-flex items-center justify-center rounded-full border border-slate-700 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500"
          >
            Read architecture guide
          </Link>
        </div>
      </section>
    </main>
  );
}
