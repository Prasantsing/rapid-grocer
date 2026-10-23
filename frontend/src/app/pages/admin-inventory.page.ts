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
  template: `
    <div class="section-head mb-3">
      <div>
        <h2>Inventory & Stock Review</h2>
        <p class="muted mb-0">Monitor stock levels, urgent stock-out alerts, inventory valuation, and quick restock</p>
      </div>
      <button class="btn btn-outline-dark d-inline-flex align-items-center gap-1" type="button" [disabled]="loading()" (click)="load()">
        <i class="bi bi-arrow-clockwise" [class.spin]="loading()"></i> Refresh
      </button>
    </div>

    <!-- Stock KPI Grid -->
    <div class="stat-grid mb-4">
      <div class="panel stat">
        <span>Active SKUs</span>
        <strong>{{ kpi().totalSkus }}</strong>
        <small class="muted">{{ kpi().totalUnits | number }} total units in dark store</small>
      </div>
      <div class="panel stat" [class.border-warning]="kpi().lowStockCount > 0">
        <span class="text-warning-emphasis fw-semibold">Low Stock (< 10)</span>
        <strong class="text-warning-emphasis">{{ kpi().lowStockCount }}</strong>
        <small class="muted">Approaching stock-out threshold</small>
      </div>
      <div class="panel stat" [class.border-danger]="kpi().outOfStockCount > 0">
        <span class="text-danger fw-semibold">Out of Stock (Urgent)</span>
        <strong class="text-danger">{{ kpi().outOfStockCount }}</strong>
        <small class="muted">Currently sold out on storefront</small>
      </div>
      <div class="panel stat">
        <span>Total Inventory Value</span>
        <strong>{{ kpi().totalValuation | inr }}</strong>
        <small class="muted">Based on retail selling prices</small>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="panel mb-3 p-3">
      <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center">
        <!-- Status Filter Segmented Controls -->
        <div class="btn-group btn-group-sm" role="group" aria-label="Stock Health Filter">
          <button
            type="button"
            class="btn"
            [class.btn-dark]="selectedStatus() === 'all'"
            [class.btn-outline-dark]="selectedStatus() !== 'all'"
            (click)="setStatus('all')"
          >
            All ({{ kpi().totalSkus }})
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-danger]="selectedStatus() === 'urgent'"
            [class.btn-outline-danger]="selectedStatus() !== 'urgent'"
            (click)="setStatus('urgent')"
          >
            Out of Stock ({{ kpi().outOfStockCount }})
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-warning]="selectedStatus() === 'low'"
            [class.btn-outline-warning]="selectedStatus() !== 'low'"
            (click)="setStatus('low')"
          >
            Low Stock ({{ kpi().lowStockCount }})
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-success]="selectedStatus() === 'healthy'"
            [class.btn-outline-success]="selectedStatus() !== 'healthy'"
            (click)="setStatus('healthy')"
          >
            Healthy ({{ kpi().healthyStockCount }})
          </button>
        </div>

        <!-- Category & Sort Controls -->
        <div class="d-flex gap-2 align-items-center flex-wrap">
          <select class="form-select form-select-sm w-auto" [ngModel]="selectedCategory()" (ngModelChange)="setCategory($event)">
            <option value="">All Categories</option>
            @for (cat of categories(); track cat.id) {
              <option [value]="cat.id">{{ cat.emoji }} {{ cat.name }}</option>
            }
          </select>

          <select class="form-select form-select-sm w-auto" [ngModel]="selectedSort()" (ngModelChange)="setSort($event)">
            <option value="stock_asc">Stock: Lowest First</option>
            <option value="stock_desc">Stock: Highest First</option>
            <option value="value_desc">Valuation: Highest First</option>
            <option value="name">Name: A to Z</option>
          </select>
        </div>
      </div>

      <!-- Search Input -->
      <div class="mt-2">
        <input
          class="form-control form-control-sm"
          placeholder="Search by product name, brand, or pack unit..."
          [ngModel]="searchQuery()"
          (ngModelChange)="onSearchChange($event)"
        />
      </div>
    </div>

    <!-- Inventory Table -->
    <div class="panel table-wrap">
      @if (loading()) {
        <p class="muted p-4 text-center">Loading live inventory status…</p>
      } @else if (items().length === 0) {
        <div class="text-center p-5">
          <p class="fs-1 mb-2">📦</p>
          <h5>No products match this filter</h5>
          <p class="muted small">Try selecting "All" or clearing the search query.</p>
          <button class="btn btn-sm btn-dark" type="button" (click)="resetFilters()">Show All Products</button>
        </div>
      } @else {
        <!-- Desktop Table View -->
        <div class="d-none d-md-block">
          <table class="plain">
            <thead>
              <tr>
                <th style="width: 50px">Visual</th>
                <th>Product & SKU</th>
                <th>Category / HSN</th>
                <th>Price</th>
                <th style="width: 170px">Stock Level</th>
                <th>Valuation</th>
                <th>Status</th>
                <th class="text-end" style="min-width: 220px">Quick Restock</th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr [class.table-danger]="item.stock === 0" [class.table-warning]="item.stock > 0 && item.stock <= 10">
                  <td>
                    @if (item.imageUrl) {
                      <img [src]="item.imageUrl" [alt]="item.name" class="admin-table-thumb" />
                    } @else {
                      <span class="fs-4">{{ item.emoji }}</span>
                    }
                  </td>
                  <td>
                    <strong>{{ item.name }}</strong>
                    <div class="muted small">{{ item.brand || 'Store Brand' }} · {{ item.unit }}</div>
                  </td>
                  <td>
                    <div>{{ categoryName(item) }}</div>
                    <small class="text-muted font-monospace">HSN: {{ item.hsn }} ({{ item.gstRate }}% GST)</small>
                  </td>
                  <td>
                    <strong>{{ item.price | inr }}</strong>
                    @if (item.mrp > item.price) {
                      <div class="muted small"><s>{{ item.mrp | inr }}</s></div>
                    }
                  </td>
                  <td>
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <span class="fw-bold font-monospace fs-6" [class.text-danger]="item.stock === 0" [class.text-warning-emphasis]="item.stock > 0 && item.stock <= 10">
                        {{ item.stock }} units
                      </span>
                      <small class="muted">{{ item.stockPercent }}% of target</small>
                    </div>
                    <div class="progress" style="height: 6px;">
                      <div
                        class="progress-bar"
                        [class.bg-danger]="item.stock === 0"
                        [class.bg-warning]="item.stock > 0 && item.stock <= 10"
                        [class.bg-success]="item.stock > 10"
                        role="progressbar"
                        [style.width.%]="item.stockPercent"
                        [attr.aria-valuenow]="item.stockPercent"
                        aria-valuemin="0"
                        aria-valuemax="100"
                      ></div>
                    </div>
                  </td>
                  <td>
                    <span class="font-monospace fw-semibold">{{ item.valuation | inr }}</span>
                  </td>
                  <td>
                    <span
                      class="badge"
                      [class.bg-danger]="item.stockHealth === 'out_of_stock'"
                      [class.bg-warning]="item.stockHealth === 'low_stock'"
                      [class.text-dark]="item.stockHealth === 'low_stock'"
                      [class.bg-success]="item.stockHealth === 'healthy'"
                    >
                      {{ item.stockHealthLabel }}
                    </span>
                  </td>
                  <td class="text-end">
                    <div class="btn-group btn-group-sm" role="group">
                      <button
                        type="button"
                        class="btn btn-outline-dark"
                        [disabled]="restockingId() === item.id"
                        (click)="quickRestock(item, 10)"
                        title="Add 10 units"
                      >
                        +10
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-dark"
                        [disabled]="restockingId() === item.id"
                        (click)="quickRestock(item, 25)"
                        title="Add 25 units"
                      >
                        +25
                      </button>
                      <button
                        type="button"
                        class="btn btn-outline-dark"
                        [disabled]="restockingId() === item.id"
                        (click)="quickRestock(item, 50)"
                        title="Add 50 units"
                      >
                        +50
                      </button>
                      <button
                        type="button"
                        class="btn btn-dark"
                        [disabled]="restockingId() === item.id"
                        (click)="openCustomRestock(item)"
                      >
                        Custom…
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile Stacked Touch Cards (< 768px) -->
        <div class="d-md-none mobile-card-list">
          @for (item of items(); track item.id) {
            <div class="admin-touch-card" [class.border-danger]="item.stock === 0" [class.border-warning]="item.stock > 0 && item.stock <= 10">
              <div class="d-flex gap-3 align-items-start mb-2">
                <div class="admin-card-visual flex-shrink-0">
                  @if (item.imageUrl) {
                    <img [src]="item.imageUrl" [alt]="item.name" class="admin-table-thumb-lg" />
                  } @else {
                    <span class="fs-1">{{ item.emoji }}</span>
                  }
                </div>
                <div class="flex-grow-1 min-w-0">
                  <div class="d-flex justify-content-between align-items-start gap-1">
                    <strong class="admin-card-title text-truncate">{{ item.name }}</strong>
                    <span
                      class="badge flex-shrink-0"
                      [class.bg-danger]="item.stockHealth === 'out_of_stock'"
                      [class.bg-warning]="item.stockHealth === 'low_stock'"
                      [class.text-dark]="item.stockHealth === 'low_stock'"
                      [class.bg-success]="item.stockHealth === 'healthy'"
                    >
                      {{ item.stockHealthLabel }}
                    </span>
                  </div>
                  <div class="muted small">{{ item.brand || 'Store Brand' }} · {{ item.unit }}</div>
                  <div class="d-flex align-items-center gap-2 mt-1">
                    <strong class="text-dark">{{ item.price | inr }}</strong>
                    <small class="text-muted">Valuation: {{ item.valuation | inr }}</small>
                  </div>
                </div>
              </div>

              <!-- Stock Level Progress Bar -->
              <div class="mb-2">
                <div class="d-flex justify-content-between align-items-center small mb-1">
                  <span class="fw-bold font-monospace" [class.text-danger]="item.stock === 0" [class.text-warning-emphasis]="item.stock > 0 && item.stock <= 10">
                    <i class="bi bi-box-seam me-1"></i>{{ item.stock }} units in stock
                  </span>
                  <span class="text-muted small">{{ item.stockPercent }}% of target</span>
                </div>
                <div class="progress" style="height: 6px;">
                  <div
                    class="progress-bar"
                    [class.bg-danger]="item.stock === 0"
                    [class.bg-warning]="item.stock > 0 && item.stock <= 10"
                    [class.bg-success]="item.stock > 10"
                    role="progressbar"
                    [style.width.%]="item.stockPercent"
                  ></div>
                </div>
              </div>

              <!-- Quick Restock Actions -->
              <div class="d-flex justify-content-between align-items-center pt-2 border-top gap-2 flex-wrap">
                <div class="btn-group btn-group-sm" role="group">
                  <button type="button" class="btn btn-outline-dark" [disabled]="restockingId() === item.id" (click)="quickRestock(item, 10)">+10</button>
                  <button type="button" class="btn btn-outline-dark" [disabled]="restockingId() === item.id" (click)="quickRestock(item, 25)">+25</button>
                </div>
                <button type="button" class="btn btn-sm btn-dark px-3" [disabled]="restockingId() === item.id" (click)="openCustomRestock(item)">
                  <i class="bi bi-box-arrow-in-down me-1"></i>Restock…
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Custom Restock Modal -->
    @if (customItem()) {
      <div class="modal-sheet" (click)="closeCustomRestock()">
        <div class="sheet" (click)="$event.stopPropagation()" style="max-width: 440px;">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h4>Restock {{ customItem()?.name }}</h4>
            <button type="button" class="btn-close" (click)="closeCustomRestock()"></button>
          </div>
          <p class="muted small mb-3">Current dark-store stock: <strong>{{ customItem()?.stock }} units</strong></p>

          <form (ngSubmit)="submitCustomRestock()">
            <div class="mb-3">
              <label class="form-label small fw-semibold">Quantity to Add</label>
              <input
                type="number"
                class="form-control form-control-lg text-center font-monospace"
                [(ngModel)]="customQty"
                name="customQty"
                min="1"
                max="5000"
                required
                autofocus
              />
            </div>

            <div class="mb-3">
              <label class="form-label small fw-semibold">Receiving Note / Supplier Batch (Optional)</label>
              <input
                type="text"
                class="form-control"
                placeholder="e.g. Batch #2026-OCT from Koramangala Hub"
                [(ngModel)]="customNote"
                name="customNote"
              />
            </div>

            <div class="d-flex gap-2 justify-content-end">
              <button type="button" class="btn btn-outline-secondary" (click)="closeCustomRestock()">Cancel</button>
              <button
                type="submit"
                class="btn btn-dark"
                style="background: #0e6b4f; border-color: #0e6b4f"
                [disabled]="!customQty || customQty < 1 || submittingCustom()"
              >
                {{ submittingCustom() ? 'Restocking...' : 'Confirm Restock' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
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
