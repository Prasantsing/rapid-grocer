import { Component, ElementRef, computed, inject, signal, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Product } from '../core/models';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ThemeService } from '../core/theme.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { ProductCard } from '../shared/product-card.component';
import { ProductDetailSkeletonComponent } from '../shared/product-detail-skeleton.component';

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [InrPipe, RouterLink, ProductCard, ProductDetailSkeletonComponent],
  templateUrl: './product.page.html',
  styleUrl: './product.page.scss',
})
export class ProductPage {
  private readonly shop = inject(ShopService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toasts = inject(ToastService);
  readonly themeService = inject(ThemeService);

  getProductHeroBg(item: Product): string {
    if (item.imageUrl && !this.imgFailed()) {
      return this.themeService.isDark() ? 'rgba(255, 255, 255, 0.03)' : '#ffffff';
    }
    if (item.tint && item.tint.startsWith('#') && item.tint.length === 7) {
      return this.themeService.isDark() ? item.tint + '22' : item.tint;
    }
    return this.themeService.isDark() ? 'rgba(255, 255, 255, 0.03)' : '#ffffff';
  }

  readonly product = signal<Product | null>(null);
  readonly similarProducts = signal<Product[]>([]);
  readonly frequentlyBought = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly imgFailed = signal(false);

  readonly selectedSlot = signal<'front' | 'back' | 'detail'>('front');

  readonly galleryPhotos = computed(() => {
    const p = this.product();
    if (!p) return [];
    const list: { slot: 'front' | 'back' | 'detail'; label: string; url: string }[] = [];
    if (p.imageSlots?.front || p.imageUrl) {
      list.push({ slot: 'front', label: 'Front View', url: p.imageSlots?.front || p.imageUrl || '' });
    }
    if (p.imageSlots?.back) {
      list.push({ slot: 'back', label: 'Back View', url: p.imageSlots.back });
    } else if (p.images && p.images[1]) {
      list.push({ slot: 'back', label: 'Back View', url: p.images[1] });
    }
    if (p.imageSlots?.detail) {
      list.push({ slot: 'detail', label: 'Detail View', url: p.imageSlots.detail });
    } else if (p.images && p.images[2]) {
      list.push({ slot: 'detail', label: 'Detail View', url: p.images[2] });
    }
    return list;
  });

  readonly activePhotoUrl = computed(() => {
    const photos = this.galleryPhotos();
    if (photos.length === 0) return this.product()?.imageUrl || '';
    const found = photos.find((x) => x.slot === this.selectedSlot());
    return found ? found.url : (photos[0]?.url || this.product()?.imageUrl || '');
  });

  readonly activePhotoLabel = computed(() => {
    const photos = this.galleryPhotos();
    const found = photos.find((x) => x.slot === this.selectedSlot());
    return found ? found.label : 'Front View';
  });

  selectSlot(slot: 'front' | 'back' | 'detail') {
    this.selectedSlot.set(slot);
    this.imgFailed.set(false);
  }

  readonly qty = computed(() => {
    const current = this.product();
    if (!current) return 0;
    return this.shop.cart()?.items.find((item) => item.productId === current.id)?.quantity ?? 0;
  });

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') || '';
      this.loadProduct(slug);
    });
  }

  private loadProduct(slug: string) {
    this.loading.set(true);
    this.imgFailed.set(false);
    this.selectedSlot.set('front');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.shop.product(slug).then((item) => {
      this.product.set(item);
      this.error.set('');
      this.loadRecommendations(item);
    }).catch((error: unknown) => {
      this.product.set(null);
      this.similarProducts.set([]);
      this.frequentlyBought.set([]);
      this.error.set(errorMessage(error, 'That product is not on the shelf.'));
    }).finally(() => this.loading.set(false));
  }

  private loadRecommendations(item: Product) {
    const catSlug = this.categorySlug(item);

    // 1. Similar Products in Same Aisle
    if (catSlug) {
      this.shop.products({ category: catSlug, limit: 12 }).then((page) => {
        this.similarProducts.set(page.items.filter((p) => p.id !== item.id));
      }).catch(() => this.similarProducts.set([]));
    } else {
      this.similarProducts.set([]);
    }

    // 2. Frequently Bought Together (Cross-Category Pairing)
    const pairMap: Record<string, string> = {
      'fruits-vegetables': 'dairy-breakfast',
      'dairy-breakfast': 'instant-food',
      'snacks-munchies': 'cold-drinks',
      'cold-drinks': 'snacks-munchies',
      'instant-food': 'cold-drinks',
    };
    const pairCategorySlug = pairMap[catSlug] || '';

    this.shop.products({ category: pairCategorySlug || undefined, limit: 10 }).then((page) => {
      const candidates = page.items.filter((p) => p.id !== item.id);
      this.frequentlyBought.set(candidates.slice(0, 8));
    }).catch(() => {
      this.frequentlyBought.set([]);
    });
  }

  categoryName(product: Product): string {
    return typeof product.category === 'string' ? '' : product.category?.name || '';
  }

  categorySlug(product: Product): string {
    if (!product.category) return '';
    return typeof product.category === 'string' ? product.category : product.category?.slug || '';
  }

  scrollTrack(element: HTMLElement, offset: number) {
    element.scrollBy({ left: offset, behavior: 'smooth' });
  }

  add() {
    void this.change(1, true);
  }

  async change(quantity: number, adding = false) {
    const item = this.product();
    if (!item) return;
    if (!this.auth.user()) {
      await this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    if (this.auth.user()?.role !== 'customer') {
      this.toasts.error('Use a customer account to add items to your basket.');
      return;
    }
    this.busy.set(true);
    try {
      if (adding || this.qty() === 0) await this.shop.addItem(item.id, 1);
      else await this.shop.updateItem(item.id, quantity);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
