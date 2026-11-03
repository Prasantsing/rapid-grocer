import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { Category, InventoryItem, InventoryKpi } from '../core/models';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-admin-inventory-page',
  imports: [CommonModule, FormsModule, InrPipe],
  templateUrl: './admin-inventory.page.html',
})
export class AdminInventoryPage {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);

  readonly items = signal<InventoryItem[]>([]);
  readonly kpi = signal<InventoryKpi>({
    totalSkus: 0,
    totalUnits: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    healthyStockCount: 0,
    totalValuation: 0,
    lowStockThreshold: 10,
  });
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly restockingId = signal<string | null>(null);

  // Filter state
  readonly selectedStatus = signal<string>('all');
  readonly selectedCategory = signal<string>('');
  readonly selectedSort = signal<string>('stock_asc');
  readonly searchQuery = signal<string>('');

  // Custom restock modal state
  readonly customItem = signal<InventoryItem | null>(null);
  customQty = 20;
  customNote = '';
  readonly submittingCustom = signal(false);

  constructor() {
    void this.load();
    void this.admin.categories().then((cats) => this.categories.set(cats));
  }

  async load() {
    this.loading.set(true);
    try {
      const data = await this.admin.inventory({
        search: this.searchQuery(),
        status: this.selectedStatus(),
        category: this.selectedCategory(),
        sort: this.selectedSort(),
      });
      this.items.set(data.items);
      this.kpi.set(data.kpi);
    } catch (err) {
      this.toasts.error(errorMessage(err) || 'Failed to load inventory review');
    } finally {
      this.loading.set(false);
    }
  }

  setStatus(status: string) {
    this.selectedStatus.set(status);
    void this.load();
  }

  setCategory(catId: string) {
    this.selectedCategory.set(catId);
    void this.load();
  }

  setSort(sort: string) {
    this.selectedSort.set(sort);
    void this.load();
  }

  onSearchChange(q: string) {
    this.searchQuery.set(q);
    void this.load();
  }

  resetFilters() {
    this.selectedStatus.set('all');
    this.selectedCategory.set('');
    this.searchQuery.set('');
    this.selectedSort.set('stock_asc');
    void this.load();
  }

  categoryName(item: InventoryItem): string {
    if (!item.category) return 'General';
    if (typeof item.category === 'object') return item.category.name;
    const cat = this.categories().find((c) => c.id === item.category);
    return cat ? cat.name : 'General';
  }

  async quickRestock(item: InventoryItem, quantity: number) {
    this.restockingId.set(item.id);
    try {
      const res = await this.admin.restock(item.id, quantity, `Quick Restock +${quantity}`);
      this.toasts.show(`✅ Restocked +${quantity} units for ${item.name}! (New stock: ${res.newStock})`);
      await this.load();
    } catch (err) {
      this.toasts.error(errorMessage(err) || 'Restock failed');
    } finally {
      this.restockingId.set(null);
    }
  }

  openCustomRestock(item: InventoryItem) {
    this.customItem.set(item);
    this.customQty = item.stock <= 0 ? 30 : 20;
    this.customNote = '';
  }

  closeCustomRestock() {
    this.customItem.set(null);
  }

  async submitCustomRestock() {
    const item = this.customItem();
    if (!item) return;

    this.submittingCustom.set(true);
    try {
      const res = await this.admin.restock(item.id, this.customQty, this.customNote);
      this.toasts.show(`✅ Restocked +${this.customQty} units for ${item.name}! (Total: ${res.newStock})`);
      this.closeCustomRestock();
      await this.load();
    } catch (err) {
      this.toasts.error(errorMessage(err) || 'Restock failed');
    } finally {
      this.submittingCustom.set(false);
    }
  }
}
