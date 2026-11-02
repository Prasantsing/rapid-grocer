import { ApplicationConfig, provideAppInitializer, inject, ErrorHandler } from '@angular/core';
import { provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { apiInterceptor } from './core/api.interceptor';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';
import { GlobalChunkErrorHandler } from './core/chunk-error.handler';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })),
    provideHttpClient(withInterceptors([apiInterceptor, authInterceptor])),
    provideAppInitializer(() => inject(AuthService).bootstrap()),
    { provide: ErrorHandler, useClass: GlobalChunkErrorHandler },
  ],
};
