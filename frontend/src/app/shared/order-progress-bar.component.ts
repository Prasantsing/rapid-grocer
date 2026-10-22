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
  template: `
    <div class="progress-bar-wrapper" [class.compact-mode]="compact()" [class.is-cancelled]="isCancelled()">
      @if (isCancelled()) {
        <!-- Cancelled Alert View -->
        <div class="cancelled-card">
          <div class="cancelled-icon">
            <i class="bi bi-x-circle-fill"></i>
          </div>
          <div class="cancelled-details">
            <strong class="cancelled-title">Order Cancelled</strong>
            <p class="cancelled-desc">
              {{ cancelNote() || 'This order was cancelled. Items and stocks have been returned.' }}
            </p>
          </div>
          <span class="cancelled-pill">Cancelled</span>
        </div>
      } @else {
        <!-- Full / Detailed Header Banner (non-compact) -->
        @if (!compact()) {
          <div class="status-headline-card">
            <div class="headline-content">
              <div class="live-indicator">
                <span class="pulsing-dot" [class.is-delivered]="isDelivered()"></span>
                <span class="indicator-text">{{ statusBannerText() }}</span>
              </div>
              <h3 class="current-stage-title">{{ currentStageTitle() }}</h3>
              <p class="current-stage-subtitle">{{ currentStageSubtitle() }}</p>
            </div>
            @if (etaTime()) {
              <div class="eta-pill">
                <i class="bi bi-clock-history"></i>
                <div class="eta-content">
                  <span class="eta-label">{{ isDelivered() ? 'Delivered at' : 'Estimated arrival' }}</span>
                  <strong class="eta-value">{{ etaTime() }}</strong>
                </div>
              </div>
            }
          </div>
        }

        <!-- Interactive Progress Steps Track -->
        <div class="progress-track-container" role="progressbar" [attr.aria-valuenow]="progressPercent()" aria-valuemin="0" aria-valuemax="100">
          <!-- Background Base Line -->
          <div class="track-base">
            <!-- Animated Active Progress Line Fill -->
            <div
              class="track-fill"
              [style.width.%]="progressPercent()"
              [class.complete]="isDelivered()"
            ></div>
          </div>

          <!-- Step Indicators -->
          <div class="steps-row">
            @for (step of steps; track step.key; let i = $index) {
              <div
                class="step-node"
                [class.completed]="isStepCompleted(step.key)"
                [class.current]="isCurrentStep(step.key)"
                [class.upcoming]="isStepUpcoming(step.key)"
              >
                <!-- Step Circle Badge -->
                <div class="node-circle" [title]="step.label">
                  @if (isStepCompleted(step.key)) {
                    <i class="bi bi-check-lg check-icon"></i>
                  } @else if (isCurrentStep(step.key)) {
                    <span class="active-icon"><i class="bi" [class]="step.icon"></i></span>
                  } @else {
                    <span class="upcoming-icon"><i class="bi" [class]="step.icon"></i></span>
                  }
                </div>

                <!-- Step Labels -->
                <div class="node-label-group">
                  <span class="node-name">{{ step.label }}</span>
                  @if (!compact()) {
                    <span class="node-time">
                      {{ getStepTimestamp(step.key) || step.description }}
                    </span>
                  }
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Rider or Delivery Status Footer (Detailed Mode) -->
        @if (!compact() && isOutForDelivery()) {
          <div class="delivery-partner-card">
            <div class="d-flex align-items-center gap-2">
              <span class="rider-avatar">🛵</span>
              <div>
                <strong>Rider on the way</strong>
                <p class="mb-0 text-muted small">
                  {{ riderName() ? riderName() + ' is carrying your order.' : 'Your bag has left the store and is heading to your address.' }}
                </p>
              </div>
            </div>
            @if (riderPhone()) {
              <a [href]="'tel:' + riderPhone()" class="call-rider-btn">
                <i class="bi bi-telephone-fill"></i>
                <span>Call Rider</span>
              </a>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .progress-bar-wrapper {
      position: relative;
      width: 100%;
    }

    /* Status Headline Card */
    .status-headline-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 1rem;
      background: linear-gradient(135deg, #fbf9f4 0%, #f4efe4 100%);
      border: 1px solid var(--line, #e4dccb);
      border-radius: 18px;
      padding: 1.15rem 1.35rem;
      margin-bottom: 1.5rem;
    }

    .live-indicator {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--leaf, #0e6b4f);
      margin-bottom: 0.25rem;
    }

    .pulsing-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #16a34a;
      box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
      animation: pulseGlow 1.8s infinite;
    }

    .pulsing-dot.is-delivered {
      animation: none;
      background: #0e6b4f;
    }

    @keyframes pulseGlow {
      0% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.7);
      }
      70% {
        transform: scale(1);
        box-shadow: 0 0 0 8px rgba(22, 163, 74, 0);
      }
      100% {
        transform: scale(0.95);
        box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
      }
    }

    .current-stage-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: var(--ink, #1c1915);
      margin: 0 0 0.2rem;
      letter-spacing: -0.01em;
    }

    .current-stage-subtitle {
      font-size: 0.88rem;
      color: var(--muted, #6f675c);
      margin: 0;
    }

    .eta-pill {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: #ffffff;
      border: 1px solid var(--line, #e4dccb);
      border-radius: 14px;
      padding: 0.65rem 1rem;
      box-shadow: 0 2px 8px rgba(28, 25, 21, 0.04);
    }

    .eta-pill i {
      font-size: 1.35rem;
      color: var(--leaf, #0e6b4f);
    }

    .eta-content {
      display: flex;
      flex-direction: column;
    }

    .eta-label {
      font-size: 0.68rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted, #6f675c);
    }

    .eta-value {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--ink, #1c1915);
    }

    /* Progress Track Container */
    .progress-track-container {
      position: relative;
      margin: 1.25rem 0 1rem;
      padding: 0 1rem;
    }

    .compact-mode .progress-track-container {
      margin: 0.5rem 0;
      padding: 0 0.5rem;
    }

    /* Track Base Line */
    .track-base {
      position: absolute;
      top: 19px;
      left: 3rem;
      right: 3rem;
      height: 4px;
      background: #e2dac9;
      border-radius: 999px;
      z-index: 1;
      overflow: hidden;
    }

    .compact-mode .track-base {
      top: 12px;
      left: 1.5rem;
      right: 1.5rem;
      height: 3px;
    }

    .track-fill {
      height: 100%;
      background: linear-gradient(90deg, #0e6b4f 0%, #16a34a 100%);
      border-radius: 999px;
      transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .track-fill.complete {
      background: #0e6b4f;
    }

    /* Steps Row */
    .steps-row {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      z-index: 2;
    }

    .step-node {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      width: 25%;
    }

    /* Step Circles */
    .node-circle {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #ffffff;
      border: 2.5px solid #dcd3c1;
      display: grid;
      place-items: center;
      color: #9c9384;
      font-size: 1rem;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    }

    .compact-mode .node-circle {
      width: 26px;
      height: 26px;
      border-width: 2px;
      font-size: 0.72rem;
    }

    /* Completed Step State */
    .step-node.completed .node-circle {
      background: var(--leaf, #0e6b4f);
      border-color: var(--leaf, #0e6b4f);
      color: #ffffff;
      box-shadow: 0 3px 8px rgba(14, 107, 79, 0.25);
    }

    .check-icon {
      font-size: 1.15rem;
      font-weight: 800;
    }

    .compact-mode .check-icon {
      font-size: 0.8rem;
    }

    /* Current Step State */
    .step-node.current .node-circle {
      background: #ffffff;
      border-color: #16a34a;
      color: #16a34a;
      box-shadow: 0 0 0 5px rgba(22, 163, 74, 0.2), 0 4px 10px rgba(0, 0, 0, 0.08);
      transform: scale(1.08);
    }

    .step-node.current .active-icon {
      font-size: 1.1rem;
      animation: bounceSubtle 1.8s infinite;
    }

    .compact-mode .step-node.current .active-icon {
      font-size: 0.75rem;
    }

    @keyframes bounceSubtle {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-2px); }
    }

    /* Upcoming Step State */
    .step-node.upcoming .node-circle {
      background: #fdfcf9;
      border-color: #e2dac9;
      color: #b5ac9d;
    }

    /* Labels */
    .node-label-group {
      margin-top: 0.65rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0 0.2rem;
    }

    .compact-mode .node-label-group {
      margin-top: 0.35rem;
    }

    .node-name {
      font-size: 0.85rem;
      font-weight: 600;
      color: #6f675c;
      transition: color 0.2s ease;
      white-space: nowrap;
    }

    .compact-mode .node-name {
      font-size: 0.72rem;
    }

    .step-node.completed .node-name {
      color: var(--ink, #1c1915);
      font-weight: 600;
    }

    .step-node.current .node-name {
      color: var(--leaf, #0e6b4f);
      font-weight: 750;
    }

    .node-time {
      font-size: 0.72rem;
      color: #8c8273;
      margin-top: 0.15rem;
      max-width: 110px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Delivery Partner / Rider Card */
    .delivery-partner-card {
      margin-top: 1.4rem;
      background: #edf7ed;
      border: 1px solid #c8e6c9;
      border-radius: 14px;
      padding: 0.85rem 1.15rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .rider-avatar {
      font-size: 1.8rem;
    }

    .call-rider-btn {
      background: #0e6b4f;
      color: #ffffff;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: background-color 0.15s ease;
      flex-shrink: 0;
    }

    .call-rider-btn:hover {
      background: #0a3d2e;
    }

    /* Cancelled View */
    .cancelled-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: #fdf2f2;
      border: 1px solid #fecaca;
      border-radius: 16px;
      padding: 1rem 1.25rem;
    }

    .cancelled-icon {
      font-size: 2rem;
      color: #ef4444;
      line-height: 1;
    }

    .cancelled-details {
      flex: 1;
      min-width: 0;
    }

    .cancelled-title {
      display: block;
      color: #991b1b;
      font-size: 1.05rem;
    }

    .cancelled-desc {
      margin: 0.15rem 0 0;
      font-size: 0.82rem;
      color: #b91c1c;
    }

    .cancelled-pill {
      background: #fee2e2;
      color: #991b1b;
      font-size: 0.72rem;
      font-weight: 700;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    @media (max-width: 576px) {
      .track-base {
        left: 2rem;
        right: 2rem;
      }
      .node-name {
        font-size: 0.74rem;
      }
      .node-time {
        display: none;
      }
      .status-headline-card {
        padding: 0.9rem 1rem;
      }
      .current-stage-title {
        font-size: 1.15rem;
      }
    }
  `],
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
