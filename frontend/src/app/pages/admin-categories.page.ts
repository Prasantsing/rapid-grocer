import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-admin-categories',
  imports: [ReactiveFormsModule],
  template: `
    <div class="section-head">
      <h2>Categories</h2>
      <button class="btn btn-dark" type="button" (click)="open()">New category</button>
    </div>
    <div class="panel">
      @for (category of categories(); track category.id) {
        <div class="line-item">
          <div><span class="me-2">{{ category.emoji }}</span><strong>{{ category.name }}</strong>
            <div class="muted">{{ category.slug }} · {{ category.isActive ? 'Live' : 'Hidden' }}</div>
          </div>
          <div>
            <button class="btn btn-sm btn-outline-dark" type="button" (click)="open(category)">Edit</button>
            <button class="btn btn-sm btn-outline-danger ms-1" type="button" (click)="archive(category)">Hide</button>
          </div>
        </div>
      }
    </div>
    @if (openForm()) {
      <div class="modal-sheet" (click)="openForm.set(false)">
        <form class="sheet" [formGroup]="form" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <h3>{{ editing() ? 'Edit category' : 'New category' }}</h3>
          <input class="form-control mb-2" placeholder="Name" formControlName="name" />
          <textarea class="form-control mb-2" rows="2" placeholder="Description" formControlName="description"></textarea>
          <div class="row g-2">
            <div class="col-4"><input class="form-control" placeholder="Emoji" formControlName="emoji" /></div>
            <div class="col-4"><input class="form-control" placeholder="#E7F6EF" formControlName="tint" /></div>
            <div class="col-4"><input class="form-control" type="number" placeholder="Sort" formControlName="sortOrder" /></div>
          </div>
          <div class="form-check my-2">
            <input class="form-check-input" type="checkbox" id="catLive" formControlName="isActive" />
            <label class="form-check-label" for="catLive">Visible in the store</label>
          </div>
          <button class="btn btn-dark" type="submit" [disabled]="form.invalid">Save</button>
        </form>
      </div>
    }
  `,
})
export class AdminCategoriesPage {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly categories = signal<Category[]>([]);
  readonly openForm = signal(false);
  readonly editing = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    emoji: ['🛒'],
    tint: ['#E7F6EF'],
    sortOrder: 0,
    isActive: true,
  });

  constructor() { void this.reload(); }

  open(category?: Category) {
    this.editing.set(category?.id ?? null);
    this.form.reset({
      name: category?.name || '',
      description: category?.description || '',
      emoji: category?.emoji || '🛒',
      tint: category?.tint || '#E7F6EF',
      sortOrder: category?.sortOrder ?? 0,
      isActive: category?.isActive ?? true,
    });
    this.openForm.set(true);
  }

  async save() {
    const raw = this.form.getRawValue();
    try {
      await this.admin.saveCategory({ ...raw, sortOrder: Number(raw.sortOrder) }, this.editing() || undefined);
      this.openForm.set(false);
      await this.reload();
      this.toasts.show('Category saved');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async archive(category: Category) {
    try {
      await this.admin.archiveCategory(category.id);
      await this.reload();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async reload() {
    this.categories.set(await this.admin.categories());
  }
}
