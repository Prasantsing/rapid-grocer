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
  template: `
    @if (quickView.isOpen() && quickView.activeProduct(); as item) {
      <div
        class="bottom-sheet-backdrop"
        [class.show]="quickView.isOpen()"
        (click)="onBackdropClick($event)"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheetProductTitle"
      >
        <div
          class="bottom-sheet-drawer"
          [class.open]="quickView.isOpen()"
          (click)="$event.stopPropagation()"
        >
          <!-- Drag Handle Indicator -->
          <div class="sheet-handle-bar" (click)="quickView.close()">
            <span class="sheet-pull-handle"></span>
          </div>

          <!-- Sticky Top Header with Category & Close -->
          <div class="sheet-header d-flex align-items-center justify-content-between px-4 pt-1 pb-2">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-emerald-subtle text-emerald rounded-pill px-2 py-1 text-uppercase fw-bold" style="font-size: 0.7rem;">
                {{ categoryName(item) }}
              </span>
              <span class="badge bg-warning-subtle text-warning-emphasis rounded-pill px-2 py-1 small">
                <i class="bi bi-lightning-charge-fill me-1"></i> 12 Mins
              </span>
            </div>

            <button
              type="button"
              class="btn-close sheet-close-btn"
              (click)="quickView.close()"
              aria-label="Close"
            ></button>
          </div>

          <!-- Scrollable Body Content -->
          <div class="sheet-body px-4 pb-4">
            <!-- Product Visual Banner -->
            <div class="sheet-visual-banner text-center mb-3 p-3 rounded-4" [style.background]="getHeroBg(item)">
              @if (item.imageUrl && !imgFailed()) {
                <img
                  [src]="item.imageUrl"
                  [alt]="item.name"
                  class="sheet-product-img"
                  (error)="imgFailed.set(true)"
                />
              } @else {
                <span class="sheet-product-emoji">{{ item.emoji }}</span>
              }

              @if (item.discountPercent > 0) {
                <span class="sheet-discount-badge">
                  <i class="bi bi-tag-fill me-1"></i> {{ item.discountPercent }}% OFF
                </span>
              }
            </div>

            <!-- Title & Pricing Row -->
            <div class="mb-3">
              <h2 id="sheetProductTitle" class="sheet-title text-dark fw-bold mb-1">{{ item.name }}</h2>
              <div class="d-flex align-items-center gap-2 text-muted small mb-2">
                <span>{{ item.brand }}</span>
                <span>•</span>
                <span class="fw-semibold text-dark">{{ item.unit }}</span>
                <span>•</span>
                <span class="text-success"><i class="bi bi-shield-check me-1"></i>100% Fresh</span>
              </div>

              <div class="d-flex align-items-baseline gap-2">
                <strong class="sheet-price-main fs-3 text-dark">{{ item.price | inr }}</strong>
                @if (item.mrp > item.price) {
                  <s class="text-muted fs-6">{{ item.mrp | inr }}</s>
                  <span class="badge bg-danger-subtle text-danger border border-danger-subtle small">
                    Save {{ (item.mrp - item.price) | inr }}
                  </span>
                }
              </div>
            </div>

            <!-- Description -->
            <p class="sheet-desc text-secondary small leading-relaxed mb-4">
              {{ item.description }}
            </p>

            <!-- Comprehensive Nutrition Facts Table -->
            @if (nutrition(); as n) {
              <div class="nutrition-card mb-4 p-3 rounded-4 border bg-light">
                <div class="d-flex align-items-center justify-content-between mb-2 pb-2 border-bottom">
                  <div class="d-flex align-items-center gap-2">
                    <i class="bi bi-heart-pulse-fill text-danger"></i>
                    <strong class="text-dark small text-uppercase fw-bold">Nutritional Facts</strong>
                  </div>
                  <span class="text-muted" style="font-size: 0.72rem;">Per {{ n.servingSize }}</span>
                </div>

                <div class="nutrition-grid">
                  <div class="nutri-item">
                    <span class="nutri-val">{{ n.calories }}</span>
                    <span class="nutri-lbl">Calories (kcal)</span>
                  </div>
                  <div class="nutri-item">
                    <span class="nutri-val">{{ n.protein }}g</span>
                    <span class="nutri-lbl">Protein</span>
                  </div>
                  <div class="nutri-item">
                    <span class="nutri-val">{{ n.carbs }}g</span>
                    <span class="nutri-lbl">Carbohydrates</span>
                  </div>
                  <div class="nutri-item">
                    <span class="nutri-val">{{ n.fat }}g</span>
                    <span class="nutri-lbl">Total Fat</span>
                  </div>
                  @if (n.fiber) {
                    <div class="nutri-item">
                      <span class="nutri-val">{{ n.fiber }}g</span>
                      <span class="nutri-lbl">Dietary Fiber</span>
                    </div>
                  }
                  @if (n.calcium) {
                    <div class="nutri-item">
                      <span class="nutri-val">{{ n.calcium }}</span>
                      <span class="nutri-lbl">Calcium</span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Key Features & Trust Badges -->
            <div class="sheet-trust-pillars mb-4">
              <div class="pillar-row">
                <i class="bi bi-snow text-info fs-5"></i>
                <div class="small">
                  <strong class="text-dark">Cold Chain Protected</strong>
                  <span class="text-muted d-block">Maintained between 2°C – 4°C from dark store to your door.</span>
                </div>
              </div>
              <div class="pillar-row">
                <i class="bi bi-clock-history text-warning fs-5"></i>
                <div class="small">
                  <strong class="text-dark">12-Minute Fast Handoff</strong>
                  <span class="text-muted d-block">Hand-picked within 90 seconds of ordering.</span>
                </div>
              </div>
              <div class="pillar-row">
                <i class="bi bi-award-fill text-success fs-5"></i>
                <div class="small">
                  <strong class="text-dark">FSSAI & Quality Tested</strong>
                  <span class="text-muted d-block">Food safety certified with sealed tamper-evident bag.</span>
                </div>
              </div>
            </div>

            <!-- Deep Link to Full Details Page -->
            <div class="text-center pt-2 pb-4">
              <a
                [routerLink]="['/p', item.slug]"
                (click)="quickView.close()"
                class="text-decoration-none text-muted small fw-medium"
              >
                View Full Product Specs & Multi-Angle Photos <i class="bi bi-arrow-right ms-1"></i>
              </a>
            </div>
          </div>

          <!-- Bottom Sticky Action Bar (Pill style) -->
          <div class="sheet-action-footer p-3 bg-white border-top">
            @if (item.stock < 1) {
              <button class="btn btn-secondary w-100 py-3 rounded-pill fw-bold" disabled>
                Currently Out of Stock
              </button>
            } @else if (qty() === 0) {
              <button
                type="button"
                class="btn btn-dark w-100 py-3 rounded-pill fw-bold d-flex align-items-center justify-content-between px-4 shadow-sm"
                [disabled]="busy()"
                (click)="add(item)"
              >
                <div class="d-flex align-items-center gap-2">
                  <i class="bi bi-basket2-fill"></i>
                  <span>ADD TO BASKET</span>
                </div>
                <span>{{ item.price | inr }}</span>
              </button>
            } @else {
              <div class="d-flex align-items-center justify-content-between gap-3">
                <div class="sheet-stepper d-flex align-items-center">
                  <button type="button" class="stepper-btn" (click)="change(item, qty() - 1)">−</button>
                  <span class="stepper-qty px-3 fw-bold fs-6">{{ qty() }}</span>
                  <button type="button" class="stepper-btn" (click)="change(item, qty() + 1)">+</button>
                </div>

                <button
                  type="button"
                  class="btn btn-success flex-grow-1 py-3 rounded-pill fw-bold d-flex align-items-center justify-content-between px-3 shadow-sm"
                  (click)="viewCart()"
                >
                  <span>ADDED ({{ (item.price * qty()) | inr }})</span>
                  <span>VIEW BASKET →</span>
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    /* Backdrop Overlay */
    .bottom-sheet-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(18, 16, 14, 0.6);
      backdrop-filter: blur(6px);
      z-index: 1050;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.25s;
    }

    .bottom-sheet-backdrop.show {
      opacity: 1;
      visibility: visible;
    }

    /* Bottom Sheet Drawer */
    .bottom-sheet-drawer {
      width: 100%;
      max-width: 580px;
      max-height: 88vh;
      background: #ffffff;
      border-top-left-radius: 28px;
      border-top-right-radius: 28px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2);
      transform: translateY(100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;
      position: relative;
    }

    .bottom-sheet-drawer.open {
      transform: translateY(0);
    }

    /* Pull Handle Bar */
    .sheet-handle-bar {
      display: flex;
      justify-content: center;
      padding: 10px 0 4px;
      cursor: pointer;
    }

    .sheet-pull-handle {
      width: 44px;
      height: 5px;
      border-radius: 999px;
      background: #d1c8b8;
    }

    .sheet-body {
      overflow-y: auto;
      overscroll-behavior: contain;
      flex: 1 1 auto;
    }

    /* Product Visual Banner */
    .sheet-visual-banner {
      height: 200px;
      display: grid;
      place-items: center;
      position: relative;
      background: #f8fafc;
    }

    .sheet-product-img {
      max-height: 160px;
      max-width: 85%;
      object-fit: contain;
      filter: drop-shadow(0 6px 14px rgba(0, 0, 0, 0.08));
    }

    .sheet-product-emoji {
      font-size: 5.5rem;
    }

    .sheet-discount-badge {
      position: absolute;
      top: 12px;
      left: 12px;
      background: #dc2626;
      color: #ffffff;
      font-weight: 700;
      font-size: 0.72rem;
      padding: 3px 8px;
      border-radius: 999px;
      box-shadow: 0 2px 6px rgba(220, 38, 38, 0.3);
    }

    .sheet-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.35rem;
      line-height: 1.25;
    }

    /* Nutrition Facts Grid */
    .nutrition-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.65rem;
      margin-top: 0.5rem;
    }

    .nutri-item {
      background: #ffffff;
      border: 1px solid #e8e3d6;
      border-radius: 12px;
      padding: 0.6rem 0.5rem;
      text-align: center;
    }

    .nutri-val {
      display: block;
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 700;
      font-size: 1.05rem;
      color: #0e6b4f;
      line-height: 1.1;
    }

    .nutri-lbl {
      display: block;
      font-size: 0.68rem;
      color: #7b7466;
      margin-top: 2px;
    }

    /* Trust Pillars */
    .sheet-trust-pillars {
      display: flex;
      flex-direction: column;
      gap: 0.85rem;
    }

    .pillar-row {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.65rem 0.85rem;
      background: #fbf9f4;
      border: 1px solid #f0ebe1;
      border-radius: 14px;
    }

    /* Sticky Footer Action */
    .sheet-action-footer {
      position: sticky;
      bottom: 0;
      z-index: 10;
      background: #ffffff;
      padding-bottom: max(1rem, env(safe-area-inset-bottom, 1rem));
    }

    .sheet-stepper {
      background: #f3efe4;
      border-radius: 999px;
      padding: 3px;
    }

    .stepper-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: 0;
      background: #ffffff;
      font-weight: bold;
      font-size: 1.2rem;
      display: grid;
      place-items: center;
      color: #1c1915;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
      cursor: pointer;
    }

    .bg-emerald-subtle {
      background-color: #d1fae5;
    }
    .text-emerald {
      color: #065f46;
    }
  `],
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
