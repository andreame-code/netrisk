import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { getSetupStatus } from "@frontend-core/api/client.mjs";
import { getLocale, listSupportedLocales, setLocale, t } from "@frontend-i18n";

import {
  buildGameIndexPath,
  buildLobbyPath,
  buildRegisterPath
} from "@react-shell/public-auth-paths";

const landingNavLinks = [
  { href: "#features", labelKey: "landing.nav.features" },
  { href: "#maps", labelKey: "landing.nav.maps" },
  { href: "#howtoplay", labelKey: "landing.nav.howToPlay" }
];

export function LandingRoute() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [setupPageAvailable, setSetupPageAvailable] = useState(false);
  const currentLocale = getLocale();

  useEffect(() => {
    const previousTitle = document.title;
    const previousShellKind = document.body.getAttribute("data-shell-kind");
    const previousLandingMenuOpen = document.body.getAttribute("data-landing-menu-open");

    document.title = t("landing.meta.title");
    document.body.setAttribute("data-shell-kind", "marketing");

    return () => {
      document.title = previousTitle;
      if (previousLandingMenuOpen) {
        document.body.setAttribute("data-landing-menu-open", previousLandingMenuOpen);
      } else {
        document.body.removeAttribute("data-landing-menu-open");
      }
      if (previousShellKind) {
        document.body.setAttribute("data-shell-kind", previousShellKind);
        return;
      }

      document.body.removeAttribute("data-shell-kind");
    };
  }, []);

  useEffect(() => {
    if (isMenuOpen) {
      document.body.setAttribute("data-landing-menu-open", "true");
      return;
    }

    document.body.removeAttribute("data-landing-menu-open");
  }, [isMenuOpen]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    function closeOnDesktopResize(): void {
      if (window.innerWidth > 720) {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnDesktopResize);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnDesktopResize);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    getSetupStatus({
      errorMessage: "Unable to load setup status.",
      fallbackMessage: "Unable to load setup status."
    })
      .then((status) => {
        if (isMounted) {
          setSetupPageAvailable(status.setupPageAvailable);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSetupPageAvailable(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  function handleLocaleChange(nextLocale: string): void {
    const resolvedLocale = setLocale(nextLocale);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set("lang", resolvedLocale);
    window.location.assign(nextUrl.toString());
  }

  const menuLabel = t(isMenuOpen ? "landing.nav.menuClose" : "landing.nav.menuOpen");

  return (
    <>
      <header className="ld-header" id="top">
        <div className="ld-container ld-header-inner">
          <Link className="ld-brand" to="/">
            <span className="ld-brand-eyebrow">NetRisk</span>
            <span className="ld-brand-name">Frontline Dominion</span>
          </Link>

          <button
            type="button"
            className="ld-menu-toggle"
            data-landing-menu-toggle
            aria-expanded={isMenuOpen}
            aria-controls="landing-mobile-nav"
            aria-label={menuLabel}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            <span className="ld-menu-toggle-icon" aria-hidden="true" />
            <span data-landing-menu-label>{menuLabel}</span>
          </button>

          <nav className="ld-nav-links" aria-label={t("landing.nav.primaryAria")}>
            {landingNavLinks.map((link) => (
              <a href={link.href} key={link.href}>
                {t(link.labelKey)}
              </a>
            ))}
          </nav>

          <div className="ld-nav-actions">
            <label className="ld-locale-control">
              <span className="ld-locale-label">{t("nav.localeLabel")}</span>
              <select
                className="ld-locale-select"
                aria-label={t("nav.localeLabel")}
                value={currentLocale}
                onChange={(event) => handleLocaleChange(event.target.value)}
                data-testid="react-shell-landing-locale"
              >
                {listSupportedLocales().map((locale) => (
                  <option key={locale} value={locale}>
                    {t(`locale.label.${locale}`, {}, { fallback: locale.toUpperCase() })}
                  </option>
                ))}
              </select>
            </label>
            {setupPageAvailable ? (
              <Link className="ld-btn-ghost" to="/setup">
                Setup
              </Link>
            ) : null}
            <Link className="ld-btn-ghost" to={buildLobbyPath("canonical")}>
              {t("auth.login")}
            </Link>
            <Link className="ld-btn-primary" to={buildRegisterPath("canonical")}>
              {t("auth.register")}
            </Link>
          </div>
        </div>

        <div
          className="ld-container ld-mobile-panel"
          id="landing-mobile-nav"
          data-landing-mobile-panel
          hidden={!isMenuOpen}
        >
          <nav className="ld-mobile-links" aria-label={t("landing.nav.primaryAria")}>
            {landingNavLinks.map((link) => (
              <a href={link.href} key={link.href} onClick={() => setIsMenuOpen(false)}>
                {t(link.labelKey)}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="main-content">
        <section className="ld-hero">
          <div className="ld-hero-bg" />
          <div className="ld-hero-overlay" />
          <div className="ld-container ld-hero-content">
            <p className="ld-hero-eyebrow">
              <span className="ld-eyebrow-line" aria-hidden="true" />
              <span>{t("landing.hero.eyebrow")}</span>
              <span className="ld-eyebrow-line" aria-hidden="true" />
            </p>
            <h1 className="ld-hero-title">
              <span>{t("landing.hero.titleLine1")}</span>
              <br />
              <em>{t("landing.hero.titleLine2")}</em>
            </h1>
            <p className="ld-hero-desc">{t("landing.hero.desc")}</p>
            <div className="ld-hero-cta">
              <Link className="ld-btn-primary ld-btn-lg" to={buildRegisterPath("canonical")}>
                {t("landing.hero.ctaPrimary")}
              </Link>
              <a className="ld-btn-ghost ld-btn-lg" href="#maps">
                {t("landing.hero.ctaSecondary")}
              </a>
            </div>
            <div className="ld-hero-stats" aria-label={t("landing.hero.statsAria")}>
              <div className="ld-hero-stat">
                <strong>6</strong>
                <span>{t("landing.hero.stats.commanders")}</span>
              </div>
              <div className="ld-hero-stat-divider" aria-hidden="true" />
              <div className="ld-hero-stat">
                <strong>2</strong>
                <span>{t("landing.hero.stats.theaters")}</span>
              </div>
              <div className="ld-hero-stat-divider" aria-hidden="true" />
              <div className="ld-hero-stat">
                <strong>&infin;</strong>
                <span>{t("landing.hero.stats.strategies")}</span>
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
              <p className="ld-eyebrow">{t("landing.features.eyebrow")}</p>
              <h2>{t("landing.features.heading")}</h2>
              <p className="ld-section-desc">{t("landing.features.desc")}</p>
            </header>
            <div className="ld-features-grid">
              <article className="ld-feature-card">
                <div className="ld-feature-icon" aria-hidden="true">
                  🗺
                </div>
                <h3>{t("landing.features.cards.maps.title")}</h3>
                <p
                  dangerouslySetInnerHTML={{
                    __html: t("landing.features.cards.maps.body")
                  }}
                />
              </article>
              <article className="ld-feature-card ld-feature-card-accent">
                <div className="ld-feature-icon" aria-hidden="true">
                  ⚔
                </div>
                <h3>{t("landing.features.cards.strategy.title")}</h3>
                <p>{t("landing.features.cards.strategy.body")}</p>
              </article>
              <article className="ld-feature-card">
                <div className="ld-feature-icon" aria-hidden="true">
                  ⚜
                </div>
                <h3>{t("landing.features.cards.multiplayer.title")}</h3>
                <p
                  dangerouslySetInnerHTML={{
                    __html: t("landing.features.cards.multiplayer.body")
                  }}
                />
              </article>
            </div>
          </div>
        </section>

        <section className="ld-section ld-maps" id="maps">
          <div className="ld-container">
            <header className="ld-section-header">
              <p className="ld-eyebrow">{t("landing.maps.eyebrow")}</p>
              <h2>{t("landing.maps.heading")}</h2>
              <p className="ld-section-desc">{t("landing.maps.desc")}</p>
            </header>

            <div className="ld-maps-grid">
              <div className="ld-map-card">
                <div className="ld-map-frame">
                  <img
                    src="/assets/maps/world-classic.png"
                    alt={t("landing.maps.classic.alt")}
                    width="800"
                    height="533"
                    loading="lazy"
                  />
                  <div className="ld-map-hud-top" aria-hidden="true">
                    <span className="ld-map-hud-label">{t("landing.maps.classic.hudTop")}</span>
                    <div className="ld-map-players">
                      <span
                        className="ld-mp"
                        style={{ "--player-color": "#c0392b" } as CSSProperties}
                        title={t("landing.maps.classic.players.red")}
                      />
                      <span
                        className="ld-mp"
                        style={{ "--player-color": "#2980b9" } as CSSProperties}
                        title={t("landing.maps.classic.players.blue")}
                      />
                      <span
                        className="ld-mp"
                        style={{ "--player-color": "#27ae60" } as CSSProperties}
                        title={t("landing.maps.classic.players.green")}
                      />
                      <span
                        className="ld-mp"
                        style={{ "--player-color": "#d4a017" } as CSSProperties}
                        title={t("landing.maps.classic.players.gold")}
                      />
                    </div>
                  </div>
                  <div className="ld-map-hud-bottom" aria-hidden="true">
                    <span>{t("landing.maps.classic.hudBottom.territories")}</span>
                    <span>{t("landing.maps.classic.hudBottom.players")}</span>
                    <span>{t("landing.maps.classic.hudBottom.phase")}</span>
                  </div>
                </div>
                <div className="ld-map-info">
                  <h3>{t("landing.maps.classic.title")}</h3>
                  <p>{t("landing.maps.classic.body")}</p>
                  <ul className="ld-map-tags" aria-label={t("landing.maps.tagsAria")}>
                    <li>{t("landing.maps.classic.tags.territories")}</li>
                    <li>{t("landing.maps.classic.tags.continents")}</li>
                    <li>{t("landing.maps.classic.tags.players")}</li>
                  </ul>
                </div>
              </div>

              <div className="ld-map-card">
                <div className="ld-map-frame ld-map-frame--tall">
                  <img
                    src="/assets/maps/middle-earth.jpg"
                    alt={t("landing.maps.middleEarth.alt")}
                    width="5606"
                    height="9214"
                    loading="lazy"
                  />
                  <div className="ld-map-hud-top" aria-hidden="true">
                    <span className="ld-map-hud-label">{t("landing.maps.middleEarth.hudTop")}</span>
                    <div className="ld-map-players">
                      <span
                        className="ld-mp"
                        style={{ "--player-color": "#8e44ad" } as CSSProperties}
                        title={t("landing.maps.middleEarth.players.purple")}
                      />
                      <span
                        className="ld-mp"
                        style={{ "--player-color": "#c0392b" } as CSSProperties}
                        title={t("landing.maps.middleEarth.players.red")}
                      />
                      <span
                        className="ld-mp"
                        style={{ "--player-color": "#16a085" } as CSSProperties}
                        title={t("landing.maps.middleEarth.players.teal")}
                      />
                    </div>
                  </div>
                  <div className="ld-map-hud-bottom" aria-hidden="true">
                    <span>{t("landing.maps.middleEarth.hudBottom.map")}</span>
                    <span>{t("landing.maps.middleEarth.hudBottom.players")}</span>
                    <span>{t("landing.maps.middleEarth.hudBottom.phase")}</span>
                  </div>
                </div>
                <div className="ld-map-info">
                  <h3>{t("landing.maps.middleEarth.title")}</h3>
                  <p>{t("landing.maps.middleEarth.body")}</p>
                  <ul className="ld-map-tags" aria-label={t("landing.maps.tagsAria")}>
                    <li>{t("landing.maps.middleEarth.tags.kind")}</li>
                    <li>{t("landing.maps.middleEarth.tags.regions")}</li>
                    <li>{t("landing.maps.middleEarth.tags.setting")}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="ld-section ld-howto" id="howtoplay">
          <div className="ld-container">
            <header className="ld-section-header">
              <p className="ld-eyebrow">{t("landing.howto.eyebrow")}</p>
              <h2>{t("landing.howto.heading")}</h2>
              <p className="ld-section-desc">{t("landing.howto.desc")}</p>
            </header>

            <div className="ld-steps">
              <article className="ld-step">
                <div className="ld-step-num" aria-hidden="true">
                  I
                </div>
                <div className="ld-step-body">
                  <h3>{t("landing.howto.step1.title")}</h3>
                  <p>{t("landing.howto.step1.body")}</p>
                </div>
              </article>
              <article className="ld-step">
                <div className="ld-step-num" aria-hidden="true">
                  II
                </div>
                <div className="ld-step-body">
                  <h3>{t("landing.howto.step2.title")}</h3>
                  <p>{t("landing.howto.step2.body")}</p>
                </div>
              </article>
              <article className="ld-step">
                <div className="ld-step-num" aria-hidden="true">
                  III
                </div>
                <div className="ld-step-body">
                  <h3>{t("landing.howto.step3.title")}</h3>
                  <p>{t("landing.howto.step3.body")}</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="ld-section ld-final-cta">
          <div className="ld-final-cta-bg" aria-hidden="true" />
          <div className="ld-container ld-final-cta-inner">
            <div className="ld-final-cta-ornament" aria-hidden="true">
              ⚔
            </div>
            <p className="ld-eyebrow">{t("landing.final.eyebrow")}</p>
            <h2>{t("landing.final.heading")}</h2>
            <p className="ld-final-cta-desc">{t("landing.final.desc")}</p>
            <div className="ld-final-cta-btns">
              <Link className="ld-btn-primary ld-btn-lg" to={buildRegisterPath("canonical")}>
                {t("landing.final.ctaPrimary")}
              </Link>
              <Link className="ld-btn-ghost ld-btn-lg" to={buildLobbyPath("canonical")}>
                {t("landing.final.ctaSecondary")}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="ld-footer">
        <div className="ld-container ld-footer-inner">
          <Link className="ld-brand" to="/">
            <span className="ld-brand-eyebrow">NetRisk</span>
            <span className="ld-brand-name">Frontline Dominion</span>
          </Link>
          <nav className="ld-footer-links" aria-label={t("landing.footer.aria")}>
            <Link to={buildLobbyPath("canonical")}>{t("nav.lobby")}</Link>
            <Link to={buildGameIndexPath("canonical")}>{t("landing.footer.game")}</Link>
            <Link to={buildRegisterPath("canonical")}>{t("auth.register")}</Link>
            <a href="#top">{t("landing.footer.backToTop")}</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
