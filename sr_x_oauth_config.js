// Public X OAuth 2.0 configuration.
// Client ID is public for a Single Page App. Never place an X Client Secret in this repository.
(() => {
  const settings = Object.freeze({
    clientId: 'T3NtaWJ5cy1jTUh3Nk1ZNnlkY0c6MTpjaQ',
    redirectUri: 'https://5j1u35k6.github.io/SecretRoom/',
    scopes: Object.freeze(['tweet.read', 'users.read'])
  });
  window.SR_X_OAUTH_CONFIG = settings;

  // Avoid blocking approved accounts before the X Developer App is configured.
  // Once clientId is filled, the verified OAuth module activates automatically.
  if (!settings.clientId) window.__SR_PHASE3_X_OAUTH__ = true;
})();
