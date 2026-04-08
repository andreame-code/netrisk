const PASSWORD_AUTH_PROVIDER_ID = "password";
const EMAIL_AUTH_PROVIDER_ID = "email";
const GOOGLE_AUTH_PROVIDER_ID = "google";
const DISCORD_AUTH_PROVIDER_ID = "discord";

const authProviders = Object.freeze([
  Object.freeze({
    id: PASSWORD_AUTH_PROVIDER_ID,
    type: "credentials",
    label: "Password"
  }),
  Object.freeze({
    id: EMAIL_AUTH_PROVIDER_ID,
    type: "identity",
    label: "Email"
  }),
  Object.freeze({
    id: GOOGLE_AUTH_PROVIDER_ID,
    type: "social",
    label: "Google"
  }),
  Object.freeze({
    id: DISCORD_AUTH_PROVIDER_ID,
    type: "social",
    label: "Discord"
  })
]);

function listAuthProviders() {
  return authProviders.map((provider) => ({ ...provider }));
}

function listAuthProviderIds() {
  return authProviders.map((provider) => provider.id);
}

function findAuthProvider(providerId) {
  return authProviders.find((provider) => provider.id === providerId) || null;
}

module.exports = {
  DISCORD_AUTH_PROVIDER_ID,
  EMAIL_AUTH_PROVIDER_ID,
  GOOGLE_AUTH_PROVIDER_ID,
  PASSWORD_AUTH_PROVIDER_ID,
  findAuthProvider,
  listAuthProviderIds,
  listAuthProviders
};
