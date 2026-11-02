import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * ApiInterceptor
 *
 * Ensures all API calls dynamically resolve their target base URL and domain based on:
 * 1. Runtime window override (e.g. Capacitor mobile runtime window.__ZAP_API_URL__)
 * 2. Native Capacitor mobile container environment (routes to environment.backendBaseUrl)
 * 3. environment.apiUrl / environment.backendBaseUrl
 * 4. Relative path fallback (/api/v1) for unified Express host deployment on Cloud Run
 */
export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  let targetUrl = req.url;

  // Check if request is an internal API path
  if (targetUrl.startsWith('/api')) {
    // 1. Check for runtime custom base URL (e.g. set by Capacitor native container or debug console)
    let customBase = '';
    if (typeof window !== 'undefined') {
      customBase = (window as any).__ZAP_API_URL__ || (window as any).__ZAP_API_BASE_URL__ || '';
    }

    // 2. Check if running inside Capacitor Android/iOS native mobile container
    const isCapacitorNative =
      typeof window !== 'undefined' &&
      (Boolean((window as any).Capacitor?.isNativePlatform?.()) ||
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'ionic:');

    if (customBase && /^https?:\/\//i.test(customBase)) {
      const cleanBase = customBase.replace(/\/+$/, '');
      if (cleanBase.endsWith('/api/v1')) {
        targetUrl = targetUrl.replace(/^\/api\/v1/, cleanBase);
      } else {
        targetUrl = `${cleanBase}${targetUrl}`;
      }
    } else if (isCapacitorNative && environment.backendBaseUrl) {
      // Native mobile builds must use absolute deployment URL
      const cleanBase = environment.backendBaseUrl.replace(/\/+$/, '');
      targetUrl = `${cleanBase}${targetUrl}`;
    } else if (environment.apiUrl && /^https?:\/\//i.test(environment.apiUrl)) {
      // Absolute URL configured in environment.ts
      const cleanBase = environment.apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
      targetUrl = `${cleanBase}${targetUrl}`;
    } else if (environment.backendBaseUrl && /^https?:\/\//i.test(environment.backendBaseUrl) && !environment.production) {
      // Standalone development server on separate port without reverse proxy
      const isDevServerSeparatePort =
        typeof window !== 'undefined' &&
        window.location.port !== '' &&
        window.location.port !== '3000' &&
        !window.location.hostname.includes('.run.app');

      if (isDevServerSeparatePort && (window.location.port === '4200' || window.location.port === '43121')) {
        const cleanBase = environment.backendBaseUrl.replace(/\/+$/, '');
        targetUrl = `${cleanBase}${targetUrl}`;
      }
    }
  }

  const outgoing = targetUrl !== req.url ? req.clone({ url: targetUrl }) : req;
  return next(outgoing);
};
