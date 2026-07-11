// Public X OAuth 2.0 configuration.
// Client ID and Cloud Function URLs are public. Never place an X Client Secret here.
window.SR_X_OAUTH_CONFIG = Object.freeze({
  clientId: 'T3NtaWJ5cy1jTUh3Nk1ZNnlkY0c6MTpjaQ',
  redirectUri: 'https://5j1u35k6.github.io/SecretRoom/',
  startEndpoint: 'https://asia-east1-secretroom-ef728.cloudfunctions.net/xOAuthStart',
  completeEndpoint: 'https://asia-east1-secretroom-ef728.cloudfunctions.net/xOAuthComplete',
  scopes: Object.freeze(['tweet.read', 'users.read'])
});
