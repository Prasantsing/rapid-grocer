import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const credentialCall = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']
    .some((path) => req.url.includes(path));
  const token = auth.accessToken();
  const headers: Record<string, string> = {};
  if (!credentialCall && token) headers['Authorization'] = `Bearer ${token}`;

  const outgoing = req.clone({ withCredentials: true, setHeaders: headers });
  return next(outgoing).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || credentialCall) return throwError(() => error);
      return from(auth.refresh()).pipe(
        switchMap(() => {
          const retryToken = auth.accessToken();
          const retryHeaders: Record<string, string> = {};
          if (retryToken) retryHeaders['Authorization'] = `Bearer ${retryToken}`;
          return next(req.clone({ withCredentials: true, setHeaders: retryHeaders }));
        }),
        catchError((refreshError) => {
          auth.clear();
          const path = router.url.split('?')[0];
          const isPublic = path === '/' || path.startsWith('/c/') || path.startsWith('/p/') || path.startsWith('/login') || path.startsWith('/register');
          if (!isPublic) {
            void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          }
          return throwError(() => refreshError);
        })
      );
    })
  );
};
