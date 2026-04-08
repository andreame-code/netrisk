import { t, translateServerMessage } from "./i18n.mjs";

let providersPromise = null;

async function readJson(response) {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
}

export async function fetchAuthProviders() {
  if (!providersPromise) {
    providersPromise = fetch("/api/auth/providers")
      .then(async (response) => {
        const data = await readJson(response);
        if (!response.ok) {
          throw new Error(translateServerMessage(data, t("auth.social.google.unavailable")));
        }

        return data || { providers: ["password"], availableAuthProviders: ["password"] };
      })
      .catch((error) => {
        providersPromise = null;
        throw error;
      });
  }

  return providersPromise;
}

function includesProvider(payload, provider) {
  const providers = Array.isArray(payload?.availableAuthProviders)
    ? payload.availableAuthProviders
    : Array.isArray(payload?.providers)
      ? payload.providers
      : [];
  return providers.includes(provider);
}

export async function setupGoogleSocialButton(button, options = {}) {
  if (!button || button.dataset.socialAuthBound === "true") {
    return false;
  }

  button.hidden = true;

  let providers = null;
  try {
    providers = await fetchAuthProviders();
  } catch (error) {
    return false;
  }

  if (!includesProvider(providers, "google")) {
    return false;
  }

  button.hidden = false;
  button.dataset.socialAuthAvailable = "true";
  button.dataset.socialAuthBound = "true";
  button.addEventListener("click", async () => {
    if (button.disabled) {
      return;
    }

    button.disabled = true;
    if (typeof options.onPending === "function") {
      options.onPending();
    }

    try {
      const response = await fetch(`/api/auth/social/google/start?next=${encodeURIComponent(options.nextPath || "/profile.html")}`);
      const data = await readJson(response);
      if (!response.ok || !data?.authorizeUrl) {
        throw new Error(translateServerMessage(data, t("auth.social.google.unavailable")));
      }

      window.location.assign(data.authorizeUrl);
    } catch (error) {
      button.disabled = false;
      if (typeof options.onError === "function") {
        options.onError(error);
      }
    }
  });

  return true;
}

function callbackPayload() {
  const url = new URL(window.location.href);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  const provider = url.searchParams.get("provider") || "google";
  const nextPath = url.searchParams.get("next") || "/profile.html";

  return {
    provider,
    nextPath,
    accessToken: hash.get("access_token") || "",
    error: hash.get("error") || "",
    errorDescription: hash.get("error_description") || ""
  };
}

export async function completeGoogleAuthCallback() {
  const payload = callbackPayload();
  if (payload.error) {
    throw new Error(payload.errorDescription || t("auth.social.callbackFailed"));
  }

  if (!payload.accessToken) {
    throw new Error(t("auth.social.callbackMissingToken"));
  }

  window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);

  const response = await fetch("/api/auth/social/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: payload.provider,
      accessToken: payload.accessToken,
      next: payload.nextPath
    })
  });
  const data = await readJson(response);
  if (!response.ok) {
    throw new Error(translateServerMessage(data, t("auth.social.callbackFailed")));
  }

  return data;
}
