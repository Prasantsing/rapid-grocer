import { Component, computed, input } from '@angular/core';
import { Order } from '../core/models';

export interface ProgressStep {
  id: string;
  key: 'placed' | 'preparing' | 'out_for_delivery' | 'delivered';
  label: string;
  description: string;
  icon: string;
  activeEmoji: string;
}

@Component({
  selector: 'app-order-progress-bar',
  standalone: true,
  templateUrl: './order-progress-bar.component.html',
  styleUrl: './order-progress-bar.component.scss',
})
export class OrderProgressBarComponent {
  // Inputs
  readonly status = input<string>('placed');
  readonly order = input<Order | null>(null);
  readonly compact = input<boolean>(false);

  // The 4 main milestones
  readonly steps: ProgressStep[] = [
    {
      id: 'step-placed',
      key: 'placed',
      label: 'Placed',
      description: 'Order received',
      icon: 'bi-bag-check-fill',
      activeEmoji: '🛒',
    },
    {
      id: 'step-preparing',
      key: 'preparing',
      label: 'Preparing',
      description: 'Dark store packing',
      icon: 'bi-box-seam-fill',
      activeEmoji: '🥕',
    },
    {
      id: 'step-out-for-delivery',
      key: 'out_for_delivery',
      label: 'Out for Delivery',
      description: 'Rider on the road',
      icon: 'bi-bicycle',
      activeEmoji: '🛵',
    },
    {
      id: 'step-delivered',
      key: 'delivered',
      label: 'Delivered',
      description: 'Handed over',
      icon: 'bi-house-check-fill',
      activeEmoji: '🎉',
    },
  ];

  // Normalized current status
  readonly activeStatus = computed(() => {
    const raw = (this.order()?.status || this.status() || 'placed').toLowerCase();
    return raw;
  });

  readonly isCancelled = computed(() => this.activeStatus() === 'cancelled');
  readonly isDelivered = computed(() => this.activeStatus() === 'delivered');
  readonly isOutForDelivery = computed(() => this.activeStatus() === 'out_for_delivery');

  // Map backend status to 0-3 step index
  // Backend statuses: 'placed' (0), 'confirmed' (1), 'packed' (1), 'out_for_delivery' (2), 'delivered' (3)
  readonly activeStepIndex = computed(() => {
    const s = this.activeStatus();
    switch (s) {
      case 'placed':
        return 0;
      case 'confirmed':
      case 'packed':
      case 'preparing':
        return 1;
      case 'out_for_delivery':
        return 2;
      case 'delivered':
        return 3;
      case 'cancelled':
        return -1;
      default:
        return 0;
    }
  });

  // Calculate percentage fill of the track: 0% -> 33.3% -> 66.6% -> 100%
  readonly progressPercent = computed(() => {
    const idx = this.activeStepIndex();
    if (idx < 0) return 0;
    if (idx === 0) return 0;
    if (idx === 1) return 33.3;
    if (idx === 2) return 66.6;
    return 100;
  });

  isStepCompleted(key: string): boolean {
    const stepIdx = this.getStepIndex(key);
    return this.activeStepIndex() > stepIdx;
  }

  isCurrentStep(key: string): boolean {
    const stepIdx = this.getStepIndex(key);
    return this.activeStepIndex() === stepIdx;
  }

  isStepUpcoming(key: string): boolean {
    const stepIdx = this.getStepIndex(key);
    return this.activeStepIndex() < stepIdx;
  }

  private getStepIndex(key: string): number {
    switch (key) {
      case 'placed':
        return 0;
      case 'preparing':
        return 1;
      case 'out_for_delivery':
        return 2;
      case 'delivered':
        return 3;
      default:
        return 0;
    }
  }

  // Titles and Subtitles
  readonly currentStageTitle = computed(() => {
    const idx = this.activeStepIndex();
    switch (idx) {
      case 0:
        return 'Order Placed & Received';
      case 1:
        return 'Packing Your Fresh Groceries';
      case 2:
        return 'Out for Delivery on E-Bike';
      case 3:
        return 'Delivered at Your Door!';
      default:
        return 'Tracking Order';
    }
  });

  readonly currentStageSubtitle = computed(() => {
    const o = this.order();
    const idx = this.activeStepIndex();
    if (o) {
      const latestTimeline = o.timeline && o.timeline.length ? o.timeline[o.timeline.length - 1] : null;
      if (latestTimeline?.note) {
        return latestTimeline.note;
      }
    }
    switch (idx) {
      case 0:
        return 'Dark store team notified. Items being picked from the shelf.';
      case 1:
        return 'Fresh produce and items packed into sealed insulated bags.';
      case 2:
        return 'Delivery partner is riding towards your address in Koramangala.';
      case 3:
        return 'Bag handed over. Thank you for ordering with ZapBasket!';
      default:
        return '';
    }
  });

  readonly statusBannerText = computed(() => {
    const idx = this.activeStepIndex();
    switch (idx) {
      case 0:
        return 'Step 1 of 4 · Placed';
      case 1:
        return 'Step 2 of 4 · In Preparation';
      case 2:
        return 'Step 3 of 4 · On the Way';
      case 3:
        return 'Completed · Delivered';
      default:
        return 'In Progress';
    }
  });

  readonly etaTime = computed(() => {
    const o = this.order();
    if (!o) return '';
    if (this.isDelivered()) {
      const deliveredEntry = o.timeline?.find((t) => t.status === 'delivered');
      if (deliveredEntry?.at) {
        return new Date(deliveredEntry.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
      }
      return 'Just now';
    }
    return new Date(new Date(o.createdAt).getTime() + 12 * 60 * 1000).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    });
  });

  readonly cancelNote = computed(() => {
    const o = this.order();
    if (!o) return '';
    const cancelEntry = o.timeline?.find((t) => t.status === 'cancelled');
    return cancelEntry?.note || '';
  });

  readonly riderName = computed(() => {
    const o = this.order();
    if (o?.deliveryPartner && typeof o.deliveryPartner === 'object') {
      return o.deliveryPartner.name;
    }
    return '';
  });

  readonly riderPhone = computed(() => {
    const o = this.order();
    if (o?.deliveryPartner && typeof o.deliveryPartner === 'object') {
      return o.deliveryPartner.phone;
    }
    return '';
  });

  getStepTimestamp(key: string): string {
    const o = this.order();
    if (!o || !o.timeline) return '';

    let targetStatus = key;
    if (key === 'preparing') {
      targetStatus = 'packed';
    }

    const entry = o.timeline.find((t) => t.status === targetStatus || (key === 'preparing' && t.status === 'confirmed'));
    if (entry?.at) {
      return new Date(entry.at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    }
    return '';
  }
}
