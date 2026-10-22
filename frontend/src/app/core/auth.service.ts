import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiResponse, Role, Session, User } from './models';

const TOKEN_KEY = 'zb_access';
const REFRESH_KEY = 'zb_refresh';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(
    sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
  );
  readonly ready = signal(false);
  private refreshTask: Promise<void> | null = null;

  async bootstrap() {
    try {
      const token = this.accessToken() || sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
      if (token) {
        this.accessToken.set(token);
        const me = await firstValueFrom(this.http.get<ApiResponse<User>>('/api/v1/auth/me'));
        this.user.set(me.data);
      } else {
        await this.refresh();
      }
    } catch {
      try {
        await this.refresh();
      } catch {
        this.clear();
      }
    } finally {
      this.ready.set(true);
    }
  }

  login(identifier: string, password: string) {
    const clean = identifier.trim();
    return this.authenticate('/api/v1/auth/login', {
      identifier: clean,
      email: clean,
      password,
    });
  }

  register(payload: { name: string; email: string; phone?: string; password: string }) {
    return this.authenticate('/api/v1/auth/register', {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      phone: payload.phone ? payload.phone.trim() : undefined,
      password: payload.password,
    });
  }

  refresh() {
    if (!this.refreshTask) {
      const storedRefresh = localStorage.getItem(REFRESH_KEY) || undefined;
      this.refreshTask = firstValueFrom(
        this.http.post<ApiResponse<Session>>(
          '/api/v1/auth/refresh',
          { refreshToken: storedRefresh },
          { withCredentials: true }
        )
      ).then((response) => {
        this.persist(response.data);
      }).catch((err) => {
        this.clear();
        throw err;
      }).finally(() => {
        this.refreshTask = null;
      });
    }
    return this.refreshTask;
  }

  async logout() {
    try {
      const storedRefresh = localStorage.getItem(REFRESH_KEY) || undefined;
      await firstValueFrom(
        this.http.post('/api/v1/auth/logout', { refreshToken: storedRefresh }, { withCredentials: true })
      );
    } catch {
      // Ignore network/server logout failure and proceed with local clearing
    } finally {
      this.clear();
    }
  }

  async updateProfile(payload: { name?: string; phone?: string }) {
    const response = await firstValueFrom(this.http.patch<ApiResponse<User>>('/api/v1/auth/me', payload));
    this.user.set(response.data);
    return response.data;
  }

  homeFor(role: Role) {
    if (role === 'admin') return '/admin';
    if (role === 'delivery') return '/delivery';
    return '/';
  }

  can(permission: string) {
    return this.user()?.permissions.includes(permission) ?? false;
  }

  clear() {
    this.user.set(null);
    this.accessToken.set(null);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }

  private async authenticate(url: string, body: object) {
    const response = await firstValueFrom(this.http.post<ApiResponse<Session>>(url, body, { withCredentials: true }));
    this.persist(response.data);
    return response.data.user;
  }

  private persist(session: Session) {
    this.accessToken.set(session.accessToken);
    this.user.set(session.user);
    sessionStorage.setItem(TOKEN_KEY, session.accessToken);
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    if (session.refreshToken) {
      localStorage.setItem(REFRESH_KEY, session.refreshToken);
    }
  }
}
