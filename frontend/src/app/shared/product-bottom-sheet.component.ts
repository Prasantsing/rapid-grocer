import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { ProductQuickViewService, NutritionFacts } from '../core/product-quick-view.service';
import { InrPipe } from './inr.pipe';
import { Product } from '../core/models';

@Component({
  selector: 'app-product-bottom-sheet',
  standalone: true,
  imports: [CommonModule, RouterLink, InrPipe],
  templateUrl: './product-bottom-sheet.component.html',
  styleUrl: './product-bottom-sheet.component.scss',
})
export class ProductBottomSheetComponent {
  readonly quickView = inject(ProductQuickViewService);
  private readonly shop = inject(ShopService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly busy = signal(false);
  readonly imgFailed = signal(false);

  readonly qty = computed(() => {
    const p = this.quickView.activeProduct();
    if (!p) return 0;
    return this.shop.cart()?.items.find((item) => item.productId === p.id)?.quantity ?? 0;
  });

  readonly nutrition = computed(() => {
    const p = this.quickView.activeProduct();
    if (!p) return null;
    return this.quickView.getNutrition(p);
  });

  categoryName(item: Product): string {
    if (typeof item.category === 'object' && item.category !== null) {
      return item.category.name;
    }
    return String(item.category || 'Grocery');
  }

  getHeroBg(item: Product): string {
    const t = item.tint;
    if (t && t.startsWith('#') && t.length === 7) {
      return t + '22';
    }
    return '#f8fafc';
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.quickView.close();
    }
  }

  async add(item: Product) {
    await this.change(item, 1);
  }

  async change(item: Product, quantity: number) {
    if (!this.auth.user()) {
      this.quickView.close();
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.auth.user()?.role !== 'customer') {
      this.toast.error('Use a customer account to fill a basket.');
      return;
    }

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(15);
      } catch (_) {}
    }

    this.busy.set(true);
    try {
      if (quantity === 0) {
        await this.shop.updateItem(item.id, 0);
        this.toast.show(`Removed ${item.name} from basket.`);
      } else if (this.qty() === 0) {
        await this.shop.addItem(item.id, quantity);
        this.toast.show(`Added ${item.name} to basket!`);
      } else {
        await this.shop.updateItem(item.id, quantity);
      }
    } catch (err: any) {
      this.toast.error(err.message || 'Could not update basket');
    } finally {
      this.busy.set(false);
    }
  }

  viewCart() {
    this.quickView.close();
    this.router.navigate(['/cart']);
  }
}
