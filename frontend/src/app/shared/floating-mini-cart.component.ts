import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { ShopService } from '../core/shop.service';
import { InrPipe } from './inr.pipe';

@Component({
  selector: 'app-floating-mini-cart',
  standalone: true,
  imports: [CommonModule, InrPipe],
  template: `
    @if (shouldShow()) {
      <aside
        class="floating-mini-cart-container"
        role="region"
        aria-label="Floating cart action bar"
      >
        <div
          class="mini-cart-pill"
          [class.sliding]="isDragging()"
          (click)="onPillTap()"
        >
          <!-- Left Info: Item count, 12m Badge & Price -->
          <div class="cart-info-side">
            <div class="d-flex align-items-center gap-2">
              <span class="lightning-badge">
                <i class="bi bi-lightning-charge-fill text-warning"></i> 12m
              </span>
              <span class="item-count-text">
                {{ itemCount() }} {{ itemCount() === 1 ? 'ITEM' : 'ITEMS' }}
              </span>
            </div>

            <div class="d-flex align-items-baseline gap-1 mt-1">
              <strong class="cart-total-text">{{ total() | inr }}</strong>
              @if (savings() > 0) {
                <span class="cart-savings-badge">
                  Save {{ savings() | inr }}
                </span>
              }
            </div>
          </div>

          <!-- Right Action: Interactive "Slide / Tap to Checkout" Slider -->
          <div
            class="checkout-slider-track"
            (touchstart)="onTouchStart($event)"
            (touchmove)="onTouchMove($event)"
            (touchend)="onTouchEnd()"
            (click)="onSliderClick($event)"
          >
            <div
              class="slider-thumb"
              [style.transform]="'translateX(' + sliderOffset() + 'px)'"
            >
              <i class="bi bi-arrow-right-short"></i>
            </div>
            <span class="slider-label">
              {{ isDragging() ? 'Release to Order' : 'Slide to Checkout' }}
            </span>
          </div>
        </div>
      </aside>
    }
  `,
  styles: [`
    .floating-mini-cart-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 28px);
      max-width: 480px;
      z-index: 1040;
      animation: slideUpFloat 0.35s cubic-bezier(0.16, 1, 0.3, 1);
      pointer-events: none;
    }

    /* On mobile with bottom navigation bar */
    @media (max-width: 768px) {
      .floating-mini-cart-container {
        bottom: 74px; /* Sits cleanly above the mobile nav */
        width: calc(100% - 20px);
      }
    }

    @keyframes slideUpFloat {
      from {
        opacity: 0;
        transform: translate(-50%, 30px);
      }
      to {
        opacity: 1;
        transform: translate(-50%, 0);
      }
    }

    .mini-cart-pill {
      pointer-events: auto;
      background: linear-gradient(135deg, #072a20 0%, #0d4a37 55%, #0e6b4f 100%);
      color: #ffffff;
      border: 1px solid rgba(240, 180, 41, 0.3);
      border-radius: 999px;
      padding: 8px 12px 8px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      box-shadow: 0 10px 30px rgba(7, 42, 32, 0.45), 0 2px 10px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(8px);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      cursor: pointer;
    }

    .mini-cart-pill:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 36px rgba(7, 42, 32, 0.55);
    }

    .cart-info-side {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .lightning-badge {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      font-size: 0.68rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      background: rgba(240, 180, 41, 0.2);
      color: #f0b429;
      padding: 1px 6px;
      border-radius: 6px;
      border: 1px solid rgba(240, 180, 41, 0.35);
    }

    .item-count-text {
      font-size: 0.74rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: rgba(246, 241, 228, 0.85);
    }

    .cart-total-text {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: #ffffff;
      line-height: 1;
    }

    .cart-savings-badge {
      font-size: 0.68rem;
      font-weight: 700;
      background: #16a34a;
      color: #ffffff;
      padding: 1px 6px;
      border-radius: 999px;
      margin-left: 4px;
    }

    /* Interactive Slider Track */
    .checkout-slider-track {
      position: relative;
      background: rgba(255, 255, 255, 0.12);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 999px;
      height: 44px;
      width: 170px;
      display: flex;
      align-items: center;
      padding: 3px;
      overflow: hidden;
      user-select: none;
      touch-action: pan-y;
    }

    .slider-thumb {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      background: #f0b429;
      color: #1c1915;
      display: grid;
      place-items: center;
      font-size: 1.5rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
      z-index: 2;
      transition: transform 0.1s linear;
      flex-shrink: 0;
    }

    .slider-label {
      position: absolute;
      width: 100%;
      text-align: center;
      padding-left: 28px;
      font-size: 0.78rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #ffffff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      pointer-events: none;
      z-index: 1;
    }
  `],
})
export class FloatingMiniCartComponent {
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);

  readonly isDragging = signal(false);
  readonly sliderOffset = signal(0);
  private touchStartX = 0;
  private maxSlide = 120;
  private currentUrl = signal(this.router.url);

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.currentUrl.set(e.urlAfterRedirects || e.url);
    });
  }

  readonly itemCount = computed(() => this.shop.cart()?.itemCount || 0);
  readonly total = computed(() => this.shop.cart()?.total || 0);

  readonly savings = computed(() => {
    const cart = this.shop.cart();
    if (!cart) return 0;
    const mrpTotal = cart.items.reduce((sum, i) => sum + (i.mrp || i.price) * i.quantity, 0);
    return Math.max(0, mrpTotal - cart.subtotal);
  });

  readonly shouldShow = computed(() => {
    if (this.itemCount() <= 0) return false;
    const url = this.currentUrl();
    // Hide when already checking out to avoid clutter
    if (url.includes('/checkout')) return false;
    return true;
  });

  onTouchStart(event: TouchEvent) {
    if (event.touches.length > 0) {
      this.touchStartX = event.touches[0].clientX;
      this.isDragging.set(true);
    }
  }

  onTouchMove(event: TouchEvent) {
    if (!this.isDragging() || event.touches.length === 0) return;
    const deltaX = event.touches[0].clientX - this.touchStartX;
    const clamped = Math.max(0, Math.min(this.maxSlide, deltaX));
    this.sliderOffset.set(clamped);

    // If slid past 75%, trigger instant checkout
    if (clamped >= this.maxSlide * 0.75) {
      this.triggerCheckout();
      this.onTouchEnd();
    }
  }

  onTouchEnd() {
    this.isDragging.set(false);
    this.sliderOffset.set(0);
  }

  onSliderClick(event: MouseEvent) {
    event.stopPropagation();
    this.triggerCheckout();
  }

  onPillTap() {
    this.triggerCheckout();
  }

  private triggerCheckout() {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([20, 30]);
      } catch (_) {}
    }

    const url = this.currentUrl();
    if (url.includes('/cart')) {
      this.router.navigate(['/checkout']);
    } else {
      this.router.navigate(['/cart']);
    }
  }
}
