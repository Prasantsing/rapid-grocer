import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * ApiInterceptor
 *
 * Ensures all API calls dynamically resolve their target base URL and domain based on:
 * 1. Runtime window override (e.g. Capacitor mobile runtime window.__ZAP_API_URL__)
 * 2. environment.apiUrl / environment.backendBaseUrl
 * 3. Relative path fallback (/api/v1) for unified Express host deployment
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

    if (customBase && /^https?:\/\//i.test(customBase)) {
      const cleanBase = customBase.replace(/\/+$/, '');
      // If customBase includes /api/v1, replace /api/v1 with cleanBase
      if (cleanBase.endsWith('/api/v1')) {
        targetUrl = targetUrl.replace(/^\/api\/v1/, cleanBase);
      } else {
        targetUrl = `${cleanBase}${targetUrl}`;
      }
    } else if (environment.apiUrl && /^https?:\/\//i.test(environment.apiUrl)) {
      // 2. Absolute URL configured in environment.ts
      const cleanBase = environment.apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
      targetUrl = `${cleanBase}${targetUrl}`;
    } else if (environment.backendBaseUrl && /^https?:\/\//i.test(environment.backendBaseUrl) && !environment.production) {
      // In independent dev server mode when running frontend on separate port without reverse proxy
      const isDevServerSeparatePort =
        typeof window !== 'undefined' &&
        window.location.port !== '' &&
        window.location.port !== '3000' &&
        !window.location.hostname.includes('.run.app');

      if (isDevServerSeparatePort && (window.location.port === '4200' || window.location.port === '43121')) {
        // If user is directly testing on standalone port 4200 without proxy
        const cleanBase = environment.backendBaseUrl.replace(/\/+$/, '');
        targetUrl = `${cleanBase}${targetUrl}`;
      }
    }
  }

  const outgoing = targetUrl !== req.url ? req.clone({ url: targetUrl }) : req;
  return next(outgoing);
};
