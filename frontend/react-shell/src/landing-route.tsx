import { useEffect } from "react";
import { Link } from "react-router-dom";

import { staticCssAssets } from "@frontend-generated/static-text-assets.mts";

import { buildLobbyPath, buildRegisterPath } from "@react-shell/public-auth-paths";

const LANDING_STYLE_ATTRIBUTE = "data-react-shell-landing-css";
const landingStylesheet = staticCssAssets["landing.css"];

export function LandingRoute() {
  useEffect(() => {
    const previousTitle = document.title;
    const previousShellKind = document.body.getAttribute("data-shell-kind");
    let injectedLandingStylesheet = false;
    let styleElement = document.head.querySelector<HTMLStyleElement>(
      `style[${LANDING_STYLE_ATTRIBUTE}]`
    );

    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.setAttribute(LANDING_STYLE_ATTRIBUTE, "true");
      styleElement.textContent = landingStylesheet;
      document.head.append(styleElement);
      injectedLandingStylesheet = true;
    }

    document.title = "Frontline Dominion - Conquista il Mondo";
    document.body.setAttribute("data-shell-kind", "marketing");

    return () => {
      document.title = previousTitle;
      if (previousShellKind) {
        document.body.setAttribute("data-shell-kind", previousShellKind);
        return;
      }

      document.body.removeAttribute("data-shell-kind");

      if (injectedLandingStylesheet) {
        styleElement?.remove();
      }
    };
  }, []);

  return (
    <>
      <header className="ld-header" id="top">
        <div className="ld-container ld-header-inner">
          <Link className="ld-brand" to="/">
            <span className="ld-brand-eyebrow">NetRisk</span>
            <span className="ld-brand-name">Frontline Dominion</span>
          </Link>

          <nav className="ld-nav-links" aria-label="Navigazione principale">
            <a href="#features">Caratteristiche</a>
            <a href="#maps">Mappe</a>
            <a href="#howtoplay">Come si gioca</a>
          </nav>

          <div className="ld-nav-actions">
            <Link className="ld-btn-ghost" to={buildLobbyPath("canonical")}>
              Accedi
            </Link>
            <Link className="ld-btn-primary" to={buildRegisterPath("canonical")}>
              Registrati
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        <section className="ld-hero">
          <div className="ld-hero-bg" />
          <div className="ld-hero-overlay" />
          <div className="ld-container ld-hero-content">
            <p className="ld-hero-eyebrow">
              <span className="ld-eyebrow-line" aria-hidden="true" />
              <span>Il Gioco di Strategia a Turni</span>
              <span className="ld-eyebrow-line" aria-hidden="true" />
            </p>
            <h1 className="ld-hero-title">
              <span>Conquista il Mondo.</span>
              <br />
              <em>Comanda le Armate.</em>
            </h1>
            <p className="ld-hero-desc">
              Pianifica come un generale. Attacca nei momenti decisivi. Difendi quello che hai
              conquistato. Frontline Dominion porta la campagna strategica di NetRisk in una shell
              React unica, senza spostare le regole fuori dal backend.
            </p>
            <div className="ld-hero-cta">
              <Link className="ld-btn-primary ld-btn-lg" to={buildRegisterPath("canonical")}>
                Inizia Gratis
              </Link>
              <a className="ld-btn-ghost ld-btn-lg" href="#maps">
                Scopri le Mappe
              </a>
            </div>
            <div className="ld-hero-stats" aria-label="Statistiche di gioco">
              <div className="ld-hero-stat">
                <strong>6</strong>
                <span>Condottieri</span>
              </div>
              <div className="ld-hero-stat-divider" aria-hidden="true" />
              <div className="ld-hero-stat">
                <strong>2</strong>
                <span>Teatri di Guerra</span>
              </div>
              <div className="ld-hero-stat-divider" aria-hidden="true" />
              <div className="ld-hero-stat">
                <strong>&infin;</strong>
                <span>Strategie</span>
              </div>
            </div>
          </div>
          <div className="ld-hero-scroll-hint" aria-hidden="true">
            <div className="ld-scroll-gem" />
            <div className="ld-scroll-line" />
          </div>
        </section>

        <section className="ld-section ld-features" id="features">
          <div className="ld-container">
            <header className="ld-section-header">
              <p className="ld-eyebrow">Caratteristiche</p>
              <h2>Una campagna tattica che resta stabile mentre migriamo la UI</h2>
              <p className="ld-section-desc">
                Tutta la surface area utente converge in React, ma lo stato di gioco e la
                validazione delle regole restano sull&apos;engine backend.
              </p>
            </header>
            <div className="ld-features-grid">
              <article className="ld-feature-card">
                <div className="ld-feature-icon" aria-hidden="true">
                  🗺
                </div>
                <h3>Due Teatri di Guerra</h3>
                <p>
                  Mondo Classico e Terra di Mezzo restano disponibili con gli stessi contenuti,
                  mentre la nuova shell React prende in carico routing, sessione e superfici di
                  controllo.
                </p>
              </article>
              <article className="ld-feature-card ld-feature-card-accent">
                <div className="ld-feature-icon" aria-hidden="true">
                  ⚔
                </div>
                <h3>Turn Flow Affidabile</h3>
                <p>
                  Rinforzo, attacco, conquista, scambio carte, fortifica e fine turno continuano a
                  passare dagli stessi endpoint e dalla stessa validazione runtime condivisa.
                </p>
              </article>
              <article className="ld-feature-card">
                <div className="ld-feature-icon" aria-hidden="true">
                  ⚜
                </div>
                <h3>Multiplayer Persistente</h3>
                <p>
                  Riapri la partita, riprendi la sessione e torna sul campo senza perdere lo stato:
                  la migrazione della UI non cambia la source of truth del gioco.
                </p>
              </article>
            </div>
          </div>
        </section>

        <section className="ld-section ld-maps" id="maps">
          <div className="ld-container">
            <header className="ld-section-header">
              <p className="ld-eyebrow">I Teatri di Guerra</p>
              <h2>Scegli il tuo campo di battaglia</h2>
              <p className="ld-section-desc">
                Le mappe esistenti restano intatte: stiamo sostituendo solo il contenitore UI, non
                l&apos;esperienza di gioco.
              </p>
            </header>

            <div className="ld-maps-grid">
              <div className="ld-map-card">
                <div className="ld-map-frame">
                  <img
                    src="/assets/maps/world-classic.png"
                    alt="Mappa Mondo Classico"
                    width="800"
                    height="533"
                    loading="lazy"
                  />
                </div>
                <div className="ld-map-info">
                  <h3>Mondo Classico</h3>
                  <p>
                    Il teatro originale con 42 territori, rotte corte per la pressione iniziale e
                    continenti che premiano il controllo strategico.
                  </p>
                </div>
              </div>

              <div className="ld-map-card">
                <div className="ld-map-frame">
                  <img
                    src="/assets/maps/middle-earth.jpg"
                    alt="Mappa Terra di Mezzo"
                    width="5606"
                    height="9214"
                    loading="lazy"
                  />
                </div>
                <div className="ld-map-info">
                  <h3>Terra di Mezzo</h3>
                  <p>
                    Una campagna fantasy con choke point iconici, fronti più narrativi e una lettura
                    visiva che resta coerente anche nella nuova app React.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ld-section ld-howto" id="howtoplay">
          <div className="ld-container">
            <header className="ld-section-header">
              <p className="ld-eyebrow">Come si gioca</p>
              <h2>Entra in partita in tre mosse</h2>
              <p className="ld-section-desc">
                Il nuovo flusso mantiene gli stessi step funzionali, ma adesso passa da un router
                React unico e verificabile end-to-end.
              </p>
            </header>

            <div className="ld-steps">
              <article className="ld-step">
                <div className="ld-step-num" aria-hidden="true">
                  I
                </div>
                <div className="ld-step-body">
                  <h3>Crea il tuo account</h3>
                  <p>Registrati e lascia che la sessione React ti riporti dove serve davvero.</p>
                </div>
              </article>
              <article className="ld-step">
                <div className="ld-step-num" aria-hidden="true">
                  II
                </div>
                <div className="ld-step-body">
                  <h3>Apri o crea una lobby</h3>
                  <p>
                    La lobby React gestisce elenco, dettaglio sessione, join e riapertura partita.
                  </p>
                </div>
              </article>
              <article className="ld-step">
                <div className="ld-step-num" aria-hidden="true">
                  III
                </div>
                <div className="ld-step-body">
                  <h3>Combatti sul tavolo di gioco</h3>
                  <p>
                    La partita live resta collegata agli stessi eventi, allo stesso stato e agli
                    stessi test.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
