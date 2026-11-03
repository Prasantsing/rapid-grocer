import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationItem } from '../core/models';
import { ShopService } from '../core/shop.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe, RouterLink],
  templateUrl: './notifications.page.html',
})
export class NotificationsPage {
  private readonly shop = inject(ShopService);
  readonly items = signal<NotificationItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    void this.load();
  }

  async readAll() {
    await this.shop.markAllRead();
    this.items.update((items) => items.map((item) => ({ ...item, read: true })));
  }

  async read(item: NotificationItem) {
    if (!item.read) await this.shop.markRead(item.id);
    await this.shop.loadNotifications();
  }

  private async load() {
    try {
      const result = await this.shop.loadNotifications();
      this.items.set(result.items);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
