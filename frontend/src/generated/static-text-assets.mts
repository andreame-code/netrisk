export const staticHtmlAssets = {
  "index.html": String.raw`<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title data-i18n="landing.meta.title">Frontline Dominion - Conquista il Mondo</title>
    <meta
      name="description"
      content="Gioco di strategia a turni multiplayer. Conquista territori, comanda le armate, domina il teatro di guerra. Gratuito, niente da installare."
      data-i18n-content="landing.meta.description"
    />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/landing.css" />
    <link rel="stylesheet" href="/shell.css" />
    <script type="module" src="/speed-insights.mjs"></script>
  </head>
  <body data-shell-kind="marketing">
    <a class="skip-link" href="#main-content" data-i18n="common.skipToContent">Salta al contenuto principale</a>
    <header class="ld-header" id="top">
      <div class="ld-container ld-header-inner">
        <a href="/" class="ld-brand">
          <span class="ld-brand-eyebrow">NetRisk</span>
          <span class="ld-brand-name">Frontline Dominion</span>
        </a>
        <button
          type="button"
          class="ld-menu-toggle"
          data-landing-menu-toggle
          aria-expanded="false"
          aria-controls="landing-mobile-nav"
          aria-label="Apri menu"
          data-i18n-aria-label="landing.nav.menuOpen"
        >
          <span class="ld-menu-toggle-icon" aria-hidden="true"></span>
          <span data-landing-menu-label data-i18n="landing.nav.menuOpen">Apri menu</span>
        </button>
        <nav class="ld-nav-links" aria-label="Navigazione principale" data-i18n-aria-label="landing.nav.primaryAria">
          <a href="#features" data-i18n="landing.nav.features">Caratteristiche</a>
          <a href="#maps" data-i18n="landing.nav.maps">Mappe</a>
          <a href="#howtoplay" data-i18n="landing.nav.howToPlay">Come si gioca</a>
        </nav>
        <div class="ld-nav-actions">
          <div data-landing-locale></div>
          <a href="/lobby.html" class="ld-btn-ghost" data-i18n="auth.login">Accedi</a>
          <a href="/register.html" class="ld-btn-primary" data-i18n="auth.register">Registrati</a>
        </div>
      </div>
      <div class="ld-container ld-mobile-panel" id="landing-mobile-nav" data-landing-mobile-panel hidden>
        <nav class="ld-mobile-links" aria-label="Navigazione principale" data-i18n-aria-label="landing.nav.primaryAria">
          <a href="#features" data-i18n="landing.nav.features">Caratteristiche</a>
          <a href="#maps" data-i18n="landing.nav.maps">Mappe</a>
          <a href="#howtoplay" data-i18n="landing.nav.howToPlay">Come si gioca</a>
        </nav>
      </div>
    </header>

    <main id="main-content">
    <section class="ld-hero">
      <div class="ld-hero-bg"></div>
      <div class="ld-hero-overlay"></div>
      <div class="ld-container ld-hero-content">
        <p class="ld-hero-eyebrow">
          <span class="ld-eyebrow-line" aria-hidden="true"></span>
          <span data-i18n="landing.hero.eyebrow">Il Gioco di Strategia a Turni</span>
          <span class="ld-eyebrow-line" aria-hidden="true"></span>
        </p>
        <h1 class="ld-hero-title"><span data-i18n="landing.hero.titleLine1">Conquista il Mondo.</span><br /><em data-i18n="landing.hero.titleLine2">Comanda le Armate.</em></h1>
        <p class="ld-hero-desc" data-i18n="landing.hero.desc">
          Pianifica come un generale. Attacca nei momenti decisivi. Difendi cio che hai conquistato.
          Frontline Dominion e il teatro di guerra strategico che mette alla prova mente e nervi.
        </p>
        <div class="ld-hero-cta">
          <a href="/register.html" class="ld-btn-primary ld-btn-lg">
            <span data-i18n="landing.hero.ctaPrimary">Inizia Gratis</span>
          </a>
          <a href="#maps" class="ld-btn-ghost ld-btn-lg" data-i18n="landing.hero.ctaSecondary">Scopri le Mappe</a>
        </div>
        <div class="ld-hero-stats" aria-label="Statistiche di gioco" data-i18n-aria-label="landing.hero.statsAria">
          <div class="ld-hero-stat">
            <strong>6</strong>
            <span data-i18n="landing.hero.stats.commanders">Condottieri</span>
          </div>
          <div class="ld-hero-stat-divider" aria-hidden="true"></div>
          <div class="ld-hero-stat">
            <strong>2</strong>
            <span data-i18n="landing.hero.stats.theaters">Teatri di Guerra</span>
          </div>
          <div class="ld-hero-stat-divider" aria-hidden="true"></div>
          <div class="ld-hero-stat">
            <strong>&infin;</strong>
            <span data-i18n="landing.hero.stats.strategies">Strategie</span>
          </div>
        </div>
      </div>
      <div class="ld-hero-scroll-hint" aria-hidden="true">
        <div class="ld-scroll-gem"></div>
        <div class="ld-scroll-line"></div>
      </div>
    </section>

    <section class="ld-section ld-features" id="features">
      <div class="ld-container">
        <header class="ld-section-header">
          <p class="ld-eyebrow" data-i18n="landing.features.eyebrow">Caratteristiche</p>
          <h2 data-i18n="landing.features.heading">Un gioco di mente e coraggio</h2>
          <p class="ld-section-desc" data-i18n="landing.features.desc">
            Ogni partita e una campagna militare. Pianifica l'espansione, difendi i confini
            e scegli il momento giusto per colpire.
          </p>
        </header>
        <div class="ld-features-grid">
          <article class="ld-feature-card">
            <div class="ld-feature-icon" aria-hidden="true">🗺</div>
            <h3 data-i18n="landing.features.cards.maps.title">Due Teatri di Guerra</h3>
            <p data-i18n-html="landing.features.cards.maps.body">
              Combatti su mappe epiche: il <strong>Mondo Classico</strong> con 42 territori
              e la leggendaria <strong>Terra di Mezzo</strong>. Ogni mappa porta nuove sfide tattiche
              e rotte strategiche da dominare.
            </p>
          </article>
          <article class="ld-feature-card ld-feature-card-accent">
            <div class="ld-feature-icon" aria-hidden="true">⚔</div>
            <h3 data-i18n="landing.features.cards.strategy.title">Strategia Pura</h3>
            <p data-i18n="landing.features.cards.strategy.body">
              Rinforza i confini vulnerabili, pianifica catene d'attacco in profondita,
              fortifica le regioni chiave. Ogni mossa ha conseguenze:
              non esistono turni sprecati.
            </p>
          </article>
          <article class="ld-feature-card">
            <div class="ld-feature-icon" aria-hidden="true">⚜</div>
            <h3 data-i18n="landing.features.cards.multiplayer.title">Multiplayer Persistente</h3>
            <p data-i18n-html="landing.features.cards.multiplayer.body">
              Fino a <strong>6 condottieri</strong> in campo. Le partite si salvano in automatico:
              riprendi quando vuoi e decidi tu quando attaccare. Nessuna fretta, solo tattica.
            </p>
          </article>
        </div>
      </div>
    </section>

    <section class="ld-section ld-maps" id="maps">
      <div class="ld-container">
        <header class="ld-section-header">
          <p class="ld-eyebrow" data-i18n="landing.maps.eyebrow">I Teatri di Guerra</p>
          <h2 data-i18n="landing.maps.heading">Scegli il tuo campo di battaglia</h2>
          <p class="ld-section-desc" data-i18n="landing.maps.desc">
            Due mappe, due epoche, infinite campagne. Lo stesso obiettivo: dominare ogni angolo del mondo.
          </p>
        </header>

        <div class="ld-maps-grid">
          <div class="ld-map-card">
            <div class="ld-map-frame">
              <img
                src="/assets/maps/world-classic.png"
                alt="Screenshot del gioco - Mappa Mondo Classico con 4 giocatori attivi al turno 14"
                data-i18n-alt="landing.maps.classic.alt"
                width="800"
                height="533"
                loading="lazy"
              />
              <div class="ld-map-hud-top" aria-hidden="true">
                <span class="ld-map-hud-label" data-i18n="landing.maps.classic.hudTop">Campagna in corso · Turno 14</span>
                <div class="ld-map-players">
                  <span class="ld-mp" style="--player-color:#c0392b" title="Condottiero Rosso - 14 territori" data-i18n-title="landing.maps.classic.players.red"></span>
                  <span class="ld-mp" style="--player-color:#2980b9" title="Condottiero Blu - 11 territori" data-i18n-title="landing.maps.classic.players.blue"></span>
                  <span class="ld-mp" style="--player-color:#27ae60" title="Condottiero Verde - 9 territori" data-i18n-title="landing.maps.classic.players.green"></span>
                  <span class="ld-mp" style="--player-color:#d4a017" title="Condottiero Oro - 8 territori" data-i18n-title="landing.maps.classic.players.gold"></span>
                </div>
              </div>
              <div class="ld-map-hud-bottom" aria-hidden="true">
                <span data-i18n="landing.maps.classic.hudBottom.territories">42 territori</span>
                <span data-i18n="landing.maps.classic.hudBottom.players">4 / 6 giocatori</span>
                <span data-i18n="landing.maps.classic.hudBottom.phase">Fase di attacco</span>
              </div>
            </div>
            <div class="ld-map-info">
              <h3 data-i18n="landing.maps.classic.title">Mondo Classico</h3>
              <p data-i18n="landing.maps.classic.body">
                Il teatro originale. Sei continenti, 42 territori, infinite possibilita.
                Domina l'Europa, consolida l'Asia, taglia le rotte avversarie dal Sudamerica.
                La mappa che ha definito il genere.
              </p>
              <ul class="ld-map-tags" aria-label="Dettagli mappa" data-i18n-aria-label="landing.maps.tagsAria">
                <li data-i18n="landing.maps.classic.tags.territories">42 Territori</li>
                <li data-i18n="landing.maps.classic.tags.continents">6 Continenti</li>
                <li data-i18n="landing.maps.classic.tags.players">Fino a 6 giocatori</li>
              </ul>
            </div>
          </div>

          <div class="ld-map-card">
            <div class="ld-map-frame ld-map-frame--tall">
              <img
                src="/assets/maps/middle-earth.jpg"
                alt="Screenshot del gioco - Mappa Terra di Mezzo con 3 giocatori al turno 7"
                data-i18n-alt="landing.maps.middleEarth.alt"
                width="5606"
                height="9214"
                loading="lazy"
              />
              <div class="ld-map-hud-top" aria-hidden="true">
                <span class="ld-map-hud-label" data-i18n="landing.maps.middleEarth.hudTop">Campagna in corso · Turno 7</span>
                <div class="ld-map-players">
                  <span class="ld-mp" style="--player-color:#8e44ad" title="Condottiero Viola - 12 territori" data-i18n-title="landing.maps.middleEarth.players.purple"></span>
                  <span class="ld-mp" style="--player-color:#c0392b" title="Condottiero Rosso - 10 territori" data-i18n-title="landing.maps.middleEarth.players.red"></span>
                  <span class="ld-mp" style="--player-color:#16a085" title="Condottiero Teal - 8 territori" data-i18n-title="landing.maps.middleEarth.players.teal"></span>
                </div>
              </div>
              <div class="ld-map-hud-bottom" aria-hidden="true">
                <span data-i18n="landing.maps.middleEarth.hudBottom.map">Terra di Mezzo</span>
                <span data-i18n="landing.maps.middleEarth.hudBottom.players">3 / 6 giocatori</span>
                <span data-i18n="landing.maps.middleEarth.hudBottom.phase">Fase rinforzo</span>
              </div>
            </div>
            <div class="ld-map-info">
              <h3 data-i18n="landing.maps.middleEarth.title">Terra di Mezzo</h3>
              <p data-i18n="landing.maps.middleEarth.body">
                Un teatro di guerra leggendario. Dalla Contea alle Terre di Mordor, ogni regione
                porta il peso della storia. Chi dominera i Regni degli Uomini e le pianure di Rohan?
              </p>
              <ul class="ld-map-tags" aria-label="Dettagli mappa" data-i18n-aria-label="landing.maps.tagsAria">
                <li data-i18n="landing.maps.middleEarth.tags.kind">Mappa Fantasy</li>
                <li data-i18n="landing.maps.middleEarth.tags.regions">Regioni iconiche</li>
                <li data-i18n="landing.maps.middleEarth.tags.setting">Ambientazione epica</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ld-section ld-howto" id="howtoplay">
      <div class="ld-container">
        <header class="ld-section-header">
          <p class="ld-eyebrow" data-i18n="landing.howto.eyebrow">Come si gioca</p>
          <h2 data-i18n="landing.howto.heading">In campo in tre mosse</h2>
          <p class="ld-section-desc" data-i18n="landing.howto.desc">Niente tutorial infiniti. Sei pronto a combattere in pochi minuti.</p>
        </header>
        <div class="ld-steps">
          <div class="ld-step">
            <div class="ld-step-num" aria-hidden="true">I</div>
            <div class="ld-step-body">
              <h3 data-i18n="landing.howto.step1.title">Crea il tuo account</h3>
              <p data-i18n="landing.howto.step1.body">Registrati in pochi secondi. Gratis, senza niente da installare. Scegli il nome del tuo condottiero e sei pronto.</p>
            </div>
          </div>
          <div class="ld-step-connector" aria-hidden="true">
            <div class="ld-step-connector-line"></div>
            <div class="ld-step-connector-gem"></div>
          </div>
          <div class="ld-step">
            <div class="ld-step-num" aria-hidden="true">II</div>
            <div class="ld-step-body">
              <h3 data-i18n="landing.howto.step2.title">Scegli la battaglia</h3>
              <p data-i18n="landing.howto.step2.body">Dalla Lobby di Comando, crea una nuova partita o unisciti a una sessione esistente. Scegli la mappa e sfida i tuoi avversari.</p>
            </div>
          </div>
          <div class="ld-step-connector" aria-hidden="true">
            <div class="ld-step-connector-line"></div>
            <div class="ld-step-connector-gem"></div>
          </div>
          <div class="ld-step">
            <div class="ld-step-num" aria-hidden="true">III</div>
            <div class="ld-step-body">
              <h3 data-i18n="landing.howto.step3.title">Conquista il mondo</h3>
              <p data-i18n="landing.howto.step3.body">Rinforza i tuoi eserciti, pianifica gli attacchi, espandi il dominio. Il territorio e tuo, finche qualcuno non ti sfida.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="ld-section ld-final-cta">
      <div class="ld-final-cta-bg" aria-hidden="true"></div>
      <div class="ld-container ld-final-cta-inner">
        <div class="ld-final-cta-ornament" aria-hidden="true">⚔</div>
        <p class="ld-eyebrow" data-i18n="landing.final.eyebrow">Unisciti alla guerra</p>
        <h2 data-i18n="landing.final.heading">Il tuo esercito ti aspetta.</h2>
        <p class="ld-final-cta-desc" data-i18n="landing.final.desc">
          Il tuo territorio di partenza e ancora libero. Ogni giorno nuove campagne iniziano:
          non restare a guardare.
        </p>
        <div class="ld-final-cta-btns">
          <a href="/register.html" class="ld-btn-primary ld-btn-lg" data-i18n="landing.final.ctaPrimary">Registrati Gratis</a>
          <a href="/lobby.html" class="ld-btn-ghost ld-btn-lg" data-i18n="landing.final.ctaSecondary">Entra in Lobby</a>
        </div>
      </div>
    </section>
    </main>

    <footer class="ld-footer">
      <div class="ld-container ld-footer-inner">
        <a href="/" class="ld-brand">
          <span class="ld-brand-eyebrow">NetRisk</span>
          <span class="ld-brand-name">Frontline Dominion</span>
        </a>
        <nav class="ld-footer-links" aria-label="Link pie di pagina" data-i18n-aria-label="landing.footer.aria">
          <a href="/lobby.html" data-i18n="nav.lobby">Lobby</a>
          <a href="/game.html" data-i18n="landing.footer.game">Partita</a>
          <a href="/register.html" data-i18n="auth.register">Registrati</a>
          <a href="#top" data-i18n="landing.footer.backToTop">Torna su</a>
        </nav>
      </div>
    </footer>
    <script type="module" src="/shell.mjs"></script>
  </body>
</html>
`,
  "landing.html": String.raw`<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="refresh" content="0; url=/" />
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <p><a href="/">Continue to Frontline Dominion</a></p>
  </body>
</html>
`,
  "game.html": String.raw`<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title data-i18n="game.title">Frontline Dominion</title>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/style.css" />
    <link rel="stylesheet" href="/shell.css" />
    <script type="module" src="/speed-insights.mjs"></script>
  </head>
  <body data-shell-kind="app" data-app-section="game">
    <a class="skip-link" href="#main-content" data-i18n="common.skipToContent">Salta al contenuto principale</a>
    <div class="backdrop"></div>
    <div class="app-frame game-app-frame">
      <main id="main-content" class="page-shell game-page-shell campaign-page-shell">
        <section class="app-shell board-shell" data-testid="app-shell">
      <section class="panel top-nav-bar campaign-nav" data-shared-top-nav><form id="header-login-form" method="post" hidden></form></section>

          <section class="battlefield-layout game-battlefield-layout" data-testid="battlefield-layout">
            <section class="game-main-column" data-testid="game-main-column">
              <section class="center-stage panel map-stage-panel game-map-stage campaign-map-shell" data-testid="map-panel">
                <div id="map" class="map tactical-map" data-testid="map-region"></div>
              </section>

              <section class="panel game-info-rail game-info-bottom campaign-shell" data-testid="info-panel">
                <div class="panel-header tight-header game-compact-heading">
                  <div>
                    <p class="eyebrow" data-i18n="game.command.eyebrow">Command</p>
                    <h1 data-i18n="game.command.heading">Quadro turno</h1>
                  </div>
                  <span id="turn-badge" class="badge" data-testid="phase-indicator" data-i18n="game.phaseBadge">Lobby</span>
                </div>
                <div class="rail-section map-stage-command-strip game-status-bottom-strip">
                  <div id="status-summary" class="status-summary command-summary map-command-summary" data-testid="status-summary"></div>
                  <div id="trade-alert" class="turn-alert turn-alert-danger map-trade-alert" hidden>
                    <strong data-i18n="game.tradeAlert.title">Scambio obbligatorio</strong>
                    <span id="trade-alert-text" data-i18n="game.tradeAlert.copy">Devi scambiare 3 carte per continuare il turno.</span>
                  </div>
                </div>
                <div class="rail-section game-meta-stack game-session-card">
                  <div class="game-meta-line"><span data-i18n="game.meta.player">Player</span><strong id="identity-status" data-testid="current-player-indicator" data-i18n="game.meta.identity">Accedi per collegarti alla partita.</strong></div>
                  <div class="game-meta-line"><span data-i18n="game.meta.activeGame">Active game</span><strong id="game-status" data-i18n="game.meta.noActiveGame">Nessuna partita attiva</strong></div>
                  <div class="game-meta-line"><span data-i18n="game.meta.map">Map</span><strong id="game-map-meta">classic-mini</strong></div>
                  <div class="game-meta-line"><span data-i18n="game.meta.setup">Setup</span><strong id="game-setup-meta" data-i18n="game.meta.setupDefault">2 players · 0 AI</strong></div>
                  <div class="game-meta-line"><span data-i18n="game.meta.access">Access</span><span id="auth-status" data-i18n="game.meta.accessCopy">Registrati o accedi per entrare nella lobby.</span></div>
                </div>
              </section>
            </section>

            <aside class="right-rail panel game-actions-rail campaign-shell" data-testid="actions-panel">
              <div class="rail-section game-phase-banner" id="phase-banner">
                <span><span data-i18n="game.phaseBanner">Fase:</span> <strong id="phase-banner-value" data-i18n="game.phaseValue">Lobby</strong></span>
              </div>

              <div class="rail-section game-reinforcement-banner" id="reinforcement-banner" hidden>
                <span><span data-i18n="game.reinforcementBanner">Rinforzi disponibili:</span> <strong id="reinforcement-banner-value">0</strong></span>
              </div>

              <div class="rail-section game-lobby-controls" id="lobby-controls-section">
                <form id="auth-form" class="auth-form compact-form rail-auth-form" method="post">
                  <label class="field-stack auth-field">
                    <span data-i18n="auth.usernameLabel">Nome utente</span>
                    <input id="auth-username" name="username" maxlength="32" placeholder="Username" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" required data-i18n-placeholder="game.auth.username.placeholder" />
                  </label>
                  <label class="field-stack auth-field">
                    <span data-i18n="auth.passwordLabel">Password</span>
                    <input id="auth-password" name="password" type="password" placeholder="Password" autocomplete="current-password" autocapitalize="none" autocorrect="off" spellcheck="false" required data-i18n-placeholder="game.auth.password.placeholder" />
                  </label>
                  <p id="auth-feedback" class="auth-feedback" aria-live="polite" hidden></p>
                  <button type="submit" id="login-button" class="ghost-button" data-i18n="auth.login">Accedi</button>
                  <a href="/register.html" id="register-link" class="ghost-button full-width" data-i18n="auth.register">Registrati</a>
                </form>
                <div class="identity-actions compact-actions rail-action-group" id="lobby-action-buttons">
                  <button id="join-button" data-i18n="game.join">Entra nella lobby</button>
                  <button id="start-button" class="ghost-button" data-i18n="game.start">Avvia partita</button>
                </div>
              </div>

              <div class="rail-section actions-section">
                <div class="action-group compact-group" id="reinforce-group">
                  <label for="reinforce-select" data-i18n="game.actions.reinforce">Rinforza</label>
                  <div class="action-stack">
                    <select id="reinforce-select"></select>
                    <input id="reinforce-amount" type="number" min="1" step="1" inputmode="numeric" value="1" aria-label="Quantita rinforzi" data-i18n-aria-label="game.actions.reinforceAmountAria" />
                    <div class="action-row">
                      <button id="reinforce-multi-button" data-i18n="game.actions.add">Aggiungi</button>
                      <button id="reinforce-all-button" type="button">Sposta tutto</button>
                    </div>
                  </div>
                </div>

                <div class="action-group compact-group" id="attack-group">
                  <label for="attack-from" data-i18n="game.actions.attack">Attacca</label>
                  <div class="action-stack">
                    <select id="attack-from"></select>
                    <select id="attack-to"></select>
                    <select id="attack-dice"></select>
                    <div class="action-row">
                      <button id="attack-button" data-i18n="game.actions.launchAttack">Lancia attacco</button>
                      <button id="attack-banzai-button" type="button" data-i18n="game.actions.banzai">Banzai</button>
                    </div>
                  </div>
                </div>

                <div class="action-group compact-group" id="conquest-group" hidden>
                  <label for="conquest-armies" data-i18n="game.actions.afterConquest">Dopo conquista</label>
                  <div class="action-stack">
                    <input id="conquest-armies" type="number" min="1" step="1" />
                    <div class="action-row">
                      <button id="conquest-button" data-i18n="game.actions.moveArmies">Sposta armate</button>
                      <button id="conquest-all-button" type="button">Sposta tutto</button>
                    </div>
                  </div>
                </div>

                <div class="action-group compact-group" id="fortify-group" hidden>
                  <label for="fortify-from" data-i18n="game.actions.fortify">Fortifica</label>
                  <div class="action-stack">
                    <select id="fortify-from"></select>
                    <select id="fortify-to"></select>
                    <input id="fortify-armies" type="number" min="1" step="1" />
                    <button id="fortify-button" data-i18n="game.actions.moveArmies">Sposta armate</button>
                  </div>
                </div>

                <div class="action-group compact-group" id="card-trade-group" hidden>
                  <label for="card-trade-list" data-i18n="game.actions.cards">Carte</label>
                  <div id="card-trade-alert" class="trade-emphasis" hidden>
                    <span data-i18n="game.cards.alert">Devi scambiare subito 3 carte prima di poter continuare.</span>
                  </div>
                  <div class="action-meta-list">
                    <p id="card-trade-summary" class="action-help" data-i18n="game.cards.summary">Carte in mano: 0.</p>
                    <p id="card-trade-bonus" class="action-help" data-i18n="game.cards.bonus">Prossimo scambio: +4 rinforzi.</p>
                  </div>
                  <div id="card-trade-list" class="card-trade-list" data-testid="card-trade-list"></div>
                  <p id="card-trade-help" class="action-help" data-i18n="game.cards.help">Seleziona 3 carte valide per lo scambio.</p>
                  <p id="card-trade-success" class="action-success" hidden></p>
                  <p id="card-trade-error" class="action-error" hidden></p>
                  <button id="card-trade-button" class="ghost-button full-width" data-i18n="game.cards.tradeSet">Scambia set</button>
                </div>

                <button id="end-turn-button" class="ghost-button full-width" data-i18n="game.actions.endTurn">Termina turno</button>
              </div>

              <div class="rail-section combat-result-section" id="combat-result-group" hidden>
                <div class="section-title-row">
                  <h3 data-i18n="game.combat.heading">Ultimo combattimento</h3>
                  <span class="badge accent" id="combat-result-badge" data-i18n="game.combat.badge">Risolto</span>
                </div>
                <div id="combat-result-summary" class="combat-result-summary"></div>
                <div class="combat-result-grid">
                  <div class="combat-result-line"><span data-i18n="game.combat.attacker">Attaccante</span><strong id="combat-attacker-rolls">-</strong></div>
                  <div class="combat-result-line"><span data-i18n="game.combat.defender">Difensore</span><strong id="combat-defender-rolls">-</strong></div>
                  <div class="combat-result-line"><span data-i18n="game.combat.comparisons">Confronti</span><strong id="combat-comparisons">-</strong></div>
                </div>
              </div>

              <div class="rail-section game-roster-section">
                <div class="section-title-row">
                  <h3 data-i18n="game.players.heading">Giocatori</h3>
                  <span class="badge accent" data-i18n="game.players.badge">Live</span>
                </div>
                <div id="players" class="players rail-players"></div>
              </div>

              <div class="rail-section log-section">
                <div class="section-title-row">
                  <h3 data-i18n="game.log.heading">Registro</h3>
                  <span class="badge accent" data-i18n="game.log.badge">Cronologia</span>
                </div>
                <ul id="log" class="log-list rail-log"></ul>
              </div>

              <div class="rail-section surrender-section">
                <button id="surrender-button" class="danger-button full-width" hidden data-i18n="game.surrender">Arrenditi e abbandona partita</button>
              </div>
            </aside>
          </section>

        </section>
      </main>
      <footer class="panel shared-bottom-shell game-bottom-shell" data-shared-footer></footer>
    </div>

    <script type="module" src="/shell.mjs"></script>
    <script type="module" src="/app.mjs"></script>
  </body>
</html>
`,
  "lobby.html": String.raw`<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title data-i18n="lobby.title">Frontline Dominion - Lobby</title>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/style.css" />
    <link rel="stylesheet" href="/shell.css" />
    <script type="module" src="/speed-insights.mjs"></script>
  </head>
  <body data-shell-kind="app" data-app-section="lobby">
    <a class="skip-link" href="#main-content" data-i18n="common.skipToContent">Salta al contenuto principale</a>
    <div class="backdrop"></div>
    <div class="app-frame top-nav-page-frame">
      <main id="main-content" class="page-shell top-nav-page-shell campaign-page-shell">
      <section class="panel top-nav-bar campaign-nav" data-shared-top-nav><form id="header-login-form" method="post" hidden></form></section>
        <section class="session-browser panel campaign-shell" data-testid="game-lobby-shell">
          <div class="session-browser-head campaign-hero">
            <div class="session-browser-heading campaign-hero-copy">
              <p class="eyebrow session-eyebrow" data-i18n="lobby.eyebrow">War Room</p>
              <h1 data-i18n="lobby.heading">Lobby di Comando</h1>
              <p class="stage-copy" data-i18n="lobby.copy">Riapri la partita giusta in fretta, controlla quali lobby sono pronte e scegli subito il prossimo teatro da aprire.</p>
            </div>
          </div>

          <div class="content-meta-line lobby-meta-line campaign-status-line">
            <span id="auth-status" data-i18n="lobby.authStatus">Accedi dalla pagina Game per collegarti e poi torna qui per gestire le sessioni.</span>
            <span class="status-divider" aria-hidden="true"></span>
            <span id="game-status" data-i18n="lobby.gameStatus">Nessuna partita attiva</span>
          </div>

          <div class="lobby-focus-band campaign-focus-grid">
            <article class="lobby-focus-card campaign-focus-card">
              <span class="lobby-command-label" data-i18n="lobby.focus.label">Sessione in primo piano</span>
              <strong id="lobby-active-focus" data-i18n="lobby.focus.value">Nessuna</strong>
              <p id="lobby-focus-note" data-i18n="lobby.focus.note">Apri una partita per continuare dal teatro corrente.</p>
            </article>
            <div class="page-header-actions compact-actions lobby-head-actions lobby-focus-actions">
              <a href="/new-game.html" id="create-game-button" class="ghost-button lobby-create-button" data-i18n="lobby.createGame">Crea partita</a>
              <button type="button" id="open-game-button" class="ghost-button" data-i18n="lobby.openSelected">Apri selezionata</button>
            </div>
          </div>

          <div class="lobby-command-strip" aria-label="Panoramica lobby" data-i18n-aria-label="lobby.overviewAria">
            <article class="lobby-command-card lobby-command-card-accent">
              <span class="lobby-command-label" data-i18n="lobby.visibleSessions.label">Sessioni visibili</span>
              <strong id="lobby-total-games">0</strong>
              <p data-i18n="lobby.visibleSessions.copy">Tutte le partite persistite disponibili nel backend.</p>
            </article>
            <article class="lobby-command-card">
              <span class="lobby-command-label" data-i18n="lobby.readySessions.label">Pronte al via</span>
              <strong id="lobby-ready-games">0</strong>
              <p data-i18n="lobby.readySessions.copy">Lobby che possono essere avviate senza configurazioni extra.</p>
            </article>
            <article class="lobby-command-card">
              <span class="lobby-command-label" data-i18n="lobby.readiness.label">Prontezza operativa</span>
              <strong data-i18n="lobby.readiness.value">Seleziona</strong>
              <p data-i18n="lobby.readiness.copy">Usa lista e pannello dettagli per confrontare rapidamente composizione, stato e ultimo aggiornamento.</p>
            </article>
          </div>

          <div class="session-browser-grid">
            <div class="session-list-panel">
              <div class="section-title-row session-list-title-row">
                <div>
                  <h3 data-i18n="lobby.availableSessions.heading">Sessioni disponibili</h3>
                  <p class="stage-copy" data-i18n="lobby.availableSessions.copy">Seleziona una lobby per vedere subito se vale la pena riaprirla.</p>
                </div>
              </div>
              <div class="session-list-header session-row session-row-head">
                <span data-i18n="lobby.table.game">Partita</span>
                <span data-i18n="lobby.table.map">Mappa</span>
                <span data-i18n="lobby.table.status">Stato</span>
                <span data-i18n="lobby.table.players">Giocatori</span>
                <span data-i18n="lobby.table.updated">Aggiornata</span>
              </div>
              <div id="game-list-state" class="session-feedback" aria-live="polite" data-i18n="lobby.loading">Caricamento sessioni...</div>
              <div id="game-session-list" class="session-list" data-testid="game-session-list"></div>
              <div id="game-list-load-more-state" class="session-list-load-more" aria-live="polite"></div>
            </div>

            <aside class="session-detail-panel" data-testid="game-session-details">
              <div class="section-title-row">
                <div>
                  <h3 data-i18n="lobby.details.heading">Dettagli sessione</h3>
                  <p class="stage-copy" data-i18n="lobby.details.copy">Qui controlli stato reale, occupazione slot e ultimo contesto utile prima di aprire.</p>
                </div>
                <span id="selected-game-status" class="badge" data-i18n="lobby.details.emptyBadge">Nessuna selezione</span>
              </div>
              <div id="game-session-details" class="session-details-card">
                <div class="session-empty-copy" data-i18n="lobby.details.empty">Seleziona una partita per vedere lo stato corrente e aprirla nel tabellone di gioco.</div>
              </div>
            </aside>
          </div>
        </section>
      </main>
      <footer class="panel shared-bottom-shell" data-shared-footer></footer>
    </div>

    <script type="module" src="/shell.mjs"></script>
    <script type="module" src="/lobby.mjs"></script>
  </body>
</html>
`,
  "new-game.html": String.raw`<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title data-i18n="newGame.title">Frontline Dominion - Nuova Partita</title>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/style.css" />
    <link rel="stylesheet" href="/shell.css" />
    <script type="module" src="/speed-insights.mjs"></script>
  </head>
  <body data-shell-kind="app" data-app-section="lobby">
    <a class="skip-link" href="#main-content" data-i18n="common.skipToContent">Salta al contenuto principale</a>
    <div class="backdrop"></div>
    <div class="app-frame top-nav-page-frame">
      <main id="main-content" class="page-shell top-nav-page-shell campaign-page-shell">
      <section class="panel top-nav-bar campaign-nav" data-shared-top-nav><form id="header-login-form" method="post" hidden></form></section>

        <section class="panel new-game-shell campaign-shell" data-testid="new-game-shell">
          <div class="section-title-row campaign-hero">
            <div class="campaign-hero-copy">
              <p class="eyebrow" data-i18n="newGame.eyebrow">New Game Setup</p>
              <h1 data-i18n="newGame.heading">Configura una nuova partita</h1>
              <p class="stage-copy" data-i18n="newGame.copy">Definisci il teatro, controlla quanti slot vuoi aprire e verifica subito come entreranno umani e AI prima di creare la sessione.</p>
            </div>
            <div class="content-meta-line new-game-meta-line campaign-status-line">
              <span id="setup-auth-status" data-i18n="newGame.authStatus">Configurazione locale pronta.</span>
            </div>
          </div>

          <div class="new-game-brief campaign-focus-grid">
            <article class="new-game-brief-card new-game-brief-card-accent campaign-focus-card">
              <span class="lobby-command-label" data-i18n="newGame.goal.label">Obiettivo</span>
              <strong data-i18n="newGame.goal.title">Preparazione rapida</strong>
              <p data-i18n="newGame.goal.copy">Tieni visibili solo le decisioni che servono davvero: nome, mappa, posti al tavolo e natura di ogni slot.</p>
            </article>
            <article class="new-game-brief-card">
              <span class="lobby-command-label" data-i18n="newGame.sequence.label">Sequenza</span>
              <ul class="new-game-sequence">
                <li data-i18n="newGame.sequence.step1">1. Scegli mappa e nome</li>
                <li data-i18n="newGame.sequence.step2">2. Definisci i posti al tavolo</li>
                <li data-i18n="newGame.sequence.step3">3. Verifica gli slot umani e AI</li>
              </ul>
            </article>
          </div>

          <form id="new-game-form" class="new-game-grid">
            <section class="new-game-panel">
              <div class="section-title-row compact-row">
                <div>
                  <h3 data-i18n="newGame.settings.heading">Impostazioni</h3>
                  <p class="stage-copy" data-i18n="newGame.settings.copy">Qui scegli il teatro e la dimensione della sessione.</p>
                </div>
              </div>
              <label class="field-stack">
                <span data-i18n="newGame.name.label">Nome partita</span>
                <input id="setup-game-name" maxlength="80" placeholder="Campagna del Nord" data-i18n-placeholder="newGame.name.placeholder" />
              </label>
              <label class="field-stack">
                <span data-i18n="newGame.contentPack.label">Content pack</span>
                <select id="setup-content-pack"></select>
              </label>
              <div id="setup-content-pack-summary" class="setup-ruleset-card" aria-live="polite"></div>
              <label class="field-stack">
                <span data-i18n="newGame.ruleset.label">Ruleset</span>
                <select id="setup-ruleset"></select>
              </label>
              <div id="setup-ruleset-summary" class="setup-ruleset-card" aria-live="polite"></div>
              <label class="field-stack">
                <span data-i18n="newGame.map.label">Mappa</span>
                <select id="setup-map"></select>
              </label>
              <div id="setup-map-details" class="map-setup-card" aria-live="polite"></div>
              <section class="setup-options-stack" aria-labelledby="setup-options-heading">
                <div class="section-title-row compact-row">
                  <div>
                    <h4 id="setup-options-heading" data-i18n="newGame.options.heading">Opzioni</h4>
                    <p class="stage-copy" data-i18n="newGame.options.copy">Puoi lasciare le impostazioni del ruleset oppure aprire la personalizzazione.</p>
                  </div>
                </div>
                <label class="setup-options-toggle" for="setup-customize-options">
                  <input id="setup-customize-options" type="checkbox" />
                  <span data-i18n="newGame.options.customizeLabel">Personalizza opzioni</span>
                </label>
                <div id="setup-advanced-options" class="setup-advanced-options" hidden>
                  <label class="field-stack">
                    <span data-i18n="newGame.dice.label">Dadi</span>
                    <select id="setup-dice-ruleset"></select>
                  </label>
                  <label class="field-stack">
                    <span data-i18n="newGame.victory.label">Victory</span>
                    <select id="setup-victory-ruleset"></select>
                  </label>
                  <label class="field-stack">
                    <span data-i18n="newGame.theme.label">Theme</span>
                    <select id="setup-theme"></select>
                  </label>
                  <label class="field-stack">
                    <span data-i18n="newGame.pieceSkin.label">Piece skin</span>
                    <select id="setup-piece-skin"></select>
                  </label>
                </div>
              </section>
              <label class="field-stack">
                <span data-i18n="newGame.totalPlayers.label">Giocatori totali</span>
                <select id="setup-total-players">
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                </select>
              </label>
              <label class="field-stack">
                <span data-i18n="newGame.turnTimeout.label">Turn time limit</span>
                <select id="setup-turn-timeout-hours"></select>
              </label>
            </section>

            <section class="new-game-panel">
              <div class="section-title-row compact-row">
                <div>
                  <h3 data-i18n="newGame.playerSlots.heading">Slot giocatori</h3>
                  <p class="stage-copy" data-i18n="newGame.playerSlots.copy">Il primo posto e sempre tuo; gli altri definiscono chi arrivera in lobby e chi nascera come AI.</p>
                </div>
                <span class="badge" data-i18n="newGame.playerSlots.badge">Human / AI</span>
              </div>
              <div id="setup-player-slots" class="setup-player-slots"></div>
            </section>
          </form>

          <div id="new-game-feedback" class="session-feedback is-hidden" aria-live="polite"></div>

          <div class="new-game-actions">
            <a href="/lobby.html" class="ghost-button" data-i18n="common.cancel">Annulla</a>
            <button type="submit" form="new-game-form" id="submit-new-game" class="ghost-button" data-i18n="newGame.createOpen">Crea e apri</button>
          </div>
        </section>
      </main>
      <footer class="panel shared-bottom-shell" data-shared-footer></footer>
    </div>

    <script type="module" src="/shell.mjs"></script>
    <script type="module" src="/new-game.mjs"></script>
  </body>
</html>
`,
  "profile.html": String.raw`<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title data-i18n="profile.title">Frontline Dominion - Profilo</title>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/style.css" />
    <link rel="stylesheet" href="/shell.css" />
    <script type="module" src="/speed-insights.mjs"></script>
  </head>
  <body data-shell-kind="app" data-app-section="profile">
    <a class="skip-link" href="#main-content" data-i18n="common.skipToContent">Salta al contenuto principale</a>
    <div class="backdrop"></div>
    <div class="app-frame top-nav-page-frame">
      <main id="main-content" class="page-shell top-nav-page-shell campaign-page-shell">
      <section class="panel top-nav-bar campaign-nav" data-shared-top-nav><form id="header-login-form" method="post" hidden></form></section>
        <section class="profile-shell panel campaign-shell" data-testid="player-profile-shell">
          <div class="profile-hero campaign-hero">
            <div class="profile-hero-copy campaign-hero-copy">
              <p class="eyebrow profile-section-eyebrow" data-i18n="profile.eyebrow">Command Dossier</p>
              <h1 id="profile-heading" data-i18n="profile.heading">Comandante</h1>
              <p id="profile-subtitle" class="stage-copy" data-i18n="profile.subtitle">Statistiche aggregate delle sessioni concluse e di quelle ancora aperte.</p>
            </div>
            <div class="page-header-actions compact-actions profile-hero-actions">
              <a href="/lobby.html" class="ghost-button profile-back-button" data-i18n="profile.backToLobby">Torna alla lobby</a>
              <a href="/new-game.html" class="ghost-button lobby-create-button" data-i18n="profile.createGame">Crea partita</a>
            </div>
          </div>

          <div class="content-meta-line profile-meta-line campaign-status-line">
            <span id="profile-name" data-i18n="profile.nameLoading">Caricamento profilo...</span>
            <span class="status-divider" aria-hidden="true"></span>
            <span id="auth-status" data-i18n="profile.authStatus">Verifica della sessione in corso...</span>
          </div>
          <div id="profile-feedback" class="profile-feedback" aria-live="polite" data-i18n="profile.feedback">Caricamento dati giocatore...</div>
          <section id="profile-preferences" class="profile-preferences profile-note-card" hidden>
            <div class="profile-preferences-head">
              <div>
                <p class="eyebrow profile-section-eyebrow" data-i18n="profile.preferences.eyebrow">Preferenze</p>
                <h3 data-i18n="profile.preferences.heading">Tema del sito</h3>
              </div>
            </div>
            <p class="stage-copy" data-i18n="profile.preferences.copy">Scegli il tema visivo che preferisci: la modifica viene applicata subito su tutto il sito in questo browser.</p>
            <div class="profile-theme-row">
              <label class="profile-theme-field" for="profile-theme-select">
                <span class="profile-theme-label" data-i18n="profile.preferences.label">Tema</span>
                <select id="profile-theme-select" class="top-nav-locale-select profile-theme-select" aria-describedby="profile-theme-status"></select>
              </label>
              <p id="profile-theme-status" class="profile-theme-status" aria-live="polite" data-i18n="profile.preferences.status.loading">Caricamento tema attuale...</p>
            </div>
          </section>
          <section id="profile-modules" class="profile-preferences profile-note-card" hidden>
            <div class="profile-preferences-head">
              <div>
                <p class="eyebrow profile-section-eyebrow" data-i18n="profile.modules.eyebrow">Moduli</p>
                <h3 data-i18n="profile.modules.heading">Controllo moduli</h3>
              </div>
              <div class="page-header-actions compact-actions profile-hero-actions">
                <button type="button" id="profile-modules-refresh" class="ghost-button profile-back-button" data-i18n="profile.modules.refresh">Aggiorna</button>
                <button type="button" id="profile-modules-rescan" class="ghost-button profile-back-button" data-i18n="profile.modules.rescan">Rescan</button>
              </div>
            </div>
            <p class="stage-copy" data-i18n="profile.modules.copy">Per gli admin il catalogo moduli mostra compatibilita, stato, warning e permette il lifecycle base del runtime installabile.</p>
            <p id="profile-modules-status" class="profile-theme-status" aria-live="polite" data-i18n="profile.modules.status.loading">Caricamento catalogo moduli...</p>
            <div id="profile-modules-empty" class="profile-games-empty" hidden data-i18n="profile.modules.empty">Nessun modulo rilevato.</div>
            <div id="profile-modules-list" class="profile-games-list"></div>
            <div class="profile-games-head">
              <div>
                <p class="eyebrow profile-section-eyebrow" data-i18n="profile.modules.extensions.eyebrow">Slot admin</p>
                <h3 data-i18n="profile.modules.extensions.heading">Estensioni admin attive</h3>
              </div>
            </div>
            <div id="profile-module-slots-empty" class="profile-games-empty" hidden data-i18n="profile.modules.extensions.empty">Nessuna estensione admin attiva.</div>
            <div id="profile-module-slots-list" class="profile-games-list"></div>
          </section>
          <section id="profile-content" class="profile-content" hidden>
            <div class="profile-summary-card campaign-summary-card">
              <p class="eyebrow profile-section-eyebrow" data-i18n="profile.summary.eyebrow">Panoramica</p>
              <h3 data-i18n="profile.summary.heading">Dossier operativo</h3>
              <p id="profile-copy" class="stage-copy" data-i18n="profile.summary.copy">Statistiche aggregate delle sessioni concluse e di quelle ancora aperte.</p>
            </div>

            <div class="profile-command-strip" aria-label="Panoramica profilo" data-i18n-aria-label="profile.overviewAria">
              <article class="profile-command-card profile-command-card-accent">
                <span class="profile-command-label" data-i18n="profile.commander.label">Comandante</span>
                <strong id="profile-command-name" data-i18n="profile.commander.value">In attesa</strong>
                <p id="profile-command-status" data-i18n="profile.commander.copy">Accesso richiesto per consultare il dossier.</p>
              </article>
              <article class="profile-command-card">
                <span class="profile-command-label" data-i18n="profile.front.label">Fronte attivo</span>
                <strong id="profile-command-focus" data-i18n="profile.front.value">Nessuna partita</strong>
                <p id="profile-command-focus-note" data-i18n="profile.front.copy">Apri una sessione per riprendere il teatro corrente.</p>
              </article>
              <article class="profile-command-card">
                <span class="profile-command-label" data-i18n="profile.directive.label">Direttiva</span>
                <strong id="profile-command-directive" data-i18n="profile.directive.value">Mantieni il comando</strong>
                <p id="profile-command-directive-note" data-i18n="profile.directive.copy">Lobby e Game restano i due accessi rapidi per creare o riaprire una campagna.</p>
              </article>
            </div>

            <div class="profile-metrics-grid">
              <article class="profile-metric-card">
                <span class="profile-metric-label" data-i18n="profile.metrics.gamesPlayed">Partite giocate</span>
                <strong id="metric-games-played" class="profile-metric-value">0</strong>
              </article>
              <article class="profile-metric-card accent-win">
                <span class="profile-metric-label" data-i18n="profile.metrics.wins">Vittorie</span>
                <strong id="metric-wins" class="profile-metric-value">0</strong>
              </article>
              <article class="profile-metric-card accent-loss">
                <span class="profile-metric-label" data-i18n="profile.metrics.losses">Sconfitte</span>
                <strong id="metric-losses" class="profile-metric-value">0</strong>
              </article>
              <article class="profile-metric-card accent-neutral">
                <span class="profile-metric-label" data-i18n="profile.metrics.inProgress">In corso</span>
                <strong id="metric-in-progress" class="profile-metric-value">0</strong>
              </article>
              <article class="profile-metric-card accent-gold wide-card">
                <span class="profile-metric-label" data-i18n="profile.metrics.winRate">Win rate</span>
                <strong id="metric-win-rate" class="profile-metric-value">--</strong>
              </article>
            </div>

            <div class="profile-future-grid">
              <article class="profile-note-card profile-games-card">
                <div class="profile-games-head">
                  <div>
                    <p class="eyebrow profile-section-eyebrow" data-i18n="profile.games.eyebrow">Partite</p>
                    <h3 data-i18n="profile.games.heading">Partite a cui stai partecipando</h3>
                  </div>
                  <span id="profile-games-count" class="badge" data-i18n="profile.games.count">0 attive</span>
                </div>
                <div id="profile-games-empty" class="profile-games-empty" data-i18n="profile.games.empty">Nessuna partita attiva collegata al tuo profilo.</div>
                <div id="profile-games-list" class="profile-games-list" hidden></div>
              </article>
              <article class="profile-note-card">
                <h3 data-i18n="profile.space.heading">Spazio comandante</h3>
                <p data-i18n="profile.space.copy">Usa questo spazio come punto rapido per leggere il tuo stato operativo prima di rientrare in lobby o sul tabellone.</p>
              </article>
            </div>

            <div class="profile-intel-grid">
              <article class="profile-note-card profile-intel-card">
                <p class="eyebrow profile-section-eyebrow" data-i18n="profile.ranking.eyebrow">Ranking</p>
                <h3 id="profile-ranking-title" data-i18n="profile.ranking.title">Recluta</h3>
                <p id="profile-ranking-copy" data-i18n="profile.ranking.copy">Completa campagne e migliora il win rate per scalare il grado operativo.</p>
              </article>
              <article class="profile-note-card profile-intel-card">
                <p class="eyebrow profile-section-eyebrow" data-i18n="profile.map.eyebrow">Dettaglio mappe</p>
                <h3 id="profile-map-title" data-i18n="profile.map.title">Nessuna mappa osservata</h3>
                <p id="profile-map-copy" data-i18n="profile.map.copy">Apri o completa una partita per costruire una prima lettura dei fronti giocati.</p>
              </article>
              <article class="profile-note-card profile-intel-card">
                <p class="eyebrow profile-section-eyebrow" data-i18n="profile.advanced.eyebrow">Statistiche avanzate</p>
                <h3 id="profile-advanced-title" data-i18n="profile.advanced.title">Quadro operativo</h3>
                <p id="profile-advanced-copy" data-i18n="profile.advanced.copy">Una lettura sintetica del ritmo campagna tra fronti aperti, risultati e continuita operativa.</p>
              </article>
            </div>
          </section>
        </section>
      </main>
      <footer class="panel shared-bottom-shell" data-shared-footer></footer>
    </div>

    <script type="module" src="/shell.mjs"></script>
    <script type="module" src="/profile.mjs"></script>
  </body>
</html>
`,
  "register.html": String.raw`<!doctype html>
<html lang="it">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title data-i18n="register.title">Frontline Dominion - Registrazione</title>
    <link rel="icon" href="/assets/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/style.css" />
    <link rel="stylesheet" href="/shell.css" />
  </head>
  <body data-shell-kind="app" data-app-section="register">
    <a class="skip-link" href="#main-content" data-i18n="common.skipToContent">Salta al contenuto principale</a>
    <div class="backdrop"></div>
    <div class="app-frame top-nav-page-frame">
      <main id="main-content" class="page-shell top-nav-page-shell campaign-page-shell">
      <section class="panel top-nav-bar campaign-nav" data-shared-top-nav><form id="header-login-form" method="post" hidden></form></section>

        <section class="panel register-shell campaign-shell" data-testid="register-shell">
          <div class="register-hero campaign-hero">
            <div class="campaign-hero-copy">
              <p class="eyebrow" data-i18n="register.eyebrow">Account Setup</p>
              <h1 data-i18n="register.heading">Crea il tuo profilo comandante</h1>
              <p class="stage-copy" data-i18n="register.copy">Registrazione standard, email facoltativa, password forte e dati sensibili protetti lato server.</p>
            </div>
            <div class="content-meta-line register-meta-line campaign-status-line">
              <span id="register-auth-status" data-i18n="register.authStatus">Compila il modulo per creare l'account.</span>
            </div>
          </div>

          <form id="register-form" class="register-card campaign-form-card">
            <label class="field-stack">
              <span data-i18n="register.username.label">Username</span>
              <input id="register-username" name="register-username" maxlength="32" autocomplete="username" placeholder="Comandante_01" required data-i18n-placeholder="register.username.placeholder" />
            </label>
            <label class="field-stack">
              <span data-i18n="register.email.label">Email</span>
              <input id="register-email" name="register-email" type="email" maxlength="128" autocomplete="email" placeholder="opzionale@esempio.it" data-i18n-placeholder="register.email.placeholder" />
            </label>
            <label class="field-stack">
              <span data-i18n="register.password.label">Password</span>
              <input id="register-password" name="register-password" type="password" autocomplete="new-password" placeholder="Password forte" required data-i18n-placeholder="register.password.placeholder" />
            </label>
            <label class="field-stack">
              <span data-i18n="register.passwordConfirm.label">Conferma password</span>
              <input id="register-password-confirm" name="register-password-confirm" type="password" autocomplete="new-password" placeholder="Ripeti la password" required data-i18n-placeholder="register.passwordConfirm.placeholder" />
            </label>

            <div class="register-guidelines">
              <p data-i18n="register.guideline.username">Username: 3-32 caratteri, lettere, numeri, underscore o trattino.</p>
              <p data-i18n="register.guideline.email">Email non obbligatoria.</p>
              <p data-i18n="register.guideline.password">Password: almeno 4 caratteri.</p>
            </div>

            <p id="register-feedback" class="auth-feedback" hidden></p>

            <div class="new-game-actions register-actions">
              <a href="/game.html" class="ghost-button" data-i18n="common.cancel">Annulla</a>
              <button type="submit" id="register-submit-button" class="ghost-button" data-i18n="register.submit">Registrati</button>
            </div>
          </form>
        </section>
      </main>
      <footer class="panel shared-bottom-shell" data-shared-footer></footer>
    </div>

    <script type="module" src="/shell.mjs"></script>
    <script type="module" src="/register.mjs"></script>
  </body>
</html>
`
} as const;

export const staticCssAssets = {
  "landing.css": String.raw`/* ================================================================
   Frontline Dominion - Landing Page
   Standalone stylesheet, Age of Empires II aesthetic
   ================================================================ */

*, *::before, *::after { box-sizing: border-box; }

html {
  scroll-behavior: smooth;
}

a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }
h1, h2, h3 { margin: 0; line-height: 1.15; text-wrap: balance; }
p { margin: 0; }
ul { margin: 0; padding: 0; list-style: none; }

.ld-container {
  width: min(1200px, calc(100% - 48px));
  margin-inline: auto;
}

.ld-header {
  position: fixed;
  top: 0;
  inset-inline: 0;
  z-index: 100;
  background: var(--landing-header-bg);
  border-bottom: 1px solid var(--border);
  backdrop-filter: blur(16px);
  box-shadow: var(--shadow-soft);
}

.ld-header-inner {
  display: flex;
  align-items: center;
  gap: 32px;
  height: 60px;
}

.ld-brand {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex-shrink: 0;
  text-decoration: none;
}

.ld-brand-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.3em;
  font-size: 0.58rem;
  color: var(--gold);
  line-height: 1;
}

.ld-brand-name {
  font-variant: small-caps;
  letter-spacing: 0.07em;
  font-size: 1.05rem;
  color: var(--gold-hi);
  text-shadow: var(--hero-text-shadow);
  line-height: 1;
}

.ld-menu-toggle {
  display: none;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  min-height: 40px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--button-ghost-bg);
  color: var(--gold-hi);
  font: inherit;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: var(--bevel), var(--shadow-soft);
}

.ld-menu-toggle-icon,
.ld-menu-toggle-icon::before,
.ld-menu-toggle-icon::after {
  display: block;
  width: 16px;
  height: 2px;
  border-radius: 999px;
  background: currentColor;
  transition: transform 160ms ease, opacity 160ms ease;
  content: "";
}

.ld-menu-toggle-icon {
  position: relative;
}

.ld-menu-toggle-icon::before {
  position: absolute;
  inset: -5px 0 auto;
}

.ld-menu-toggle-icon::after {
  position: absolute;
  inset: 5px 0 auto;
}

body[data-landing-menu-open="true"] .ld-menu-toggle-icon {
  background: transparent;
}

body[data-landing-menu-open="true"] .ld-menu-toggle-icon::before {
  transform: translateY(5px) rotate(45deg);
}

body[data-landing-menu-open="true"] .ld-menu-toggle-icon::after {
  transform: translateY(-5px) rotate(-45deg);
}

.ld-nav-links {
  display: flex;
  gap: 4px;
  flex: 1 1 auto;
  justify-content: center;
}

.ld-nav-links a {
  padding: 6px 14px;
  border-radius: 3px;
  color: var(--parchment-dim);
  font-size: 0.88rem;
  font-variant: small-caps;
  letter-spacing: 0.06em;
  transition: color 100ms ease, background 100ms ease;
}

.ld-nav-links a:hover {
  color: var(--gold-hi);
  background: var(--nav-hover-bg);
}

.ld-nav-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: center;
}

.ld-mobile-panel {
  padding-bottom: 16px;
}

.ld-mobile-links {
  display: grid;
  gap: 8px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--nav-surface);
  box-shadow: var(--shadow-soft);
}

.ld-mobile-links a {
  padding: 10px 12px;
  border-radius: 10px;
  color: var(--parchment-dim);
  font-size: 0.92rem;
  font-variant: small-caps;
  letter-spacing: 0.06em;
  background: var(--status-surface);
}

.ld-hero {
  position: relative;
  min-height: 100svh;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.ld-hero-bg {
  position: absolute;
  inset: -10%;
  background: url("/assets/maps/world-classic.png") center/cover no-repeat;
  filter: brightness(0.2) contrast(1.15) saturate(0.7);
  animation: hero-drift 24s ease-in-out infinite alternate;
  transform-origin: center;
}

@keyframes hero-drift {
  from { transform: scale(1.08) translate(-1%, 0); }
  to { transform: scale(1.08) translate(1%, -1.5%); }
}

.ld-hero-overlay {
  position: absolute;
  inset: 0;
  background: var(--landing-hero-overlay);
  pointer-events: none;
}

.ld-hero-content {
  position: relative;
  z-index: 1;
  padding-top: 100px;
  padding-bottom: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 28px;
}

.ld-hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 14px;
  text-transform: uppercase;
  letter-spacing: 0.35em;
  font-size: 0.72rem;
  color: var(--gold);
  animation: fade-up 0.9s ease both;
}

.ld-eyebrow-line {
  display: block;
  width: 48px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--gold-dim));
}

.ld-eyebrow-line:last-child {
  background: linear-gradient(90deg, var(--gold-dim), transparent);
}

.ld-hero-title {
  font-size: clamp(2.8rem, 7vw, 6rem);
  font-variant: small-caps;
  letter-spacing: 0.06em;
  color: var(--parchment);
  text-shadow:
    var(--hero-text-shadow),
    0 0 60px var(--hero-overlay);
  max-width: 14ch;
  animation: fade-up 0.9s 0.12s ease both;
}

.ld-hero-title em {
  font-style: normal;
  color: var(--gold-hi);
  text-shadow:
    var(--hero-text-shadow),
    0 0 50px var(--hero-overlay);
}

.ld-hero-desc {
  font-size: clamp(1rem, 2vw, 1.15rem);
  color: var(--parchment-dim);
  max-width: 56ch;
  line-height: 1.7;
  animation: fade-up 0.9s 0.22s ease both;
}

.ld-hero-cta {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  animation: fade-up 0.9s 0.34s ease both;
}

.ld-hero-stats {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 18px 32px;
  background: var(--landing-panel-bg);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--bevel), var(--shadow-soft);
  animation: fade-up 0.9s 0.46s ease both;
}

.ld-hero-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.ld-hero-stat strong {
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  color: var(--gold-hi);
  line-height: 1;
  text-shadow: 0 0 20px var(--hero-overlay);
}

.ld-hero-stat span {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--parchment-dim);
}

.ld-hero-stat-divider {
  width: 1px;
  height: 36px;
  background: linear-gradient(180deg, transparent, var(--border-hi), transparent);
}

.ld-hero-scroll-hint {
  position: absolute;
  bottom: 28px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 1;
  animation: fade-up 1s 1s ease both;
}

.ld-scroll-gem {
  width: 6px;
  height: 6px;
  background: var(--gold-dim);
  transform: rotate(45deg);
}

.ld-scroll-line {
  width: 1px;
  height: 32px;
  background: linear-gradient(180deg, var(--gold-dim), transparent);
  animation: scroll-pulse 2s ease-in-out infinite;
}

@keyframes scroll-pulse {
  0%, 100% { opacity: 0.4; transform: scaleY(0.7); }
  50% { opacity: 1; transform: scaleY(1); }
}

.ld-section {
  padding: 96px 0;
}

.ld-section-header {
  text-align: center;
  max-width: 640px;
  margin: 0 auto 60px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ld-eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.35em;
  font-size: 0.7rem;
  color: var(--gold);
}

.ld-section-header h2 {
  font-size: clamp(1.9rem, 4vw, 3rem);
  font-variant: small-caps;
  letter-spacing: 0.08em;
  color: var(--parchment);
  text-shadow: var(--hero-text-shadow);
}

.ld-section-desc {
  color: var(--parchment-dim);
  font-size: 0.96rem;
  line-height: 1.7;
}

.ld-features {
  background: var(--landing-section-bg);
}

.ld-features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.ld-feature-icon {
  font-size: 2.2rem;
  line-height: 1;
}

.ld-maps {
  background: var(--landing-map-section-bg);
}

.ld-maps-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 32px;
}

.ld-map-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.ld-map-frame {
  position: relative;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius);
  overflow: hidden;
  border: 2px solid var(--border-hi);
  box-shadow:
    0 0 0 1px var(--overlay),
    var(--shadow),
    inset 0 1px 0 var(--border-hi);
  transition: transform 250ms ease, box-shadow 250ms ease;
}

.ld-map-frame:hover {
  transform: translateY(-4px) scale(1.01);
  box-shadow:
    0 0 0 1px var(--overlay),
    var(--shadow),
    inset 0 1px 0 var(--border-hi);
}

.ld-map-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: contrast(1.08) saturate(0.85);
  display: block;
}

.ld-map-frame--tall img {
  aspect-ratio: 4 / 5;
  object-position: center top;
}

.ld-map-frame::after {
  content: "";
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at center, transparent 35%, var(--overlay) 100%),
    linear-gradient(180deg, var(--overlay) 0%, transparent 18%, transparent 78%, var(--overlay) 100%);
  pointer-events: none;
  z-index: 1;
}

.ld-map-hud-top {
  position: absolute;
  top: 0;
  inset-inline: 0;
  z-index: 2;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: linear-gradient(180deg, var(--overlay) 0%, transparent 100%);
}

.ld-map-hud-label {
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  font-style: italic;
}

.ld-map-players {
  display: flex;
  gap: 5px;
  align-items: center;
}

.ld-mp {
  display: block;
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: var(--player-color, var(--accent));
  border: 1.5px solid var(--text-inverse);
  box-shadow: 0 0 6px var(--player-color, var(--accent));
}

.ld-map-hud-bottom {
  position: absolute;
  bottom: 0;
  inset-inline: 0;
  z-index: 2;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  gap: 18px;
  background: linear-gradient(0deg, var(--overlay) 0%, transparent 100%);
  font-size: 0.72rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.ld-map-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ld-map-info h3 {
  font-size: 1.35rem;
  font-variant: small-caps;
  letter-spacing: 0.08em;
  color: var(--parchment);
}

.ld-map-info p {
  color: var(--parchment-dim);
  font-size: 0.92rem;
  line-height: 1.65;
}

.ld-map-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ld-map-tags li {
  padding: 4px 12px;
  border-radius: 2px;
  border: 1px solid var(--border);
  background: var(--badge-bg);
  color: var(--gold);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
}

.ld-howto {
  background: var(--landing-howto-bg);
}

.ld-steps {
  display: flex;
  align-items: flex-start;
  gap: 0;
  max-width: 1000px;
  margin: 0 auto;
}

.ld-step {
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
  padding: 32px 20px;
}

.ld-step-num {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  border: 1px solid var(--border-hi);
  background: var(--button-primary-bg);
  box-shadow: var(--button-primary-shadow);
  font-size: 1.15rem;
  font-variant: small-caps;
  letter-spacing: 0.1em;
  color: var(--gold);
  flex-shrink: 0;
}

.ld-step-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ld-step-body h3 {
  font-size: 1.1rem;
  font-variant: small-caps;
  letter-spacing: 0.07em;
  color: var(--parchment);
}

.ld-step-body p {
  color: var(--parchment-dim);
  font-size: 0.9rem;
  line-height: 1.65;
}

.ld-step-connector {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 44px;
}

.ld-step-connector-line {
  width: 48px;
  height: 1px;
  background: linear-gradient(90deg, var(--border-hi), var(--gold-dim));
}

.ld-step-connector-gem {
  width: 6px;
  height: 6px;
  background: var(--gold-dim);
  transform: rotate(45deg);
}

.ld-final-cta {
  position: relative;
  padding: 120px 0;
  overflow: hidden;
}

.ld-final-cta-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 50%, var(--hero-overlay) 0%, transparent 60%),
    url("/assets/maps/middle-earth.jpg") center/cover no-repeat;
  filter: brightness(0.15) contrast(1.1);
}

.ld-final-cta::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--landing-final-overlay);
}

.ld-final-cta-inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
}

.ld-final-cta-ornament {
  font-size: 2.8rem;
  color: var(--gold-dim);
  text-shadow: 0 0 30px var(--hero-overlay);
  line-height: 1;
  margin-bottom: 4px;
  animation: ornament-pulse 4s ease-in-out infinite;
}

@keyframes ornament-pulse {
  0%, 100% { opacity: 0.6; text-shadow: 0 0 30px var(--gold-dim); }
  50% { opacity: 1; text-shadow: 0 0 50px var(--hero-overlay); }
}

.ld-final-cta-inner .ld-eyebrow {
  letter-spacing: 0.4em;
}

.ld-final-cta-inner h2 {
  font-size: clamp(2rem, 5vw, 3.8rem);
  font-variant: small-caps;
  letter-spacing: 0.1em;
  color: var(--parchment);
  text-shadow:
    var(--hero-text-shadow),
    0 0 60px var(--hero-overlay);
}

.ld-final-cta-desc {
  color: var(--parchment-dim);
  font-size: 1rem;
  max-width: 50ch;
  line-height: 1.7;
}

.ld-final-cta-btns {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 8px;
}

.ld-footer {
  background: var(--landing-footer-bg);
  border-top: 1px solid var(--border);
  padding: 24px 0;
}

.ld-footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.ld-footer-links {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.ld-footer-links a {
  padding: 6px 12px;
  border-radius: 3px;
  color: var(--parchment-dim);
  font-size: 0.84rem;
  font-variant: small-caps;
  letter-spacing: 0.05em;
  transition: color 100ms ease, background 100ms ease;
}

.ld-footer-links a:hover {
  color: var(--gold-hi);
  background: var(--badge-bg);
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .ld-hero-bg,
  .ld-hero-eyebrow,
  .ld-hero-title,
  .ld-hero-desc,
  .ld-hero-cta,
  .ld-hero-stats,
  .ld-hero-scroll-hint,
  .ld-final-cta-ornament {
    animation: none !important;
    transform: none !important;
  }
}

@media (max-width: 1024px) {
  .ld-features-grid {
    grid-template-columns: 1fr;
    max-width: 560px;
    margin-inline: auto;
  }

  .ld-maps-grid {
    grid-template-columns: 1fr;
    max-width: 680px;
    margin-inline: auto;
  }

  .ld-steps {
    flex-direction: column;
    align-items: center;
    max-width: 480px;
  }

  .ld-step {
    width: 100%;
    flex-direction: row;
    text-align: left;
    padding: 20px 0;
    gap: 20px;
  }

  .ld-step-connector {
    flex-direction: row;
    padding-top: 0;
    padding-left: 28px;
    width: 100%;
  }

  .ld-step-connector-line {
    width: 1px;
    height: 32px;
    background: linear-gradient(180deg, var(--border-hi), var(--gold-dim));
  }

  .ld-step-connector-gem {
    display: none;
  }
}

@media (max-width: 760px) {
  .ld-header-inner {
    gap: 16px;
    height: auto;
    min-height: 60px;
    padding: 10px 0;
    flex-wrap: wrap;
  }

  .ld-nav-links {
    display: none;
  }

  .ld-menu-toggle {
    display: inline-flex;
    margin-left: auto;
  }

  .ld-nav-actions {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .ld-locale-control {
    order: -1;
  }

  .ld-section {
    padding: 64px 0;
  }

  .ld-hero-stats {
    gap: 16px;
    padding: 14px 20px;
  }

  .ld-hero-cta {
    flex-direction: column;
    width: 100%;
    max-width: 320px;
  }

  .ld-btn-lg {
    width: 100%;
  }

  .ld-map-hud-bottom {
    gap: 10px;
    font-size: 0.65rem;
  }

  .ld-footer-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .ld-final-cta {
    padding: 80px 0;
  }
}

@media (max-width: 480px) {
  .ld-container {
    width: calc(100% - 32px);
  }

  .ld-locale-label {
    display: none;
  }

  .ld-nav-actions .ld-btn-ghost,
  .ld-nav-actions .ld-btn-primary {
    flex: 1 1 calc(50% - 6px);
    justify-content: center;
  }
}
`,
  "shell.css": String.raw`/* Theme token definitions start */
:root,
html[data-theme="command"] {
  --bg: #0e0c09;
  --bg-soft: #1b1711;
  --panel: rgba(32, 28, 20, 0.9);
  --panel-strong: rgba(22, 19, 14, 0.96);
  --overlay: rgba(10, 8, 6, 0.48);
  --grid: rgba(200, 164, 39, 0.035);
  --hero-overlay: rgba(194, 170, 92, 0.18);
  --text: #e3cfab;
  --text-muted: rgba(212, 184, 136, 0.68);
  --text-inverse: #f0d9a8;
  --heading: #f3ddaf;
  --caption: rgba(232, 194, 104, 0.8);
  --accent: #c8a427;
  --accent-2: #8e6f2a;
  --gold: #e8c244;
  --gold-hi: #f4d050;
  --gold-dim: rgba(200, 164, 39, 0.55);
  --border: rgba(200, 164, 39, 0.2);
  --border-hi: rgba(232, 194, 68, 0.5);
  --line: rgba(200, 164, 39, 0.16);
  --shadow: 0 24px 56px rgba(0, 0, 0, 0.45);
  --shadow-soft: 0 12px 28px rgba(0, 0, 0, 0.28);
  --bevel:
    inset 0 2px 0 rgba(255, 230, 140, 0.13),
    inset 0 -2px 0 rgba(0, 0, 0, 0.55),
    inset 2px 0 0 rgba(255, 230, 140, 0.06),
    inset -2px 0 0 rgba(0, 0, 0, 0.35);
  --success: #d8e0b0;
  --success-bg: rgba(80, 96, 44, 0.24);
  --success-border: rgba(164, 194, 91, 0.18);
  --warning: #f7e5ba;
  --warning-bg: rgba(200, 164, 39, 0.12);
  --warning-border: rgba(232, 194, 68, 0.26);
  --danger: #f1c0b7;
  --danger-bg: rgba(139, 49, 36, 0.24);
  --danger-border: rgba(217, 108, 86, 0.2);
  --focus-ring: rgba(232, 194, 68, 0.82);
  --control-bg: linear-gradient(180deg, rgba(44, 40, 28, 0.96), rgba(28, 24, 18, 0.94));
  --control-bg-hover: linear-gradient(180deg, rgba(56, 50, 34, 0.98), rgba(36, 31, 22, 0.96));
  --card-bg: linear-gradient(180deg, rgba(42, 36, 26, 0.94), rgba(24, 21, 15, 0.92));
  --card-bg-hover: linear-gradient(180deg, rgba(46, 39, 27, 0.96), rgba(25, 22, 16, 0.96));
  --badge-bg: rgba(200, 164, 39, 0.08);
  --app-shell-bg:
    radial-gradient(circle at top, var(--hero-overlay), transparent 30%),
    linear-gradient(180deg, #18140d 0%, #0e0c09 44%, #1d190f 100%);
  --marketing-shell-bg: var(--bg);
  --backdrop-grid:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  --shell-surface-bg:
    radial-gradient(circle at top right, rgba(194, 170, 92, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(40, 34, 22, 0.97), rgba(22, 19, 14, 0.95));
  --shell-top-wash: linear-gradient(180deg, rgba(108, 84, 44, 0.18), transparent);
  --page-aura-bg:
    radial-gradient(circle at top center, rgba(200, 164, 39, 0.18), transparent 34%),
    radial-gradient(circle at 12% 18%, rgba(255, 214, 115, 0.08), transparent 22%),
    linear-gradient(180deg, rgba(18, 15, 10, 0.92), rgba(18, 15, 10, 0.08));
  --campaign-shell-bg:
    radial-gradient(circle at top right, rgba(200, 164, 39, 0.08), transparent 30%),
    linear-gradient(180deg, rgba(46, 36, 24, 0.88), rgba(28, 22, 15, 0.8));
  --campaign-shell-overlay:
    linear-gradient(135deg, rgba(255, 255, 255, 0.03), transparent 36%),
    linear-gradient(180deg, rgba(200, 164, 39, 0.04), transparent 24%);
  --hero-panel-bg:
    radial-gradient(circle at top right, rgba(200, 164, 39, 0.14), transparent 36%),
    linear-gradient(180deg, rgba(28, 23, 16, 0.94), rgba(18, 15, 10, 0.9));
  --hero-text-shadow: 0 3px 16px rgba(0, 0, 0, 0.6);
  --status-surface: rgba(12, 10, 8, 0.34);
  --focus-card-bg:
    radial-gradient(circle at top right, rgba(200, 164, 39, 0.24), transparent 44%),
    linear-gradient(180deg, rgba(53, 40, 26, 0.98), rgba(29, 23, 16, 0.98));
  --nav-surface:
    linear-gradient(180deg, rgba(27, 24, 16, 0.96), rgba(16, 14, 10, 0.94)),
    radial-gradient(circle at top, rgba(200, 164, 39, 0.08), transparent 52%);
  --nav-hover-bg: rgba(200, 164, 39, 0.14);
  --nav-active-bg: rgba(200, 164, 39, 0.2);
  --button-primary-bg:
    radial-gradient(ellipse at top, rgba(255, 212, 92, 0.22) 0%, transparent 56%),
    linear-gradient(180deg, #756125 0%, #473811 100%);
  --button-primary-bg-hover:
    radial-gradient(ellipse at top, rgba(255, 223, 112, 0.3) 0%, transparent 56%),
    linear-gradient(180deg, #8b722d 0%, #564414 100%);
  --button-primary-border: rgba(200, 164, 39, 0.6);
  --button-primary-border-hover: rgba(200, 164, 39, 0.82);
  --button-primary-text: var(--gold);
  --button-primary-text-hover: var(--gold-hi);
  --button-primary-shadow: var(--bevel), 0 6px 20px rgba(0, 0, 0, 0.5);
  --button-primary-shadow-hover: var(--bevel), 0 12px 28px rgba(0, 0, 0, 0.55);
  --button-ghost-bg: linear-gradient(180deg, rgba(44, 42, 28, 0.98), rgba(28, 26, 18, 0.96));
  --button-ghost-bg-hover: linear-gradient(180deg, rgba(58, 54, 32, 1), rgba(38, 34, 24, 0.98));
  --button-danger-bg:
    radial-gradient(ellipse at top, rgba(255, 144, 120, 0.18) 0%, transparent 55%),
    linear-gradient(180deg, #7f2e20 0%, #54170f 100%);
  --button-danger-border: rgba(217, 118, 86, 0.52);
  --button-danger-text: #ffe5da;
  --field-bg: linear-gradient(180deg, rgba(44, 42, 28, 0.98), rgba(28, 26, 18, 0.96));
  --field-text: #f0dcc0;
  --field-placeholder: rgba(212, 184, 136, 0.46);
  --feature-card-bg: linear-gradient(180deg, rgba(37, 34, 24, 1), rgba(28, 26, 18, 0.98));
  --feature-card-accent-bg:
    radial-gradient(ellipse at top right, rgba(200, 164, 39, 0.12) 0%, transparent 55%),
    linear-gradient(180deg, rgba(46, 43, 28, 1), rgba(30, 28, 18, 0.98));
  --metric-win-bg:
    radial-gradient(circle at top right, rgba(114, 171, 82, 0.16), transparent 44%),
    linear-gradient(180deg, rgba(39, 51, 29, 0.96), rgba(21, 30, 17, 0.94));
  --metric-loss-bg:
    radial-gradient(circle at top right, rgba(186, 90, 73, 0.16), transparent 44%),
    linear-gradient(180deg, rgba(57, 34, 28, 0.96), rgba(31, 20, 17, 0.94));
  --metric-neutral-bg:
    radial-gradient(circle at top right, rgba(128, 143, 171, 0.12), transparent 44%),
    linear-gradient(180deg, rgba(35, 37, 43, 0.96), rgba(20, 22, 27, 0.94));
  --metric-gold-bg:
    radial-gradient(circle at top right, rgba(232, 194, 68, 0.18), transparent 44%),
    linear-gradient(180deg, rgba(66, 51, 24, 0.98), rgba(34, 27, 15, 0.96));
  --owner-color-default: #9aa6b2;
  --owner-text-default: #2c1f14;
  --avatar-bg:
    radial-gradient(circle at top, rgba(232, 194, 68, 0.14), transparent 58%),
    linear-gradient(180deg, rgba(42, 37, 27, 0.96), rgba(24, 21, 15, 0.94));
  --footer-shell-bg:
    radial-gradient(circle at top right, rgba(232, 194, 68, 0.14), transparent 48%),
    linear-gradient(180deg, rgba(30, 26, 19, 0.98), rgba(16, 14, 10, 0.96));
  --landing-header-bg: linear-gradient(180deg, rgba(31, 28, 17, 0.97) 0%, rgba(19, 17, 11, 0.95) 100%);
  --landing-hero-overlay:
    radial-gradient(ellipse at 50% 40%, rgba(194, 170, 92, 0.12) 0%, transparent 56%),
    linear-gradient(180deg, rgba(14, 12, 9, 0.42) 0%, rgba(14, 12, 9, 0.08) 42%, rgba(14, 12, 9, 0.14) 60%, rgba(14, 12, 9, 0.88) 100%);
  --landing-panel-bg: linear-gradient(180deg, rgba(34, 31, 21, 0.9) 0%, rgba(20, 18, 12, 0.9) 100%);
  --landing-section-bg:
    radial-gradient(ellipse at 50% 0%, rgba(194, 170, 92, 0.11) 0%, transparent 52%),
    linear-gradient(180deg, #17140f 0%, #0e0c09 100%);
  --landing-map-section-bg: linear-gradient(180deg, #0e0c09 0%, #18150f 50%, #0e0c09 100%);
  --landing-howto-bg:
    radial-gradient(ellipse at 50% 100%, rgba(194, 170, 92, 0.1) 0%, transparent 52%),
    linear-gradient(180deg, #0e0c09 0%, #17140f 100%);
  --landing-final-overlay: linear-gradient(180deg, rgba(14, 12, 9, 0.85) 0%, transparent 30%, transparent 70%, rgba(14, 12, 9, 0.85) 100%);
  --landing-footer-bg: linear-gradient(180deg, #0e0c09 0%, #080705 100%);
  --radius: 6px;
  --campaign-shell-radius: 6px;
  --campaign-card-radius: 6px;
  --campaign-control-radius: 3px;
  --campaign-soft-radius: 6px;
  --muted: var(--text-muted);
  --parchment: var(--text);
  --parchment-dim: var(--text-muted);
}

html[data-theme="midnight"] {
  --bg: #07111d;
  --bg-soft: #0f1b2b;
  --panel: rgba(16, 26, 39, 0.9);
  --panel-strong: rgba(10, 18, 29, 0.96);
  --overlay: rgba(4, 8, 14, 0.52);
  --grid: rgba(93, 164, 245, 0.04);
  --hero-overlay: rgba(93, 164, 245, 0.22);
  --text: #d7e7f7;
  --text-muted: rgba(184, 206, 230, 0.7);
  --text-inverse: #eff7ff;
  --heading: #eff7ff;
  --caption: rgba(162, 214, 255, 0.9);
  --accent: #5da4f5;
  --accent-2: #2d6395;
  --gold: #85c1ff;
  --gold-hi: #b2dbff;
  --gold-dim: rgba(93, 164, 245, 0.52);
  --border: rgba(93, 164, 245, 0.22);
  --border-hi: rgba(133, 193, 255, 0.56);
  --line: rgba(93, 164, 245, 0.18);
  --shadow: 0 24px 56px rgba(0, 0, 0, 0.54);
  --shadow-soft: 0 12px 28px rgba(0, 0, 0, 0.34);
  --bevel:
    inset 0 2px 0 rgba(173, 217, 255, 0.12),
    inset 0 -2px 0 rgba(0, 0, 0, 0.58),
    inset 2px 0 0 rgba(173, 217, 255, 0.06),
    inset -2px 0 0 rgba(0, 0, 0, 0.38);
  --success: #c7e5d5;
  --success-bg: rgba(36, 93, 79, 0.32);
  --success-border: rgba(105, 190, 161, 0.22);
  --warning: #cfe8ff;
  --warning-bg: rgba(67, 112, 161, 0.22);
  --warning-border: rgba(133, 193, 255, 0.3);
  --danger: #ffd4cf;
  --danger-bg: rgba(122, 57, 78, 0.26);
  --danger-border: rgba(226, 132, 155, 0.24);
  --focus-ring: rgba(133, 193, 255, 0.84);
  --control-bg: linear-gradient(180deg, rgba(25, 38, 56, 0.98), rgba(13, 21, 33, 0.96));
  --control-bg-hover: linear-gradient(180deg, rgba(32, 49, 71, 1), rgba(18, 29, 44, 0.98));
  --card-bg: linear-gradient(180deg, rgba(24, 37, 54, 0.94), rgba(12, 20, 31, 0.92));
  --card-bg-hover: linear-gradient(180deg, rgba(28, 43, 63, 0.96), rgba(15, 24, 36, 0.96));
  --badge-bg: rgba(93, 164, 245, 0.1);
  --app-shell-bg:
    radial-gradient(circle at top, var(--hero-overlay), transparent 34%),
    linear-gradient(180deg, #050d18 0%, #07111d 40%, #0d2740 100%);
  --marketing-shell-bg: linear-gradient(180deg, #07111d 0%, #091624 100%);
  --backdrop-grid:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  --shell-surface-bg:
    radial-gradient(circle at top right, rgba(93, 164, 245, 0.16), transparent 36%),
    linear-gradient(180deg, rgba(19, 34, 56, 0.97), rgba(10, 20, 33, 0.95));
  --shell-top-wash: linear-gradient(180deg, rgba(78, 130, 189, 0.2), transparent);
  --page-aura-bg:
    radial-gradient(circle at top center, rgba(93, 164, 245, 0.22), transparent 36%),
    radial-gradient(circle at 14% 20%, rgba(173, 217, 255, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(9, 15, 24, 0.94), rgba(9, 15, 24, 0.08));
  --campaign-shell-bg:
    radial-gradient(circle at top right, rgba(93, 164, 245, 0.1), transparent 32%),
    linear-gradient(180deg, rgba(18, 29, 44, 0.9), rgba(10, 17, 26, 0.84));
  --campaign-shell-overlay:
    linear-gradient(135deg, rgba(255, 255, 255, 0.035), transparent 36%),
    linear-gradient(180deg, rgba(93, 164, 245, 0.05), transparent 24%);
  --hero-panel-bg:
    radial-gradient(circle at top right, rgba(93, 164, 245, 0.16), transparent 38%),
    linear-gradient(180deg, rgba(15, 26, 39, 0.96), rgba(9, 17, 26, 0.92));
  --hero-text-shadow: 0 3px 18px rgba(1, 5, 9, 0.72);
  --status-surface: rgba(8, 13, 20, 0.42);
  --focus-card-bg:
    radial-gradient(circle at top right, rgba(93, 164, 245, 0.26), transparent 44%),
    linear-gradient(180deg, rgba(24, 41, 62, 0.98), rgba(11, 20, 31, 0.98));
  --nav-surface:
    linear-gradient(180deg, rgba(14, 25, 37, 0.98), rgba(8, 15, 24, 0.96)),
    radial-gradient(circle at top, rgba(93, 164, 245, 0.1), transparent 54%);
  --nav-hover-bg: rgba(93, 164, 245, 0.18);
  --nav-active-bg: rgba(93, 164, 245, 0.26);
  --button-primary-bg:
    radial-gradient(ellipse at top, rgba(162, 214, 255, 0.3) 0%, transparent 60%),
    linear-gradient(180deg, #1c5f94 0%, #11324f 100%);
  --button-primary-bg-hover:
    radial-gradient(ellipse at top, rgba(194, 230, 255, 0.34) 0%, transparent 60%),
    linear-gradient(180deg, #2574af 0%, #153d60 100%);
  --button-primary-border: rgba(133, 193, 255, 0.58);
  --button-primary-border-hover: rgba(173, 217, 255, 0.82);
  --button-primary-text: #dff0ff;
  --button-primary-text-hover: #f2f9ff;
  --button-primary-shadow: var(--bevel), 0 6px 20px rgba(0, 0, 0, 0.58);
  --button-primary-shadow-hover: var(--bevel), 0 12px 28px rgba(0, 0, 0, 0.62);
  --button-ghost-bg: linear-gradient(180deg, rgba(21, 34, 49, 0.98), rgba(11, 19, 29, 0.96));
  --button-ghost-bg-hover: linear-gradient(180deg, rgba(29, 45, 65, 1), rgba(14, 24, 37, 0.98));
  --button-danger-bg:
    radial-gradient(ellipse at top, rgba(255, 142, 170, 0.18) 0%, transparent 55%),
    linear-gradient(180deg, #6d2f4a 0%, #431a2d 100%);
  --button-danger-border: rgba(226, 132, 155, 0.48);
  --button-danger-text: #ffe3eb;
  --field-bg: linear-gradient(180deg, rgba(21, 34, 49, 0.98), rgba(11, 19, 29, 0.96));
  --field-text: #e7f2ff;
  --field-placeholder: rgba(184, 206, 230, 0.48);
  --feature-card-bg: linear-gradient(180deg, rgba(19, 31, 46, 1), rgba(11, 19, 29, 0.98));
  --feature-card-accent-bg:
    radial-gradient(ellipse at top right, rgba(93, 164, 245, 0.14) 0%, transparent 55%),
    linear-gradient(180deg, rgba(23, 39, 58, 1), rgba(14, 24, 36, 0.98));
  --metric-win-bg:
    radial-gradient(circle at top right, rgba(73, 208, 174, 0.16), transparent 44%),
    linear-gradient(180deg, rgba(17, 57, 55, 0.96), rgba(11, 31, 33, 0.94));
  --metric-loss-bg:
    radial-gradient(circle at top right, rgba(240, 114, 159, 0.16), transparent 44%),
    linear-gradient(180deg, rgba(72, 28, 49, 0.96), rgba(36, 14, 24, 0.94));
  --metric-neutral-bg:
    radial-gradient(circle at top right, rgba(128, 157, 198, 0.14), transparent 44%),
    linear-gradient(180deg, rgba(30, 41, 58, 0.96), rgba(18, 24, 35, 0.94));
  --metric-gold-bg:
    radial-gradient(circle at top right, rgba(133, 193, 255, 0.18), transparent 44%),
    linear-gradient(180deg, rgba(26, 52, 80, 0.98), rgba(13, 27, 43, 0.96));
  --avatar-bg:
    radial-gradient(circle at top, rgba(133, 193, 255, 0.18), transparent 58%),
    linear-gradient(180deg, rgba(25, 39, 58, 0.96), rgba(12, 20, 31, 0.94));
  --footer-shell-bg:
    radial-gradient(circle at top right, rgba(133, 193, 255, 0.14), transparent 48%),
    linear-gradient(180deg, rgba(17, 28, 43, 0.98), rgba(8, 14, 22, 0.96));
  --landing-header-bg: linear-gradient(180deg, rgba(12, 25, 42, 0.97) 0%, rgba(8, 16, 28, 0.95) 100%);
  --landing-hero-overlay:
    radial-gradient(ellipse at 50% 40%, rgba(93, 164, 245, 0.16) 0%, transparent 58%),
    linear-gradient(180deg, rgba(7, 17, 29, 0.46) 0%, rgba(7, 17, 29, 0.08) 42%, rgba(7, 17, 29, 0.14) 60%, rgba(7, 17, 29, 0.9) 100%);
  --landing-panel-bg: linear-gradient(180deg, rgba(15, 29, 47, 0.9) 0%, rgba(8, 17, 29, 0.92) 100%);
  --landing-section-bg:
    radial-gradient(ellipse at 50% 0%, rgba(93, 164, 245, 0.14) 0%, transparent 54%),
    linear-gradient(180deg, #0f1d30 0%, #07111d 100%);
  --landing-map-section-bg: linear-gradient(180deg, #07111d 0%, #102336 50%, #07111d 100%);
  --landing-howto-bg:
    radial-gradient(ellipse at 50% 100%, rgba(93, 164, 245, 0.12) 0%, transparent 54%),
    linear-gradient(180deg, #07111d 0%, #102336 100%);
  --landing-final-overlay: linear-gradient(180deg, rgba(7, 17, 29, 0.88) 0%, transparent 30%, transparent 70%, rgba(7, 17, 29, 0.88) 100%);
  --landing-footer-bg: linear-gradient(180deg, #07111d 0%, #040b13 100%);
  --muted: var(--text-muted);
  --parchment: var(--text);
  --parchment-dim: var(--text-muted);
}

html[data-theme="ember"] {
  --bg: #140b09;
  --bg-soft: #24120e;
  --panel: rgba(39, 21, 16, 0.9);
  --panel-strong: rgba(26, 14, 12, 0.96);
  --overlay: rgba(14, 7, 6, 0.5);
  --grid: rgba(208, 106, 68, 0.038);
  --hero-overlay: rgba(226, 104, 55, 0.22);
  --text: #f0d4c6;
  --text-muted: rgba(229, 186, 165, 0.7);
  --text-inverse: #fff0e7;
  --heading: #fff0e7;
  --caption: rgba(255, 170, 112, 0.9);
  --accent: #d06a44;
  --accent-2: #924327;
  --gold: #ff9a66;
  --gold-hi: #ffbc8f;
  --gold-dim: rgba(208, 106, 68, 0.56);
  --border: rgba(208, 106, 68, 0.22);
  --border-hi: rgba(255, 154, 102, 0.54);
  --line: rgba(208, 106, 68, 0.18);
  --shadow: 0 24px 56px rgba(0, 0, 0, 0.5);
  --shadow-soft: 0 12px 28px rgba(0, 0, 0, 0.3);
  --bevel:
    inset 0 2px 0 rgba(255, 176, 136, 0.12),
    inset 0 -2px 0 rgba(0, 0, 0, 0.56),
    inset 2px 0 0 rgba(255, 176, 136, 0.06),
    inset -2px 0 0 rgba(0, 0, 0, 0.36);
  --success: #d4e1bc;
  --success-bg: rgba(71, 96, 37, 0.28);
  --success-border: rgba(171, 203, 93, 0.2);
  --warning: #ffd8c2;
  --warning-bg: rgba(146, 67, 39, 0.24);
  --warning-border: rgba(255, 154, 102, 0.28);
  --danger: #ffe5da;
  --danger-bg: rgba(127, 46, 32, 0.3);
  --danger-border: rgba(217, 118, 86, 0.24);
  --focus-ring: rgba(255, 154, 102, 0.84);
  --control-bg: linear-gradient(180deg, rgba(52, 27, 22, 0.98), rgba(29, 16, 14, 0.96));
  --control-bg-hover: linear-gradient(180deg, rgba(65, 34, 27, 1), rgba(36, 20, 17, 0.98));
  --card-bg: linear-gradient(180deg, rgba(44, 25, 20, 0.94), rgba(24, 14, 12, 0.92));
  --card-bg-hover: linear-gradient(180deg, rgba(51, 30, 24, 0.96), rgba(30, 17, 15, 0.96));
  --badge-bg: rgba(208, 106, 68, 0.1);
  --app-shell-bg:
    radial-gradient(circle at top, var(--hero-overlay), transparent 34%),
    linear-gradient(180deg, #1f0c08 0%, #140b09 42%, #34150d 100%);
  --marketing-shell-bg: linear-gradient(180deg, #140b09 0%, #1a0f0d 100%);
  --backdrop-grid:
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  --shell-surface-bg:
    radial-gradient(circle at top right, rgba(226, 104, 55, 0.16), transparent 36%),
    linear-gradient(180deg, rgba(48, 24, 18, 0.97), rgba(24, 14, 12, 0.95));
  --shell-top-wash: linear-gradient(180deg, rgba(173, 71, 33, 0.2), transparent);
  --page-aura-bg:
    radial-gradient(circle at top center, rgba(208, 106, 68, 0.2), transparent 35%),
    radial-gradient(circle at 14% 20%, rgba(255, 176, 136, 0.08), transparent 24%),
    linear-gradient(180deg, rgba(20, 11, 9, 0.94), rgba(20, 11, 9, 0.08));
  --campaign-shell-bg:
    radial-gradient(circle at top right, rgba(208, 106, 68, 0.1), transparent 32%),
    linear-gradient(180deg, rgba(54, 31, 24, 0.9), rgba(30, 17, 14, 0.84));
  --campaign-shell-overlay:
    linear-gradient(135deg, rgba(255, 255, 255, 0.03), transparent 36%),
    linear-gradient(180deg, rgba(208, 106, 68, 0.05), transparent 24%);
  --hero-panel-bg:
    radial-gradient(circle at top right, rgba(208, 106, 68, 0.16), transparent 38%),
    linear-gradient(180deg, rgba(36, 21, 18, 0.96), rgba(21, 12, 10, 0.92));
  --hero-text-shadow: 0 3px 18px rgba(8, 3, 2, 0.72);
  --status-surface: rgba(18, 9, 8, 0.38);
  --focus-card-bg:
    radial-gradient(circle at top right, rgba(208, 106, 68, 0.26), transparent 44%),
    linear-gradient(180deg, rgba(58, 33, 27, 0.98), rgba(31, 18, 16, 0.98));
  --nav-surface:
    linear-gradient(180deg, rgba(32, 19, 16, 0.98), rgba(18, 10, 9, 0.96)),
    radial-gradient(circle at top, rgba(208, 106, 68, 0.1), transparent 54%);
  --nav-hover-bg: rgba(226, 104, 55, 0.2);
  --nav-active-bg: rgba(226, 104, 55, 0.28);
  --button-primary-bg:
    radial-gradient(ellipse at top, rgba(255, 170, 112, 0.3) 0%, transparent 60%),
    linear-gradient(180deg, #9d421e 0%, #68220c 100%);
  --button-primary-bg-hover:
    radial-gradient(ellipse at top, rgba(255, 206, 165, 0.34) 0%, transparent 60%),
    linear-gradient(180deg, #ba5122 0%, #7c2810 100%);
  --button-primary-border: rgba(255, 154, 102, 0.56);
  --button-primary-border-hover: rgba(255, 188, 143, 0.8);
  --button-primary-text: #ffe5d6;
  --button-primary-text-hover: #fff0e7;
  --button-primary-shadow: var(--bevel), 0 6px 20px rgba(0, 0, 0, 0.54);
  --button-primary-shadow-hover: var(--bevel), 0 12px 28px rgba(0, 0, 0, 0.6);
  --button-ghost-bg: linear-gradient(180deg, rgba(46, 28, 24, 0.98), rgba(27, 16, 14, 0.96));
  --button-ghost-bg-hover: linear-gradient(180deg, rgba(59, 35, 28, 1), rgba(35, 20, 17, 0.98));
  --button-danger-bg:
    radial-gradient(ellipse at top, rgba(255, 196, 164, 0.2) 0%, transparent 55%),
    linear-gradient(180deg, #a32c1d 0%, #6a140f 100%);
  --button-danger-border: rgba(255, 176, 136, 0.5);
  --button-danger-text: #fff0e7;
  --field-bg: linear-gradient(180deg, rgba(46, 28, 24, 0.98), rgba(27, 16, 14, 0.96));
  --field-text: #f6ddd1;
  --field-placeholder: rgba(229, 186, 165, 0.48);
  --feature-card-bg: linear-gradient(180deg, rgba(41, 25, 21, 1), rgba(27, 16, 14, 0.98));
  --feature-card-accent-bg:
    radial-gradient(ellipse at top right, rgba(208, 106, 68, 0.14) 0%, transparent 55%),
    linear-gradient(180deg, rgba(48, 29, 24, 1), rgba(30, 18, 15, 0.98));
  --metric-win-bg:
    radial-gradient(circle at top right, rgba(171, 203, 93, 0.16), transparent 44%),
    linear-gradient(180deg, rgba(55, 50, 24, 0.96), rgba(28, 27, 13, 0.94));
  --metric-loss-bg:
    radial-gradient(circle at top right, rgba(255, 132, 102, 0.18), transparent 44%),
    linear-gradient(180deg, rgba(76, 28, 22, 0.96), rgba(38, 13, 12, 0.94));
  --metric-neutral-bg:
    radial-gradient(circle at top right, rgba(152, 142, 132, 0.14), transparent 44%),
    linear-gradient(180deg, rgba(49, 35, 31, 0.96), rgba(28, 19, 17, 0.94));
  --metric-gold-bg:
    radial-gradient(circle at top right, rgba(255, 154, 102, 0.2), transparent 44%),
    linear-gradient(180deg, rgba(74, 39, 22, 0.98), rgba(39, 20, 15, 0.96));
  --avatar-bg:
    radial-gradient(circle at top, rgba(255, 154, 102, 0.18), transparent 58%),
    linear-gradient(180deg, rgba(44, 25, 21, 0.96), rgba(24, 14, 12, 0.94));
  --footer-shell-bg:
    radial-gradient(circle at top right, rgba(255, 154, 102, 0.14), transparent 48%),
    linear-gradient(180deg, rgba(34, 20, 17, 0.98), rgba(16, 10, 9, 0.96));
  --landing-header-bg: linear-gradient(180deg, rgba(38, 19, 14, 0.97) 0%, rgba(22, 11, 9, 0.95) 100%);
  --landing-hero-overlay:
    radial-gradient(ellipse at 50% 40%, rgba(226, 104, 55, 0.17) 0%, transparent 58%),
    linear-gradient(180deg, rgba(20, 11, 9, 0.46) 0%, rgba(20, 11, 9, 0.08) 42%, rgba(20, 11, 9, 0.16) 60%, rgba(20, 11, 9, 0.9) 100%);
  --landing-panel-bg: linear-gradient(180deg, rgba(44, 22, 16, 0.9) 0%, rgba(23, 12, 10, 0.92) 100%);
  --landing-section-bg:
    radial-gradient(ellipse at 50% 0%, rgba(226, 104, 55, 0.14) 0%, transparent 54%),
    linear-gradient(180deg, #21100b 0%, #140b09 100%);
  --landing-map-section-bg: linear-gradient(180deg, #140b09 0%, #29120b 50%, #140b09 100%);
  --landing-howto-bg:
    radial-gradient(ellipse at 50% 100%, rgba(226, 104, 55, 0.12) 0%, transparent 54%),
    linear-gradient(180deg, #140b09 0%, #29120b 100%);
  --landing-final-overlay: linear-gradient(180deg, rgba(20, 11, 9, 0.88) 0%, transparent 30%, transparent 70%, rgba(20, 11, 9, 0.88) 100%);
  --landing-footer-bg: linear-gradient(180deg, #140b09 0%, #090505 100%);
  --muted: var(--text-muted);
  --parchment: var(--text);
  --parchment-dim: var(--text-muted);
}
/* Theme token definitions end */

* {
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: Georgia, "Trebuchet MS", serif;
}

[hidden] {
  display: none !important;
}

.skip-link {
  position: absolute;
  top: 10px;
  left: 12px;
  z-index: 400;
  padding: 10px 14px;
  border-radius: 999px;
  border: 1px solid var(--focus-ring);
  background: var(--panel);
  color: var(--heading);
  box-shadow: var(--shadow);
  transform: translateY(-160%);
  transition: transform 140ms ease;
}

.skip-link:focus-visible {
  transform: translateY(0);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

body[data-shell-kind="marketing"] {
  background: var(--marketing-shell-bg);
  color: var(--text);
  line-height: 1.65;
}

body[data-shell-kind="app"] {
  background: var(--app-shell-bg);
  color: var(--text);
}

.backdrop {
  position: fixed;
  inset: 0;
  background-size: 36px 36px;
  pointer-events: none;
}

body[data-shell-kind="app"] .backdrop {
  background-image: var(--backdrop-grid);
}

.top-nav-page-frame,
.game-app-frame {
  padding-top: 10px;
}

.top-nav-zone {
  min-width: 0;
  display: flex;
  align-items: center;
}

.top-nav-brand {
  flex: 0 0 auto;
  gap: 2px;
}

.top-nav-brand .eyebrow {
  margin: 0;
  color: var(--caption);
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-size: 0.58rem;
}

.top-nav-title {
  margin: 0;
  color: var(--heading);
  font-size: 1.05rem;
  font-variant: small-caps;
  letter-spacing: 0.08em;
  line-height: 1;
  text-shadow: var(--hero-text-shadow);
}

.top-nav-links {
  flex: 1 1 auto;
  display: flex;
  justify-content: center;
  gap: 6px;
}

.top-nav-actions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: nowrap;
  gap: 8px;
}

.top-nav-locale {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
}

.top-nav-auth-form {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

.top-nav-field {
  display: inline-flex;
}

.top-nav-auth-form[hidden] {
  display: none;
}

.top-nav-locale-select {
  width: auto;
  min-width: 102px;
  height: 34px;
  padding: 0 34px 0 10px;
  color: var(--field-text);
  background: var(--field-bg);
}

.top-nav-auth-form input {
  width: 108px;
  min-width: 0;
  height: 34px;
  padding: 0 10px;
  font: inherit;
  font-size: 0.82rem;
}

.top-nav-auth-form input::placeholder {
  color: var(--field-placeholder);
}

.top-nav-auth-feedback {
  min-width: min(220px, 100%);
}

.panel,
.session-browser,
.profile-shell,
.register-shell,
.new-game-shell,
.game-info-bottom,
.game-actions-rail {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: var(--campaign-shell-radius);
  box-shadow: var(--bevel), var(--shadow);
  backdrop-filter: blur(10px);
}

.left-rail,
.right-rail,
.center-stage,
.session-browser,
.profile-shell,
.register-shell,
.new-game-shell {
  background: var(--shell-surface-bg);
}

.session-browser,
.profile-shell,
.register-shell,
.new-game-shell {
  position: relative;
  overflow: hidden;
  padding: 20px;
}

.session-browser::before,
.profile-shell::before,
.register-shell::before,
.new-game-shell::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 72px;
  background: var(--shell-top-wash);
  pointer-events: none;
}

.campaign-page-shell {
  position: relative;
  padding-bottom: 20px;
}

.campaign-page-shell::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: min(36rem, 58vh);
  border-radius: 28px;
  background: var(--page-aura-bg);
  border: 1px solid var(--line);
  pointer-events: none;
  z-index: 0;
}

.campaign-page-shell > * {
  position: relative;
  z-index: 1;
}

.campaign-shell {
  position: relative;
  overflow: hidden;
  border-radius: var(--campaign-shell-radius);
  border: 1px solid var(--border);
  background: var(--campaign-shell-bg);
  box-shadow: var(--bevel), var(--shadow-soft);
}

.campaign-shell::before {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--campaign-shell-overlay);
  pointer-events: none;
}

.campaign-hero {
  position: relative;
  padding: 22px 24px;
  border-radius: 20px;
  border: 1px solid var(--border);
  background: var(--hero-panel-bg);
  box-shadow: var(--bevel), var(--shadow-soft);
}

.campaign-hero-copy {
  display: grid;
  gap: 8px;
}

.campaign-hero .eyebrow,
.campaign-hero .lobby-command-label,
.campaign-hero .profile-command-label {
  color: var(--caption);
  letter-spacing: 0.22em;
}

.campaign-hero h2,
.campaign-hero h3,
.campaign-hero .page-title {
  color: var(--heading);
  font-variant: small-caps;
  letter-spacing: 0.05em;
  text-shadow: var(--hero-text-shadow);
}

.campaign-hero .stage-copy,
.campaign-hero p:not(.eyebrow),
.campaign-focus-card p {
  color: var(--text-muted);
}

.campaign-status-line {
  margin-top: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  border: 1px solid var(--border);
  background: var(--status-surface);
  color: var(--text-muted);
}

.campaign-focus-grid {
  gap: 14px;
}

.campaign-focus-card {
  border-color: var(--border-hi);
  background: var(--focus-card-bg);
  box-shadow: var(--bevel), var(--shadow-soft);
}

.campaign-nav {
  min-height: 60px;
  background: var(--nav-surface);
  border: 1px solid var(--border-hi);
  box-shadow: var(--bevel), var(--shadow-soft);
}

.stage-copy,
.content-meta-line,
.game-meta-line span:first-child,
.content-meta-line > span:first-child,
.session-cell-muted,
.session-sub,
.action-help,
.combat-result-summary,
.combat-result-line span,
.auth-form-note,
.register-guidelines,
.map-setup-copy,
.setup-slot-note,
.field-stack span {
  color: var(--muted);
}

.section-title-row h3,
.tight-header h2,
.tight-header h1,
.session-browser-head h2,
.session-browser-head h1,
.profile-hero h2,
.profile-hero h1,
.register-hero h2,
.register-hero h1,
.new-game-shell h2,
.new-game-shell h1,
.new-game-shell h3,
.profile-shell h3,
.register-shell h3 {
  color: var(--heading);
  font-variant: small-caps;
  letter-spacing: 0.05em;
}

.eyebrow,
.lobby-command-label,
.profile-command-label,
.profile-section-eyebrow,
.lobby-command-card p + .lobby-command-label {
  color: var(--gold);
}

.badge {
  border: 1px solid var(--border-hi);
  background: var(--badge-bg);
  color: var(--heading);
}

.badge.accent {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

input,
select {
  border-color: var(--border);
  background: var(--field-bg);
  color: var(--field-text);
}

input::placeholder {
  color: var(--field-placeholder);
}

.session-list-panel,
.session-detail-panel,
.new-game-panel,
.setup-ruleset-card,
.map-setup-card,
.setup-options-stack,
.setup-slot,
.register-card,
.profile-note-card,
.profile-metric-card,
.profile-summary-card,
.game-session-card,
.game-roster-section,
.map-stage-command-strip,
.player-card,
.territory-card,
.log-list li,
.session-detail-item,
.session-detail-hero,
.session-detail-note {
  border: 1px solid var(--border);
  border-radius: var(--campaign-card-radius);
  background: var(--card-bg);
  box-shadow: var(--bevel);
  color: var(--text);
}

.profile-intel-card,
.profile-games-card {
  background: var(--feature-card-accent-bg);
}

.profile-metric-card.accent-win {
  background: var(--metric-win-bg);
}

.profile-metric-card.accent-loss {
  background: var(--metric-loss-bg);
}

.profile-metric-card.accent-neutral {
  background: var(--metric-neutral-bg);
}

.profile-metric-card.accent-gold {
  background: var(--metric-gold-bg);
}

.session-detail-note {
  background: var(--feature-card-accent-bg);
}

.profile-game-row,
.session-row-button,
.card-chip {
  border: 1px solid var(--border);
  border-radius: var(--campaign-card-radius);
  background: var(--control-bg);
  color: var(--text);
}

.profile-game-row:hover,
.session-row-button:hover,
.card-chip:hover {
  border-color: var(--border-hi);
  background: var(--card-bg-hover);
}

.profile-game-row:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-soft);
}

.session-row-button.is-selected,
.card-chip.is-selected {
  border-color: var(--border-hi);
  background: var(--feature-card-accent-bg);
  box-shadow: var(--bevel);
}

.session-feedback,
.profile-feedback,
.auth-feedback {
  border: 1px solid var(--warning-border);
  background: var(--warning-bg);
  color: var(--muted);
  line-height: 1.5;
}

.session-feedback.is-error,
.profile-feedback.is-error,
.auth-feedback.is-error {
  background: var(--danger-bg);
  border-color: var(--danger-border);
  color: var(--danger);
}

.auth-feedback.is-success {
  background: var(--success-bg);
  border-color: var(--success-border);
  color: var(--success);
}

.ld-locale-control {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ld-locale-label {
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-size: 0.58rem;
  color: var(--gold);
}

.ld-btn-primary,
.ld-btn-ghost,
.top-nav-login,
.top-nav-register,
.top-nav-logout,
.ghost-button,
button,
.lobby-create-button,
.primary-nav-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  padding: 0 20px;
  border-radius: var(--campaign-control-radius);
  font-family: inherit;
  font-variant: small-caps;
  letter-spacing: 0.07em;
  font-size: 0.88rem;
  font-weight: 700;
  text-decoration: none;
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease, border-color 120ms ease, color 120ms ease;
}

.ld-btn-primary,
button,
.lobby-create-button,
.primary-nav-action {
  border: 1px solid var(--button-primary-border);
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  text-shadow: 0 1px 3px var(--overlay);
  box-shadow: var(--button-primary-shadow);
}

.ld-btn-primary:hover,
button:hover,
.lobby-create-button:hover,
.primary-nav-action:hover {
  background: var(--button-primary-bg-hover);
  border-color: var(--button-primary-border-hover);
  color: var(--button-primary-text-hover);
  transform: translateY(-2px);
  box-shadow: var(--button-primary-shadow-hover);
}

:where(a, button, input, select, textarea, [role="button"]):focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

button:disabled,
.lobby-create-button:disabled,
.primary-nav-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

.ld-btn-ghost,
.top-nav-login,
.top-nav-register,
.top-nav-logout,
.ghost-button {
  border: 1px solid var(--border);
  background: var(--button-ghost-bg);
  color: var(--muted);
  box-shadow: var(--bevel), var(--shadow-soft);
}

.ld-btn-ghost:hover,
.top-nav-login:hover,
.top-nav-register:hover,
.top-nav-logout:hover,
.ghost-button:hover {
  background: var(--button-ghost-bg-hover);
  border-color: var(--border-hi);
  color: var(--text);
  transform: translateY(-1px);
  box-shadow: var(--bevel), var(--shadow);
}

.danger-button {
  background: var(--button-danger-bg);
  border-color: var(--button-danger-border);
  color: var(--button-danger-text);
}

.ld-btn-lg {
  min-height: 50px;
  padding: 0 32px;
  font-size: 1rem;
}

.ld-locale-select,
.top-nav-locale-select,
.top-nav-auth-form input {
  min-height: 38px;
  padding: 0 12px;
  border-radius: var(--campaign-control-radius);
  border: 1px solid var(--border);
  background: var(--field-bg);
  color: var(--field-text);
  font-family: inherit;
  letter-spacing: 0.07em;
  box-shadow: var(--bevel), var(--shadow-soft);
}

.ld-locale-select:focus-visible,
.top-nav-locale-select:focus-visible,
.top-nav-auth-form input:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.ld-feature-card,
.profile-command-card,
.lobby-command-card,
.new-game-brief-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  border-radius: var(--campaign-card-radius);
  border: 1px solid var(--border);
  background: var(--feature-card-bg);
  box-shadow: var(--bevel), var(--shadow);
  position: relative;
  overflow: hidden;
  transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
}

.ld-feature-card {
  padding: 32px 28px;
}

.ld-feature-card:hover,
.profile-command-card:hover,
.lobby-command-card:hover,
.new-game-brief-card:hover,
.profile-note-card:hover,
.session-list-panel:hover,
.session-detail-panel:hover {
  transform: translateY(-4px);
  box-shadow: var(--bevel), var(--shadow);
}

.ld-feature-card::before,
.profile-command-card::before,
.lobby-command-card::before,
.new-game-brief-card::before,
.profile-note-card::before,
.register-card::before,
.new-game-panel::before,
.session-list-panel::before,
.session-detail-panel::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at top right, var(--hero-overlay) 0%, transparent 55%);
  pointer-events: none;
}

.ld-feature-card-accent,
.profile-command-card-accent,
.lobby-command-card-accent,
.new-game-brief-card-accent,
.lobby-focus-card {
  border-color: var(--border-hi);
  background: var(--feature-card-accent-bg);
}

.profile-command-card-accent p,
.lobby-command-card-accent p,
.new-game-brief-card-accent p,
.lobby-focus-card p,
.profile-command-card-accent .profile-command-label,
.lobby-command-card-accent .lobby-command-label,
.new-game-brief-card-accent .lobby-command-label,
.lobby-focus-card .lobby-command-label {
  color: var(--text-muted);
}

.ld-feature-card p,
.profile-command-card p,
.lobby-command-card p,
.new-game-brief-card p,
.profile-note-card p {
  color: var(--muted);
}

.ld-feature-card p {
  font-size: 0.92rem;
  line-height: 1.65;
}

.ld-feature-card h3 {
  font-size: 1.2rem;
  font-variant: small-caps;
  letter-spacing: 0.07em;
  color: var(--parchment);
}

.ld-feature-card strong,
.profile-command-card strong,
.lobby-command-card strong,
.new-game-brief-card strong,
.profile-note-card h3 {
  color: var(--text-inverse);
}

.brand-link {
  color: inherit;
  text-decoration: none;
}

.brand-link:hover {
  color: inherit;
}

.top-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 10px;
  border-radius: var(--campaign-shell-radius);
  padding: 8px 18px;
  min-height: 60px;
}

.top-nav-bar .nav-link,
.shared-bottom-shell .nav-link {
  min-height: 36px;
  padding: 0 16px;
  border-radius: var(--campaign-control-radius);
  font-variant: small-caps;
  letter-spacing: 0.06em;
}

.top-nav-bar .nav-link {
  color: var(--muted);
  background: transparent;
}

.top-nav-bar .nav-link:hover {
  background: var(--nav-hover-bg);
  color: var(--text);
}

.top-nav-bar .nav-link.is-active {
  background: var(--nav-active-bg);
  color: var(--text);
}

.top-nav-login,
.top-nav-register,
.top-nav-logout {
  white-space: nowrap;
}

.nav-avatar {
  width: 32px;
  height: 32px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  letter-spacing: 0.04em;
  border: 1px solid var(--border);
  background: var(--avatar-bg);
  color: var(--text);
  box-shadow: var(--bevel), var(--shadow-soft);
}

.shared-bottom-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: center;
  padding: 14px 18px;
  border-radius: var(--campaign-shell-radius);
  border: 1px solid var(--border-hi);
  background: var(--footer-shell-bg);
  box-shadow: var(--shadow-soft);
}

.shared-footer-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-width: 0;
}

.shared-footer-title {
  margin: 0;
  font-size: 1.12rem;
  color: var(--text-inverse);
}

.shared-footer-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.86rem;
  text-align: right;
}

.shared-footer-links {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

@media (max-width: 920px) {
  .shared-bottom-shell {
    grid-template-columns: 1fr;
  }

  .shared-footer-copy {
    flex-direction: column;
    align-items: start;
  }

  .shared-footer-note {
    text-align: left;
  }

  .shared-footer-links {
    justify-content: flex-start;
  }
}

@media (max-width: 1100px) {
  .top-nav-bar {
    gap: 12px;
    padding-inline: 12px;
  }

  .top-nav-brand .eyebrow {
    display: none;
  }

  .top-nav-links {
    justify-content: flex-start;
  }
}

@media (max-width: 980px) {
  .campaign-hero,
  .campaign-status-line {
    padding: 16px 18px;
  }

  .session-detail-grid,
  .game-info-bottom .game-session-card,
  .map-command-summary,
  .profile-command-strip {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 760px) {
  .top-nav-bar {
    flex-wrap: wrap;
    align-items: stretch;
  }

  .top-nav-links,
  .top-nav-actions,
  .top-nav-auth-form {
    flex-wrap: wrap;
  }

  .top-nav-links,
  .top-nav-actions {
    width: 100%;
  }

  .top-nav-links {
    justify-content: stretch;
  }

  .top-nav-bar .nav-link {
    flex: 1 1 0;
    justify-content: center;
  }

  .top-nav-actions {
    justify-content: flex-end;
  }

  .top-nav-locale {
    flex: 1 1 120px;
  }

  .top-nav-locale-select {
    width: 100%;
  }

  .top-nav-auth-form {
    width: 100%;
    justify-content: flex-end;
  }

  .top-nav-auth-feedback {
    width: 100%;
    min-width: 0;
    order: 3;
  }

  .top-nav-auth-form input {
    flex: 1 1 140px;
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`,
  "style.css": String.raw`.board-shell {
  width: min(1500px, calc(100% - 24px));
  margin: 0 auto;
  padding: 8px 0 16px;
}

.command-bar {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 10px 16px;
  padding: 12px 16px;
  margin-bottom: 12px;
  align-items: center;
  background: var(--campaign-shell-bg);
  color: var(--heading);
}

.compact-brand {
  grid-row: span 2;
}

.brand-block h1,
.brand-block p,
.brand-block h2 {
  margin-top: 0;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.68rem;
  opacity: 0.76;
  margin-bottom: 6px;
}

h1 {
  font-size: clamp(1.55rem, 2vw, 2.35rem);
  line-height: 0.95;
  margin: 0;
}

.top-status-row,
.control-row,
.compact-form,
.compact-actions,
.action-row,
.action-stack {
  display: flex;
  gap: 10px;
}

.top-status-row,
.control-row,
.compact-form,
.compact-actions,
.action-stack {
  flex-wrap: wrap;
}

.top-status-row {
  align-items: stretch;
}

.top-status-row .mini-card {
  flex: 1;
  min-width: 220px;
}

.control-row {
  align-items: center;
  justify-content: space-between;
}

.header-form {
  flex: 1;
  align-items: center;
}

.header-form input {
  flex: 1 1 160px;
  min-width: 140px;
}

.header-actions {
  flex: 0 0 auto;
}

.mini-card {
  background: var(--badge-bg);
  border: 1px solid var(--border);
  border-radius: 16px;
  padding: 8px 12px;
}

.slim-card p {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mini-card p {
  margin: 4px 0 0;
  color: var(--text);
  font-size: 0.9rem;
}

.mini-label {
  display: inline-block;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.66rem;
  color: var(--text-muted);
}

.battlefield-layout {
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr) 320px;
  gap: 14px;
  min-height: calc(100vh - 138px);
}

.left-rail,
.right-rail,
.center-stage {
  padding: 16px;
}

.left-rail,
.right-rail {
  background: linear-gradient(180deg, var(--panel), var(--panel-strong));
}

.center-stage {
  background: linear-gradient(180deg, var(--panel), var(--bg-soft));
}

.panel-header,
.section-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tight-header {
  margin-bottom: 12px;
}

.map-stage-header {
  margin-bottom: 12px;
}

.map-stage-header h2,
.section-title-row h3,
.tight-header h2 {
  margin: 0;
}

.stage-copy {
  color: var(--muted);
  margin: 4px 0 0;
  font-size: 0.88rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  padding: 7px 12px;
  background: var(--badge-bg);
  color: var(--text);
  font-size: 0.8rem;
  white-space: nowrap;
}

.badge.accent {
  background: var(--warning-bg);
  color: var(--accent);
}

.command-summary {
  display: grid;
  gap: 8px;
  margin-bottom: 14px;
  color: var(--muted);
}

.turn-alert {
  display: grid;
  gap: 6px;
  margin: 0 0 16px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid transparent;
  box-shadow: var(--shadow-soft);
}

.turn-alert strong {
  font-size: 0.96rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.turn-alert span {
  font-size: 0.96rem;
  line-height: 1.45;
}

.turn-alert-danger {
  background: var(--button-danger-bg);
  border-color: var(--danger-border);
  color: var(--button-danger-text);
}

.rail-section + .rail-section {
  margin-top: 18px;
}

.rail-players {
  display: grid;
  gap: 10px;
}

.player-card,
.territory-card {
  border-radius: 16px;
  border: 1px solid var(--line);
  padding: 12px;
  background: var(--panel);
}

.player-card strong,
.territory-card strong {
  display: block;
  margin-bottom: 6px;
}

.player-card-token {
  width: 100%;
  height: 10px;
  margin-top: 8px;
  border-radius: 99px;
  background: var(--player-color);
}

.player-card.piece-skin-style-ring-core .player-card-token {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background:
    radial-gradient(circle at center, var(--panel) 0 28%, transparent 30%),
    radial-gradient(circle at center, var(--player-color) 0 62%, var(--text-inverse) 64% 72%, var(--player-color) 74% 100%);
  border: 1px solid var(--text-inverse);
  box-shadow:
    inset 0 0 0 1px var(--overlay),
    var(--shadow-soft);
}

.tactical-map {
  position: relative;
  display: grid;
  gap: 12px;
  height: 100%;
}

.map-viewport {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.map-board-surface {
  position: relative;
  --map-territory-node-scale: 1;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: 26px;
  touch-action: none;
  user-select: none;
}

.map-markers-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
}

.map-board-surface.is-zoomed {
  cursor: grab;
}

.map-board-surface.is-dragging {
  cursor: grabbing;
}

.map-board-anchor {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  will-change: transform;
}

.map-board-transform {
  transform-origin: center center;
  will-change: transform;
}

.map-board {
  --map-background-image: none;
  position: relative;
  aspect-ratio: 760 / 500;
  border-radius: 26px;
  background-image: var(--feature-card-accent-bg);
  background-position: center, center;
  background-size: cover, cover;
  overflow: hidden;
  border: 2px solid var(--border);
  box-shadow: inset 0 0 0 2px var(--border-hi);
}

.map-board-stage {
  position: absolute;
  inset: 0;
}

.map-board.has-custom-background::before,
.map-board.has-custom-background::after {
  display: none;
}

.map-board.has-custom-background {
  background-repeat: no-repeat, no-repeat;
}

.map-board.has-custom-background .map-board-stage {
  inset: 0;
  background-image: var(--map-background-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size: contain;
}

.map-board.map-id-world-classic.has-custom-background .map-board-stage {
  inset: 0;
  background-size: contain;
  background-position: center;
}

.map-board::before,
.map-board::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  background: var(--badge-bg);
}

.map-board::before {
  width: 260px;
  height: 260px;
  top: 22px;
  left: -40px;
}

.map-board::after {
  width: 320px;
  height: 320px;
  right: -100px;
  bottom: -90px;
}

.map-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: none;
}

.map-link {
  stroke: var(--line);
  stroke-width: 6;
  stroke-linecap: round;
}

.map-controls {
  position: absolute;
  top: 84px;
  right: 14px;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
  pointer-events: none;
}

.map-control-button {
  pointer-events: auto;
  min-width: 42px;
  min-height: 42px;
  border: 1px solid var(--border-hi);
  border-radius: 999px;
  background: color-mix(in srgb, var(--panel) 88%, transparent);
  color: var(--heading);
  box-shadow: var(--shadow-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  font: inherit;
  font-weight: 700;
  backdrop-filter: blur(12px);
}

.map-control-button:disabled {
  opacity: 0.56;
  cursor: not-allowed;
}

.territory-node {
  --territory-node-size: calc(clamp(34px, 4.5vw, 42px) * var(--map-territory-node-scale, 1));
  position: absolute;
  width: var(--territory-node-size);
  height: var(--territory-node-size);
  min-width: var(--territory-node-size);
  min-height: var(--territory-node-size);
  margin: 0;
  transform: translate(-50%, -50%);
  transform-origin: center center;
  padding: 0;
  aspect-ratio: 1 / 1;
  border-radius: 999px;
  background: var(--owner-color, var(--owner-color-default));
  color: var(--owner-text-color, var(--owner-text-default));
  border: 2px solid var(--text-inverse);
  box-shadow:
    0 0 0 1px var(--overlay),
    var(--shadow-soft);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  backface-visibility: hidden;
  will-change: left, top;
}

.territory-node:hover {
  transform:
    translate(-50%, -50%)
    translateY(calc(-2px * var(--map-territory-node-scale, 1)))
    scale(1.05);
}

.territory-node.piece-skin-style-ring-core {
  color: var(--text-inverse);
  border-color: var(--text-inverse);
  background:
    radial-gradient(circle at center, var(--panel-strong, var(--panel)) 0 28%, transparent 30%),
    radial-gradient(circle at center, var(--owner-color, var(--owner-color-default)) 0 62%, var(--text-inverse) 64% 72%, var(--owner-color, var(--owner-color-default)) 74% 100%);
}

.territory-node.piece-skin-style-ring-core .territory-armies {
  font-size: clamp(0.7rem, calc(0.8rem * var(--map-territory-node-scale, 1)), 0.8rem);
  letter-spacing: 0.02em;
}

.territory-node.is-source,
.territory-node.is-reinforce {
  outline: 3px solid var(--text-inverse);
  box-shadow:
    0 0 0 5px var(--success),
    var(--shadow-soft);
}

.territory-node.is-target {
  outline: 3px solid var(--text-inverse);
  box-shadow:
    0 0 0 5px var(--danger),
    var(--shadow-soft);
}

.territory-armies {
  display: inline-block;
  font-weight: 700;
  font-size: clamp(0.78rem, calc(0.92rem * var(--map-territory-node-scale, 1)), 0.92rem);
  line-height: 1;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 1px 1px var(--overlay);
}

.map-legend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  max-height: 180px;
  overflow: auto;
  padding-right: 4px;
}

.map-legend .territory-card {
  padding: 10px;
  font-size: 0.84rem;
}

.actions-section .action-group + .action-group {
  margin-top: 14px;
}

.combat-result-section {
  display: grid;
  gap: 10px;
  min-width: 0;
}

.combat-result-section .section-title-row {
  flex-wrap: wrap;
  align-items: flex-start;
}

.combat-result-section .badge {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.combat-result-summary {
  min-width: 0;
  color: var(--muted);
  font-size: 0.88rem;
  overflow-wrap: anywhere;
}

.combat-result-grid {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.combat-result-line {
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  min-width: 0;
  width: 100%;
  padding: 8px 0;
  border-top: 1px solid var(--line);
  box-sizing: border-box;
}

.combat-result-line span {
  min-width: 0;
  color: var(--muted);
}

.combat-result-line strong {
  min-width: 0;
  max-width: 100%;
  text-align: right;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.compact-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 700;
}

.reinforce-actions-row {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 8px;
}

.reinforce-actions-row input {
  min-width: 0;
  text-align: center;
}

.reinforce-actions-row button {
  background: var(--button-primary-bg);
}

.card-trade-list {
  display: grid;
  gap: 8px;
}

.card-chip {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--control-bg);
  color: var(--text);
  padding: 10px 12px;
  text-align: left;
}

.card-chip.is-selected {
  border-color: var(--border-hi);
  background: var(--feature-card-accent-bg);
}

.action-help {
  margin: 8px 0 10px;
  color: var(--muted);
  font-size: 0.92rem;
}

.trade-emphasis {
  margin: 0 0 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid var(--warning-border);
  background: var(--warning-bg);
  color: var(--accent);
  font-weight: 700;
  line-height: 1.45;
  box-shadow: var(--bevel);
}

.action-success {
  margin: -2px 0 10px;
  color: var(--success);
  font-size: 0.9rem;
}

.action-error {
  margin: -2px 0 10px;
  color: var(--danger);
  font-size: 0.9rem;
}

.card-trade-empty {
  margin: 0;
  color: var(--muted);
}

input,
select {
  font: inherit;
}

input,
select {
  width: 100%;
}

.full-width {
  width: 100%;
}

.rail-log {
  max-height: 360px;
  overflow: auto;
}

.log-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 8px;
}

.log-list li {
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--panel);
  border: 1px solid var(--line);
  font-size: 0.9rem;
}

@media (max-width: 1280px) {
  .command-bar {
    grid-template-columns: 1fr;
  }

  .compact-brand {
    grid-row: auto;
  }

  .battlefield-layout {
    grid-template-columns: 270px minmax(0, 1fr) 290px;
  }
}

@media (max-width: 980px) {
  .battlefield-layout {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .map-board {
    aspect-ratio: 760 / 500;
  }

  .map-legend {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-height: none;
  }

  .top-status-row,
  .control-row,
  .compact-form,
  .compact-actions,
  .action-stack {
    flex-direction: column;
    align-items: stretch;
  }

  .reinforce-actions-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .board-shell {
    width: min(100%, calc(100% - 12px));
  }

  .left-rail,
  .right-rail,
  .center-stage,
  .command-bar {
    padding: 14px;
  }

  .map-board {
    aspect-ratio: 760 / 500;
  }

  .territory-node {
    width: clamp(30px, 8vw, 36px);
    height: clamp(30px, 8vw, 36px);
  }

  .map-legend {
    grid-template-columns: 1fr;
  }
}


#conquest-group[hidden] {
  display: none;
}

#fortify-group[hidden] {
  display: none;
}


.session-browser {
  margin-bottom: 12px;
  padding: 16px;
  background: linear-gradient(180deg, var(--panel), var(--panel-strong));
}

.session-browser-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 14px;
}

.session-browser-heading {
  display: grid;
  gap: 6px;
  max-width: 780px;
}

.session-eyebrow {
  color: var(--muted);
  margin-bottom: 8px;
}

.session-browser-head h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
}

.lobby-head-actions {
  align-items: center;
  justify-content: flex-end;
}

.lobby-focus-band {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) auto;
  gap: 12px;
  align-items: stretch;
  margin: 0 0 16px;
}

.lobby-focus-card {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid var(--border);
  background: var(--focus-card-bg);
  color: var(--heading);
  box-shadow: var(--shadow-soft);
}

.lobby-focus-card .lobby-command-label,
.lobby-focus-card p {
  color: var(--text-muted);
}

.lobby-focus-card strong {
  font-size: clamp(1.25rem, 2.6vw, 2.15rem);
  line-height: 1;
}

.lobby-focus-card p {
  margin: 0;
  max-width: 38rem;
}

.lobby-focus-actions {
  display: flex;
  align-items: stretch;
  justify-content: flex-end;
}

.lobby-focus-actions .ghost-button,
.lobby-focus-actions .lobby-create-button {
  min-height: 100%;
}

.lobby-create-button {
  min-height: 40px;
  padding: 0 16px;
  letter-spacing: 0.02em;
}

.lobby-create-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.lobby-command-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 0 0 16px;
}

.lobby-command-card {
  display: grid;
  gap: 6px;
  min-height: 132px;
  padding: 16px 18px;
}

.lobby-command-card strong {
  font-size: clamp(1.2rem, 2.8vw, 2rem);
  line-height: 1;
}

.lobby-command-card p {
  margin: 0;
  line-height: 1.45;
  font-size: 0.88rem;
}

.lobby-command-label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
}

.session-browser-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.session-browser-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.85fr);
  gap: 14px;
}

.session-list-panel,
.session-detail-panel {
  padding: 14px;
}

.session-list-title-row {
  margin-bottom: 12px;
}

.session-list-header,
.session-row {
  display: grid;
  grid-template-columns: minmax(180px, 2fr) minmax(140px, 1.15fr) minmax(90px, 0.9fr) minmax(90px, 0.8fr) minmax(120px, 1fr);
  gap: 12px;
  align-items: center;
}

.session-row-head {
  padding: 0 12px 10px;
  color: var(--muted);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.session-list {
  display: grid;
  gap: 8px;
}

.session-list-load-more {
  padding: 14px 12px 4px;
  color: var(--muted);
  font-size: 0.84rem;
  text-align: center;
}

.session-list-load-more.is-hidden {
  display: none;
}

.session-row-button {
  width: 100%;
  text-align: left;
  padding: 12px;
}

.session-primary {
  display: grid;
  gap: 4px;
}

.session-name {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.session-sub {
  color: var(--muted);
  font-size: 0.84rem;
}

.session-cell-muted {
  color: var(--muted);
  font-size: 0.88rem;
}

.session-feedback {
  padding: 18px 12px;
}

.session-feedback.is-hidden {
  display: none;
}

.session-detail-hero {
  padding: 14px 16px;
}

.session-detail-kicker {
  margin: 0 0 6px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.72rem;
  color: var(--muted);
}

.session-detail-title {
  margin: 0;
  font-size: 1.2rem;
}

.session-detail-copy {
  margin: 8px 0 0;
  color: var(--muted);
  line-height: 1.45;
}

.session-detail-note {
  padding: 12px 14px;
  line-height: 1.45;
}

.session-details-card {
  display: grid;
  gap: 12px;
  margin-top: 12px;
}

.session-detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.session-detail-item {
  padding: 10px 12px;
}

.session-detail-item span {
  display: block;
  color: var(--muted);
  font-size: 0.76rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}

.session-empty-copy {
  color: var(--muted);
  line-height: 1.5;
}

.session-detail-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.legacy-game-select {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1100px) {
  .lobby-focus-band,
  .lobby-command-strip {
    grid-template-columns: 1fr;
  }

  .session-browser-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 860px) {
  .session-browser-head {
    flex-direction: column;
  }

  .lobby-head-actions {
    width: 100%;
    justify-content: stretch;
  }

  .lobby-focus-actions > *,
  .lobby-head-actions > * {
    flex: 1 1 0;
    justify-content: center;
  }

  .session-list-panel,
  .session-detail-panel {
    padding: 12px;
  }

  .session-list-header,
  .session-row {
    grid-template-columns: minmax(0, 1.4fr) minmax(110px, 1fr) minmax(80px, 0.8fr);
  }

  .session-row > :nth-child(4),
  .session-row > :nth-child(5),
  .session-row-head > :nth-child(4),
  .session-row-head > :nth-child(5) {
    display: none;
  }
}

@media (max-width: 640px) {
  .session-browser {
    padding: 12px;
  }

  .lobby-meta-line {
    gap: 6px;
  }

  .lobby-command-card {
    min-height: 0;
    padding: 14px 15px;
  }

  .session-list-header {
    display: none;
  }

  .session-row-button {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 12px;
    padding: 14px;
  }

  .session-row-button > :nth-child(4),
  .session-row-button > :nth-child(5) {
    display: grid;
  }

  .session-primary {
    grid-column: 1 / -1;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--line);
  }

  .session-row-button > [data-cell-label] {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .session-row-button > [data-cell-label]::before {
    content: attr(data-cell-label);
    font-size: 0.68rem;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--muted);
  }

  .session-row-button > .badge[data-cell-label] {
    align-items: flex-start;
    justify-content: flex-start;
    white-space: normal;
  }

  .session-row-button > .badge[data-cell-label]::before {
    margin-bottom: 4px;
  }

  .session-detail-grid {
    grid-template-columns: 1fr;
  }

  .session-detail-actions > * {
    flex: 1 1 0;
    justify-content: center;
  }
}


.profile-bar {
  margin-bottom: 12px;
}

.profile-shell {
  padding: 18px;
  background: linear-gradient(180deg, var(--panel), var(--panel-strong));
}

.profile-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.profile-hero-copy {
  display: grid;
  gap: 6px;
  max-width: 760px;
}

.profile-hero h2 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.35rem);
}

.profile-hero-actions {
  align-items: center;
  justify-content: flex-end;
}

.profile-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--button-ghost-bg);
  color: var(--text);
  text-decoration: none;
  font-weight: 600;
  box-shadow: var(--bevel);
}

.profile-back-button:hover {
  transform: translateY(-1px);
  background: var(--button-ghost-bg-hover);
  color: var(--text);
}

.profile-back-button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.profile-feedback {
  padding: 18px 16px;
  border-radius: 16px;
  background: var(--warning-bg);
  color: var(--muted);
}

.profile-feedback.is-error {
  background: var(--danger-bg);
  color: var(--danger);
}

.profile-content {
  display: grid;
  gap: 16px;
}

.profile-command-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.profile-command-card {
  display: grid;
  gap: 6px;
  min-height: 132px;
  padding: 16px 18px;
}

.profile-command-card strong {
  font-size: clamp(1.15rem, 2.8vw, 1.8rem);
  line-height: 1.1;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.profile-command-card p {
  margin: 0;
  line-height: 1.45;
  font-size: 0.88rem;
}

.profile-command-label {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.72rem;
}

.profile-summary-card,
.profile-note-card {
  padding: 16px;
}

.profile-preferences {
  display: grid;
  gap: 14px;
}

.profile-preferences-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.profile-theme-row {
  display: flex;
  align-items: end;
  gap: 14px;
  flex-wrap: wrap;
}

.profile-theme-field {
  display: grid;
  gap: 8px;
  min-width: min(280px, 100%);
}

.profile-theme-label {
  color: var(--muted);
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.profile-theme-select {
  min-width: 220px;
}

.profile-theme-status {
  margin: 0;
  color: var(--muted);
}

.profile-section-eyebrow {
  color: var(--muted);
  margin-bottom: 8px;
}

.profile-summary-card h3,
.profile-note-card h3 {
  margin: 0 0 8px;
}

.profile-metrics-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.profile-metric-card {
  padding: 16px;
  display: grid;
  gap: 8px;
}

.profile-metric-label {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
}

.profile-metric-value {
  font-size: clamp(1.6rem, 2.2vw, 2.35rem);
}

.profile-metric-card.wide-card {
  grid-column: span 1;
}

.profile-future-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.profile-intel-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}

.profile-games-card {
  grid-column: span 2;
  display: grid;
  gap: 12px;
}

.profile-games-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.profile-games-head h3 {
  margin: 0;
}

.profile-games-empty {
  color: var(--muted);
  padding: 14px 0 2px;
}

.profile-games-list {
  display: grid;
  gap: 10px;
}

.profile-game-row {
  width: 100%;
  padding: 14px 16px;
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  text-align: left;
  cursor: pointer;
}

.profile-game-primary {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.profile-game-kicker {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
}

.profile-game-name {
  font-weight: 700;
  font-size: 1.02rem;
  color: var(--text);
}

.profile-game-meta-row {
  min-width: 0;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 8px 10px;
  align-items: center;
}

.profile-game-sub,
.profile-game-meta {
  color: var(--muted);
  font-size: 0.82rem;
}

.profile-mini-lobby {
  grid-column: 1 / -1;
  display: grid;
  gap: 8px;
  border-top: 1px solid var(--line);
  padding-top: 10px;
}

.profile-mini-lobby-title {
  color: var(--text);
  font-size: 0.82rem;
  font-weight: 700;
}

.profile-mini-lobby-grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
}

.profile-mini-lobby-item {
  display: grid;
  gap: 4px;
  padding: 10px;
  border-radius: 12px;
  background: var(--badge-bg);
}

.profile-mini-lobby-item span {
  color: var(--muted);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.profile-mini-lobby-item strong {
  color: var(--text);
  font-size: 0.9rem;
}

@media (max-width: 1100px) {
  .profile-hero,
  .profile-command-strip {
    grid-template-columns: 1fr;
  }

  .profile-hero {
    display: grid;
  }

  .profile-metrics-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .profile-intel-grid {
    grid-template-columns: 1fr;
  }

  .profile-games-card {
    grid-column: span 1;
  }

  .profile-game-row {
    grid-template-columns: 1fr;
  }

  .profile-mini-lobby-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .profile-shell {
    padding: 12px;
  }

  .profile-hero-actions {
    width: 100%;
    justify-content: stretch;
  }

  .profile-hero-actions > * {
    flex: 1 1 0;
    justify-content: center;
  }

  .profile-metrics-grid,
  .profile-future-grid,
  .profile-intel-grid {
    grid-template-columns: 1fr;
  }

  .profile-games-head {
    flex-direction: column;
    align-items: start;
  }

  .profile-theme-row {
    align-items: stretch;
  }

  .profile-theme-field,
  .profile-theme-select {
    width: 100%;
    min-width: 0;
  }

  .profile-game-row {
    grid-template-columns: 1fr;
  }

  .profile-game-meta-row {
    flex-direction: column;
    align-items: stretch;
  }

  .profile-mini-lobby-grid {
    grid-template-columns: 1fr 1fr;
  }
}


.app-frame {
  width: min(1680px, calc(100% - 24px));
  margin: 0 auto;
  padding: 8px 0 16px;
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.page-shell {
  min-width: 0;
}

.main-nav-shell {
  position: sticky;
  top: 8px;
  padding: 20px 18px;
  background: var(--campaign-shell-bg);
  color: var(--heading);
}

.nav-brand-block {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.nav-brand-title {
  font-size: 1.85rem;
  line-height: 0.96;
  margin: 0;
}

.nav-brand-copy {
  margin: 10px 0 0;
  color: var(--text-muted);
  font-size: 0.9rem;
  line-height: 1.45;
}

.main-nav {
  display: grid;
  gap: 10px;
}

.nav-link {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--border);
  color: var(--text);
  text-decoration: none;
  background: var(--badge-bg);
  transition: background 120ms ease, transform 120ms ease, border-color 120ms ease;
}

.nav-link:hover {
  background: var(--nav-hover-bg);
  transform: translateX(2px);
}

.nav-link.is-active {
  background: var(--nav-active-bg);
  border-color: var(--border-hi);
  color: var(--heading);
}

.page-header-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 20px;
  margin-bottom: 12px;
  background: var(--hero-panel-bg);
}

.page-title {
  margin: 0;
}

.page-header-actions {
  align-items: center;
  justify-content: flex-end;
}

.page-header-actions input {
  min-width: 220px;
}

@media (max-width: 1180px) {
  .app-frame {
    grid-template-columns: 1fr;
  }

  .main-nav-shell {
    position: static;
  }

  .main-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}


body[data-app-section="game"] .game-app-frame {
  width: min(1760px, calc(100% - 14px));
  grid-template-columns: 1fr;
  gap: 8px;
}

body[data-app-section="game"] .game-page-shell {
  width: 100%;
}

body[data-app-section="game"] .board-shell {
  width: 100%;
  max-width: none;
  padding-top: 2px;
  padding-bottom: 8px;
}

.game-ops-bar,
.shared-top-shell {
  grid-template-columns: 1fr;
  gap: 0;
  padding: 0 14px;
  margin-bottom: 8px;
  border-radius: 16px;
  background: var(--status-surface);
  border-color: var(--border);
  box-shadow: var(--shadow-soft);
}

.game-status-line,
.shared-status-line {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 4px 0;
}

.game-status-items,
.shared-status-line {
  min-width: 0;
  flex-wrap: wrap;
}

.game-status-items {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1 1 auto;
}

.status-chip {
  min-width: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 7px;
  color: var(--text);
  font-size: 0.82rem;
  white-space: nowrap;
}

.status-chip-label {
  display: none;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.58rem;
}

.status-chip > :last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
}

.status-divider {
  width: 1px;
  height: 12px;
  background: var(--line);
  flex: 0 0 auto;
}

.game-context-row,
.shared-context-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 0 12px;
  border-top: 1px solid var(--line);
}

.game-context-copy {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.game-context-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.game-auth-form {
  flex: 0 1 auto;
  gap: 8px;
}

.game-auth-form input,
.game-auth-form button,
.game-turn-actions button,
.shared-status-line .ghost-button {
  min-height: 34px;
  padding-top: 6px;
  padding-bottom: 6px;
}

.game-auth-form input {
  flex: 1 1 130px;
}

.game-turn-actions {
  flex: 0 0 auto;
  gap: 8px;
}

.shared-status-line .ghost-button {
  margin-left: auto;
}

.game-battlefield-layout {
  grid-template-columns: minmax(0, 1fr) 260px;
  gap: 12px;
  align-items: start;
  min-height: auto;
  height: auto;
}

.game-main-column {
  display: grid;
  gap: 12px;
  min-width: 0;
  height: auto;
  grid-template-rows: minmax(0, 1fr) auto;
}

.game-info-rail,
.game-actions-rail,
.game-map-stage {
  padding: 12px;
}

.game-actions-rail {
  display: flex;
  flex-direction: column;
}

.game-lobby-controls {
  display: grid;
  gap: 12px;
}

.auth-field {
  gap: 6px;
}

.game-phase-banner,
.game-reinforcement-banner {
  display: flex;
  justify-content: flex-end;
  padding-top: 6px;
  padding-bottom: 6px;
  color: var(--text-muted);
  font-size: 0.95rem;
  font-weight: 700;
}

.game-info-rail {
  gap: 10px;
}

.game-info-bottom {
  min-width: 0;
}

.game-info-bottom .panel-header {
  margin-bottom: 8px;
}

.game-info-bottom .game-compact-heading {
  justify-content: space-between;
  align-items: center;
}

.game-info-bottom .game-compact-heading .eyebrow {
  margin-bottom: 2px;
}

.game-info-bottom .game-compact-heading h2 {
  font-size: 1.55rem;
}

.game-status-bottom-strip {
  margin-bottom: 0;
  padding: 10px 14px;
}

.game-compact-heading {
  align-items: flex-start;
}

.game-compact-heading .eyebrow {
  margin-bottom: 4px;
}

.game-compact-heading h2 {
  line-height: 1;
}

.game-session-card {
  padding: 12px;
}

.game-info-bottom .game-session-card {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px 16px;
  padding: 10px 14px;
}

.game-roster-section {
  padding: 12px;
}

.surrender-section {
  margin-top: auto;
}

.game-map-stage {
  min-width: 0;
  min-height: 0;
  display: flex;
  align-items: flex-start;
  justify-content: stretch;
}

.map-stage-command-strip {
  display: grid;
  gap: 10px;
  margin-bottom: 12px;
  padding: 12px 14px;
}

.map-command-summary {
  margin-bottom: 0;
  grid-template-columns: repeat(2, minmax(0, max-content));
  align-items: center;
  column-gap: 18px;
}

.map-command-summary .status-line:last-child {
  margin-bottom: 0;
}

.game-info-bottom .command-summary > div {
  white-space: nowrap;
  font-size: 0.9rem;
}

.game-info-bottom .game-meta-line {
  display: grid;
  gap: 2px;
  align-items: start;
}

.game-info-bottom .game-meta-line span:first-child {
  font-size: 0.74rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.game-info-bottom .game-meta-line strong,
.game-info-bottom .game-meta-line span:last-child {
  font-size: 0.96rem;
}

.map-trade-alert {
  margin-bottom: 0;
}

.game-map-stage .map {
  display: flex;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
  height: auto;
  width: 100%;
  overflow: hidden;
}

.game-map-stage .map-viewport,
.game-map-stage .map-board-surface {
  height: 100%;
}

.game-map-stage .map-board {
  aspect-ratio: auto;
  width: auto;
  height: auto;
  max-height: none;
  margin: 0;
}

.game-map-stage .map-board-stage {
  inset: 0;
  background-size: contain;
  background-position: center;
}

.game-map-stage .map-legend {
  display: none;
}

body[data-app-section="game"] .main-nav-shell {
  display: none;
}

@media (max-width: 1240px) {
  .game-status-line,
  .shared-status-line,
  .game-context-row,
  .shared-context-row {
    flex-direction: column;
    align-items: stretch;
  }

  .game-status-items,
  .game-context-actions {
    width: 100%;
  }

  .game-status-items,
  .shared-status-line {
    flex-wrap: wrap;
  }

  .status-chip-label {
    display: inline;
  }

  .game-context-actions {
    justify-content: flex-start;
  }

  .shared-status-line .ghost-button {
    margin-left: 0;
  }

  .game-battlefield-layout {
    grid-template-columns: minmax(0, 1fr) 236px;
  }

  .game-info-bottom .game-session-card {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .map-command-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .game-info-bottom {
  }

}

@media (max-width: 980px) {
  .game-battlefield-layout {
    grid-template-columns: 1fr;
    min-height: auto;
    height: auto;
  }

  .game-actions-rail {
    max-height: none;
    overflow: visible;
  }

  .game-map-stage .map {
    height: auto;
    min-height: 420px;
  }

  .game-info-bottom {
  }

  .game-info-bottom .game-compact-heading {
    align-items: flex-start;
  }

  .game-info-bottom .game-session-card,
  .map-command-summary {
    grid-template-columns: 1fr;
  }

}

@media (max-width: 760px) {
  .game-map-stage,
  .game-info-rail,
  .game-actions-rail {
    padding: 10px;
  }

  .game-map-stage .map {
    min-height: 340px;
  }
}


.game-auth-form.is-authenticated {
  justify-content: flex-end;
}

.game-auth-form.is-authenticated .ghost-button {
  margin-left: auto;
}


.top-nav-page-frame {
  width: min(1720px, calc(100% - 18px));
  grid-template-columns: 1fr;
  gap: 10px;
}

.top-nav-page-shell {
  width: 100%;
}

.shared-top-shell {
  margin-bottom: 12px;
}

.shared-topline {
  grid-template-columns: auto minmax(0, 1fr) minmax(220px, auto);
}

.shared-page-intro,
.shared-context-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

body[data-app-section="lobby"] .main-nav-shell,
body[data-app-section="profile"] .main-nav-shell {
  display: none;
}

@media (max-width: 1180px) {
  .shared-topline,
  .shared-page-intro {
    grid-template-columns: 1fr;
    flex-direction: column;
    align-items: stretch;
  }
}



.shared-top-shell .page-title {
  font-size: 1.05rem;
  line-height: 1.05;
}

.shared-top-shell .stage-copy {
  font-size: 0.82rem;
  color: var(--text-muted);
}

.shared-context-row {
  gap: 14px;
  padding: 8px 0 10px;
}

.shared-context-row .page-header-actions input,
.shared-context-row .page-header-actions button,
.shared-status-line .ghost-button {
  min-height: 34px;
}

.shared-status-line {
  padding-bottom: 2px;
}


.game-ops-bar,
.shared-top-shell {
  display: none;
}

.game-meta-stack {
  gap: 8px;
  color: var(--muted);
}

.game-meta-line,
.content-meta-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  font-size: 0.84rem;
}

.game-meta-line span:first-child,
.content-meta-line > span:first-child {
  color: var(--muted);
}

.game-meta-line strong,
.content-meta-line strong,
.content-meta-line span:last-child,
.game-meta-line span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text);
}

.game-side-ops {
  display: grid;
  gap: 10px;
}

.auth-stack {
  display: grid;
  gap: 8px;
}

.rail-auth-form {
  display: grid;
  gap: 8px;
}

.auth-form-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.8rem;
  line-height: 1.4;
}

.auth-feedback {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--success-bg);
  color: var(--success);
  font-size: 0.82rem;
}

.auth-feedback.is-error {
  background: var(--danger-bg);
  color: var(--danger);
}

.auth-feedback.is-success {
  background: var(--success-bg);
  color: var(--success);
}

.register-shell {
  display: grid;
  gap: 1rem;
  padding: 1.1rem;
}

.register-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.register-meta-line {
  margin: 0;
}

.register-card {
  display: grid;
  gap: 0.9rem;
  max-width: 34rem;
  padding: 1.1rem;
  border-radius: 1rem;
  background: var(--panel);
}

.register-guidelines {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  color: var(--muted);
  font-size: 0.85rem;
}

.register-guidelines p {
  margin: 0;
}

.rail-action-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.lobby-meta-line,
.profile-meta-line {
  margin: 6px 0 14px;
  color: var(--muted);
}

.profile-meta-line {
  margin-top: 12px;
}

@media (max-width: 980px) {
  .game-meta-line,
  .content-meta-line,
  .rail-action-group {
    flex-direction: column;
    align-items: stretch;
  }
}


.new-game-shell {
  display: grid;
  gap: 1.25rem;
}

.new-game-brief {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(18rem, 0.9fr);
  gap: 1rem;
}

.new-game-brief-card {
  display: grid;
  gap: 0.55rem;
  padding: 1rem 1.05rem;
}

.new-game-brief-card strong {
  font-size: 1.08rem;
  line-height: 1.1;
}

.new-game-brief-card p {
  margin: 0;
  line-height: 1.5;
}

.new-game-sequence {
  margin: 0;
  padding-left: 1rem;
  color: var(--text);
  display: grid;
  gap: 0.4rem;
}

.new-game-grid {
  display: grid;
  grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}

.new-game-panel {
  display: grid;
  gap: 0.9rem;
  align-content: start;
  padding: 1.1rem;
}

.setup-ruleset-card {
  display: grid;
  gap: 0.7rem;
  padding: 0.95rem 1rem;
}

.map-setup-card {
  display: grid;
  gap: 0.7rem;
  padding: 0.95rem 1rem;
}

.map-setup-card:empty {
  display: none;
}

.map-setup-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.map-setup-copy {
  margin: 0;
  color: var(--muted);
  font-size: 0.86rem;
}

.map-setup-bonus-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.45rem;
}

.map-setup-bonus-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border-radius: 0.75rem;
  background: var(--badge-bg);
  color: var(--text);
  font-size: 0.88rem;
}

.map-setup-bonus-list strong {
  color: var(--accent);
  font-size: 0.82rem;
  white-space: nowrap;
}

.field-stack {
  display: grid;
  gap: 0.35rem;
}

.field-stack span {
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
}

.setup-options-stack {
  display: grid;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
}

.setup-options-toggle {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  color: var(--text);
  font-weight: 600;
}

.setup-options-toggle input {
  width: 1rem;
  height: 1rem;
}

.setup-advanced-options {
  display: grid;
  gap: 0.75rem;
  padding-top: 0.1rem;
}

.setup-player-slots {
  display: grid;
  gap: 1rem;
  align-content: start;
}

.setup-slot {
  display: grid;
  gap: 0.8rem;
  padding: 1rem;
}

.setup-slot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.setup-slot-head strong {
  color: var(--heading);
  font-variant: small-caps;
  letter-spacing: 0.05em;
}

.new-game-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  align-items: center;
  padding-top: 0.15rem;
}

.new-game-meta-line {
  justify-content: flex-end;
}

@media (max-width: 980px) {
  .new-game-brief,
  .new-game-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .new-game-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}


.setup-slot-note {
  margin: 0;
  color: var(--muted);
  font-size: 0.92rem;
  line-height: 1.4;
}


.setup-slot.is-fixed {
  background: var(--feature-card-accent-bg);
}

.setup-fixed-value {
  min-height: 2.75rem;
  display: flex;
  align-items: center;
  padding: 0.7rem 0.9rem;
  border-radius: 0.8rem;
  border: 1px solid var(--border);
  background: var(--control-bg);
  color: var(--heading);
  font-weight: 600;
}




.action-meta-list {
  display: grid;
  gap: 2px;
}

.action-meta-list .action-help {
  margin: 0;
}

.game-battlefield-layout {
  gap: 16px;
}

.game-map-stage,
.campaign-map-shell {
  border-radius: var(--campaign-shell-radius);
  background: var(--campaign-shell-bg);
}

.game-map-stage .map-board {
  border-radius: var(--campaign-shell-radius);
  outline: 1px solid var(--border-hi);
  outline-offset: -1px;
  box-shadow:
    0 0 0 1px var(--overlay),
    var(--shadow),
    var(--bevel);
}

.game-map-stage .map-board::after {
  background:
    radial-gradient(ellipse at center, transparent 35%, var(--overlay) 100%),
    linear-gradient(180deg, var(--overlay) 0%, transparent 20%, transparent 76%, var(--overlay) 100%);
}

.game-phase-banner,
.game-reinforcement-banner,
.status-chip,
.game-context-copy {
  color: var(--text-muted);
}

.status-divider {
  background: var(--line);
}

.territory-node {
  border: 2px solid var(--text-inverse);
  box-shadow:
    0 0 0 1px var(--overlay),
    var(--shadow-soft);
}

.game-bottom-shell {
  margin-top: 4px;
}
`
} as const;
