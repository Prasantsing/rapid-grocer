import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NotificationItem } from '../core/models';
import { ShopService } from '../core/shop.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-notifications-page',
  imports: [DatePipe, RouterLink],
  template: `
    <div class="section-head">
      <h2>Notifications</h2>
      <button class="btn btn-outline-dark btn-sm" type="button" (click)="readAll()">Mark all read</button>
    </div>
    @if (loading()) {
      <p class="muted">Checking the bell…</p>
    } @else if (!items().length) {
      <div class="empty panel"><h2>All quiet</h2><p>Order updates will land here.</p></div>
    } @else {
      @for (item of items(); track item.id) {
        <a class="panel d-block mb-2 text-reset" [routerLink]="item.link || '/notifications'" (click)="read(item)">
          <div class="d-flex justify-content-between">
            <strong>{{ item.title }}</strong>
            <span class="muted">{{ item.createdAt | date:'d MMM, h:mm a' }}</span>
          </div>
          <p class="mb-0" [class.fw-semibold]="!item.read">{{ item.body }}</p>
        </a>
      }
    }
    @if (error()) { <p class="text-danger">{{ error() }}</p> }
  `,
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
