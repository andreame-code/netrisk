import { applyTranslations, resolveLocale, setLocale, t } from "./i18n.mjs";
import { completeGoogleAuthCallback } from "./social-auth.mjs";

const locale = setLocale(resolveLocale());
document.documentElement.lang = locale;
applyTranslations(document, locale);

const message = document.querySelector("#auth-callback-message");

try {
  const result = await completeGoogleAuthCallback();
  if (message) {
    message.textContent = t("auth.social.callbackSuccess");
  }

  window.location.replace(result?.nextPath || "/profile.html");
} catch (error) {
  if (message) {
    message.textContent = error.message || t("auth.social.callbackFailed");
    message.classList.add("is-error");
  }
}
