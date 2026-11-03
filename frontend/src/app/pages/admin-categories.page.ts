import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-admin-categories',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-categories.page.html',
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
