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
  templateUrl: './floating-mini-cart.component.html',
  styleUrl: './floating-mini-cart.component.scss',
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
