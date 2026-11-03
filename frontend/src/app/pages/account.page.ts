import { UpperCasePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { FcmService } from '../core/fcm.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, RouterLink, UpperCasePipe],
  templateUrl: './account.page.html',
})
export class AccountPage {
  readonly auth = inject(AuthService);
  readonly fcm = inject(FcmService);
  private readonly shop = inject(ShopService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  readonly busy = signal(false);
  readonly savingPref = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: [this.auth.user()?.name || '', [Validators.required, Validators.minLength(2)]],
    phone: [this.auth.user()?.phone || ''],
  });

  orderUpdatesEnabled(): boolean {
    return this.auth.user()?.notificationPreferences?.orderUpdates !== false;
  }

  promoAlertsEnabled(): boolean {
    return this.auth.user()?.notificationPreferences?.promotionalAlerts !== false;
  }

  async enableBrowserPush() {
    const success = await this.fcm.requestPermissionAndRegister();
    if (success) {
      this.toasts.show('Push notifications active!');
    }
  }

  async toggleOrderUpdates(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.savingPref.set(true);
    try {
      await this.fcm.updatePreferences({ orderUpdates: checked });
      this.toasts.show(checked ? 'Order status alerts enabled' : 'Order status alerts muted');
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Failed to update notification preferences'));
    } finally {
      this.savingPref.set(false);
    }
  }

  async togglePromoAlerts(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.savingPref.set(true);
    try {
      await this.fcm.updatePreferences({ promotionalAlerts: checked });
      this.toasts.show(checked ? 'Promotional alerts enabled' : 'Promotional alerts muted');
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Failed to update notification preferences'));
    } finally {
      this.savingPref.set(false);
    }
  }

  sendTestPushNotification() {
    this.fcm.showLocalNotification('⚡ ZapBasket Fast Delivery', {
      body: 'Your test push alert arrived! Live order tracking and deals are working on this device.',
      icon: '/favicon.ico',
      data: { url: '/orders' },
    });
    this.toasts.show('Test push notification triggered!');
  }

  async save() {
    this.busy.set(true);
    try {
      await this.auth.updateProfile(this.form.getRawValue());
      this.toasts.show('Profile updated');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
    this.shop.reset();
    this.toasts.show('Logged out successfully');
    await this.router.navigate(['/']);
  }
}
