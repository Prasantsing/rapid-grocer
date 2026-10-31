import { ErrorHandler, Injectable } from '@angular/core';

@Injectable()
export class GlobalChunkErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    const errorString =
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack || ''}`
        : typeof error === 'object' && error !== null
        ? JSON.stringify(error)
        : String(error);

    const isChunkOrImportError =
      /Failed to fetch dynamically imported module|Loading chunk|Importing a module script failed|error loading dynamically imported module|Unexpected token '<'/i.test(
        errorString
      );

    if (isChunkOrImportError && typeof window !== 'undefined') {
      const win = window as Window;
      const key = 'zap_chunk_reload_ts';
      const now = Date.now();
      const last = parseInt(win.sessionStorage.getItem(key) || '0', 10);

      // Only attempt automated reload once every 12 seconds to prevent infinite reload loops
      if (now - last > 12000) {
        win.sessionStorage.setItem(key, String(now));
        console.warn('⚡ ZapBasket detected updated app chunk mismatch. Purging stale client cache and refreshing...');

        // Purge CacheStorage if supported
        if ('caches' in win && win.caches) {
          win.caches
            .keys()
            .then((keys) => Promise.all(keys.map((k) => win.caches.delete(k))))
            .finally(() => {
              win.location.reload();
            });
          return;
        }

        win.location.reload();
        return;
      }
    }

    // Default error reporting for other non-chunk runtime issues
    console.error('ZapBasket Angular Error:', error);
  }
}
