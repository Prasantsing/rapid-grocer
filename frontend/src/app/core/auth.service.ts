import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ApiResponse, Role, Session, User } from './models';

const TOKEN_KEY = 'zb_access';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(sessionStorage.getItem(TOKEN_KEY));
  readonly ready = signal(false);
  private refreshTask: Promise<void> | null = null;

  async bootstrap() {
    try {
      if (this.accessToken()) {
        const me = await firstValueFrom(this.http.get<ApiResponse<User>>('/api/v1/auth/me'));
        this.user.set(me.data);
      } else {
        await this.refresh();
      }
    } catch {
      try {
        if (this.accessToken()) await this.refresh();
        else this.clear();
      } catch {
        this.clear();
      }
    } finally {
      this.ready.set(true);
    }
  }

  login(email: string, password: string) {
    return this.authenticate('/api/v1/auth/login', { email, password });
  }

  register(payload: { name: string; email: string; phone?: string; password: string }) {
    return this.authenticate('/api/v1/auth/register', payload);
  }

  refresh() {
    if (!this.refreshTask) {
      this.refreshTask = firstValueFrom(
        this.http.post<ApiResponse<Session>>('/api/v1/auth/refresh', {}, { withCredentials: true })
      ).then((response) => {
        this.persist(response.data);
      }).finally(() => {
        this.refreshTask = null;
      });
    }
    return this.refreshTask;
  }

  async logout() {
    try {
      await firstValueFrom(this.http.post('/api/v1/auth/logout', {}, { withCredentials: true }));
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
  }
}
