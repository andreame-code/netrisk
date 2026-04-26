import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { setLocale } from "@frontend-i18n";

import { LandingRoute } from "@react-shell/landing-route";

import { describe, expect, it } from "vitest";

function renderLandingRoute() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <LandingRoute />
    </MemoryRouter>
  );
}

describe("LandingRoute", () => {
  it("renders translated marketing copy and the locale selector", () => {
    setLocale("en", {
      storage: window.localStorage,
      applyDocument: true
    });

    renderLandingRoute();

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Conquer the World/i
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Features").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Language")).toHaveValue("en");
  });

  it("restores the marketing mobile menu behavior", async () => {
    const user = userEvent.setup();
    renderLandingRoute();

    const menuButton = screen.getByRole("button", { name: "Apri menu" });
    const mobilePanel = document.querySelector("[data-landing-mobile-panel]");

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(mobilePanel).toHaveAttribute("hidden");

    await user.click(menuButton);

    expect(screen.getByRole("button", { name: "Chiudi menu" })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
    expect(mobilePanel).not.toHaveAttribute("hidden");
    expect(document.body).toHaveAttribute("data-landing-menu-open", "true");

    await user.click(screen.getAllByRole("link", { name: "Caratteristiche" })[1]);

    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(mobilePanel).toHaveAttribute("hidden");
  });
});
