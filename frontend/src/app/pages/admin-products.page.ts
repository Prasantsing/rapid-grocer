import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category, Product } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-admin-products',
  imports: [ReactiveFormsModule, InrPipe],
  template: `
    <div class="section-head">
      <h2>Products</h2>
      <button class="btn btn-dark" type="button" (click)="open()">New product</button>
    </div>
    <form class="mb-3" (submit)="search($event)">
      <input class="form-control" name="q" placeholder="Search the catalog" />
    </form>
    <div class="panel table-wrap">
      <table class="plain">
        <thead><tr><th></th><th>Name</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (product of products(); track product.id) {
            <tr>
              <td>{{ product.emoji }}</td>
              <td>{{ product.name }}<div class="muted">{{ product.unit }}</div></td>
              <td>{{ product.price | inr }}</td>
              <td>{{ product.stock }}</td>
              <td><span class="status-pill" [class.cancelled]="!product.isActive">{{ product.isActive ? 'Live' : 'Archived' }}</span></td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-dark" type="button" (click)="open(product)">Edit</button>
                @if (product.isActive) {
                  <button class="btn btn-sm btn-outline-danger ms-1" type="button" (click)="archive(product)">Archive</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (openForm()) {
      <div class="modal-sheet" (click)="openForm.set(false)">
        <form class="sheet" [formGroup]="form" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <h3>{{ editing() ? 'Edit product' : 'New product' }}</h3>
          <div class="row g-2">
            <div class="col-md-8"><input class="form-control" placeholder="Name" formControlName="name" /></div>
            <div class="col-md-4"><input class="form-control" placeholder="Brand" formControlName="brand" /></div>
            <div class="col-12"><textarea class="form-control" rows="2" placeholder="Description" formControlName="description"></textarea></div>
            <div class="col-md-6">
              <select class="form-select" formControlName="categoryId">
                @for (category of categories(); track category.id) {
                  <option [value]="category.id">{{ category.name }}</option>
                }
              </select>
            </div>
            <div class="col-md-3"><input class="form-control" placeholder="Unit" formControlName="unit" /></div>
            <div class="col-md-3"><input class="form-control" type="number" placeholder="Stock" formControlName="stock" /></div>
            <div class="col-md-3"><input class="form-control" type="number" placeholder="Price" formControlName="price" /></div>
            <div class="col-md-3"><input class="form-control" type="number" placeholder="MRP" formControlName="mrp" /></div>
            <div class="col-md-2"><input class="form-control" placeholder="Emoji" formControlName="emoji" /></div>
            <div class="col-md-4"><input class="form-control" placeholder="#F4F1E8" formControlName="tint" /></div>
            <div class="col-12 form-check">
              <input class="form-check-input" type="checkbox" formControlName="isActive" id="productLive" />
              <label class="form-check-label" for="productLive">Live on the shelf</label>
            </div>
          </div>
          <div class="d-flex gap-2 mt-3">
            <button class="btn btn-dark" type="submit" [disabled]="form.invalid || saving()">Save</button>
            <button class="btn btn-outline-dark" type="button" (click)="openForm.set(false)">Close</button>
          </div>
        </form>
      </div>
    }
  `,
})
export class AdminProductsPage {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly openForm = signal(false);
  readonly editing = signal<string | null>(null);
  readonly saving = signal(false);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    brand: [''],
    description: [''],
    categoryId: ['', Validators.required],
    unit: ['1 pc', Validators.required],
    stock: [10, Validators.required],
    price: [1, Validators.required],
    mrp: [1, Validators.required],
    emoji: ['🛍️'],
    tint: ['#F4F1E8'],
    isActive: true,
  });

  constructor() {
    void this.reload();
    void this.admin.categories().then((items) => this.categories.set(items));
  }

  async search(event: Event) {
    event.preventDefault();
    const search = String(new FormData(event.target as HTMLFormElement).get('q') || '');
    this.products.set((await this.admin.products(search)).items);
  }

  open(product?: Product) {
    this.editing.set(product?.id ?? null);
    const categoryId = product && typeof product.category === 'object' ? product.category.id : this.categories()[0]?.id || '';
    this.form.reset({
      name: product?.name || '',
      brand: product?.brand || '',
      description: product?.description || '',
      categoryId,
      unit: product?.unit || '1 pc',
      stock: product?.stock ?? 10,
      price: product?.price ?? 1,
      mrp: product?.mrp ?? 1,
      emoji: product?.emoji || '🛍️',
      tint: product?.tint || '#F4F1E8',
      isActive: product?.isActive ?? true,
    });
    this.openForm.set(true);
  }

  async save() {
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      ...raw,
      price: Number(raw.price),
      mrp: Number(raw.mrp),
      stock: Number(raw.stock),
    };
    try {
      await this.admin.saveProduct(payload, this.editing() || undefined);
      this.openForm.set(false);
      await this.reload();
      this.toasts.show('Product saved');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async archive(product: Product) {
    try {
      await this.admin.archiveProduct(product.id);
      await this.reload();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async reload() {
    this.products.set((await this.admin.products()).items);
  }
}
