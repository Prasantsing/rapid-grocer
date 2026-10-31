import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ApiResponse,
  BroadcastPromoPayload,
  BroadcastPromoResponse,
  NotificationPreferences,
  PushSummaryResponse,
  User,
} from './models';
import { AuthService } from './auth.service';
import { ToastService } from './toast.service';

const FCM_TOKEN_STORAGE_KEY = 'zb_fcm_client_token';

@Injectable({ providedIn: 'root' })
export class FcmService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);

  readonly isSupported = signal<boolean>(
    typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
  );

  readonly permissionStatus = signal<NotificationPermission | 'unsupported'>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  readonly isBusy = signal(false);
  readonly currentToken = signal<string | null>(
    typeof localStorage !== 'undefined' ? localStorage.getItem(FCM_TOKEN_STORAGE_KEY) : null
  );

  constructor() {
    this.checkInitialRegistration();
  }

  /**
   * Check whether service worker is active and if permission was previously granted, ensure token is registered.
   */
  private async checkInitialRegistration() {
    if (typeof window === 'undefined' || !this.isSupported()) return;

    this.permissionStatus.set(Notification.permission);
    if (Notification.permission === 'granted' && this.auth.user()) {
      const existingToken = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (!existingToken) {
        // Register or generate token for this device
        void this.registerDeviceToken();
      }
    }
  }

  /**
   * Request browser push permission and register token to backend
   */
  async requestPermissionAndRegister(): Promise<boolean> {
    if (!this.isSupported()) {
      this.toasts.error('Push notifications are not supported in this browser environment.');
      return false;
    }

    this.isBusy.set(true);
    try {
      const result = await Notification.requestPermission();
      this.permissionStatus.set(result);

      if (result === 'granted') {
        await this.registerDeviceToken();
        this.toasts.show('Push notifications enabled for ZapBasket!');
        // Trigger a gentle welcome push notification
        this.showLocalNotification('ZapBasket Notifications Active 🚀', {
          body: 'You will receive real-time order tracking and store discount alerts directly on your screen.',
          icon: '/favicon.ico',
          data: { url: '/orders' },
        });
        return true;
      } else if (result === 'denied') {
        this.toasts.show('Notification permission was blocked in browser settings.');
        return false;
      }
      return false;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return false;
    } finally {
      this.isBusy.set(false);
    }
  }

  /**
   * Register device token with backend
   */
  async registerDeviceToken(): Promise<string | null> {
    try {
      let token = localStorage.getItem(FCM_TOKEN_STORAGE_KEY);
      if (!token) {
        // Generate a persistent unique client push device token identifier
        token = 'fcm_web_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
        localStorage.setItem(FCM_TOKEN_STORAGE_KEY, token);
      }
      this.currentToken.set(token);

      if (this.auth.user()) {
        const deviceLabel = navigator.userAgent.includes('Mobile') ? 'Mobile Browser' : 'Desktop Browser';
        await firstValueFrom(
          this.http.post<ApiResponse<any>>('/api/v1/auth/fcm-token', {
            token,
            device: `${deviceLabel} (${navigator.platform || 'Web'})`,
          })
        );
      }
      return token;
    } catch (err) {
      console.warn('Could not register push token on backend:', err);
      return null;
    }
  }

  /**
   * Unregister device token
   */
  async unregisterDeviceToken(): Promise<void> {
    const token = this.currentToken();
    if (token) {
      try {
        await firstValueFrom(
          this.http.delete<ApiResponse<any>>('/api/v1/auth/fcm-token', {
            body: { token },
          })
        );
      } catch (err) {
        console.warn('Failed to delete fcm token on server:', err);
      }
      localStorage.removeItem(FCM_TOKEN_STORAGE_KEY);
      this.currentToken.set(null);
    }
  }

  /**
   * Update notification preferences (orderUpdates, promotionalAlerts)
   */
  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<User | null> {
    this.isBusy.set(true);
    try {
      const res = await firstValueFrom(
        this.http.patch<ApiResponse<User>>('/api/v1/auth/notification-preferences', prefs)
      );
      if (res.data) {
        this.auth.user.set(res.data);
      }
      return res.data;
    } finally {
      this.isBusy.set(false);
    }
  }

  /**
   * Dispatch local browser notification or SW notification
   */
  async showLocalNotification(title: string, options: NotificationOptions = {}): Promise<void> {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, {
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            ...options,
          });
          return;
        }
      }
      // Fallback
      new Notification(title, {
        icon: '/favicon.ico',
        ...options,
      });
    } catch (e) {
      console.warn('Direct notification failed, trying fallback:', e);
      try {
        new Notification(title, { icon: '/favicon.ico', ...options });
      } catch {
        // Notification API restricted or suppressed
      }
    }
  }

  // --- Admin Push Operations ---

  getPushSummary(): Promise<PushSummaryResponse> {
    return firstValueFrom(
      this.http.get<ApiResponse<PushSummaryResponse>>('/api/v1/admin/messaging/push-summary')
    ).then((res) => res.data);
  }

  broadcastPromo(payload: BroadcastPromoPayload): Promise<BroadcastPromoResponse> {
    return firstValueFrom(
      this.http.post<ApiResponse<BroadcastPromoResponse>>('/api/v1/admin/messaging/broadcast-promo', payload)
    ).then((res) => res.data);
  }
}
