/**
 * ZapBasket Development Environment Configuration
 *
 * - apiUrl: Base path or full URL for REST API endpoints.
 *   Default '/api/v1' enables seamless reverse-proxying and same-origin unified server calls.
 *   Set to 'http://localhost:3000/api/v1' when running independent frontend dev server on port 4200.
 */
export const environment = {
  production: false,
  apiUrl: '/api/v1',
  backendBaseUrl: 'http://localhost:3000',
  appDomain: 'localhost:4200',
  wsUrl: 'ws://localhost:3000',
  defaultThemePreset: 'emerald',
  defaultPrimaryColor: '#059669',
  defaultAccentColor: '#ea580c',
};
