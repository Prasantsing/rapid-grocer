import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Coupon } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-admin-coupons',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-coupons.page.html',
})
export class AdminCouponsPage {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly coupons = signal<Coupon[]>([]);
  readonly openForm = signal(false);
  readonly editing = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    description: [''],
    type: 'flat' as 'flat' | 'percent' | 'free_delivery',
    value: [50, Validators.required],
    minOrder: 199,
    maxDiscount: 50,
    usageLimit: 100,
    isActive: true,
  });

  constructor() { void this.reload(); }

  open(coupon?: Coupon) {
    this.editing.set(coupon?.id ?? null);
    this.form.reset({
      code: coupon?.code || '',
      description: coupon?.description || '',
      type: coupon?.type || 'flat',
      value: coupon?.value ?? 50,
      minOrder: coupon?.minOrder ?? 0,
      maxDiscount: coupon?.maxDiscount ?? 0,
      usageLimit: coupon?.usageLimit ?? 0,
      isActive: coupon?.isActive ?? true,
    });
    this.openForm.set(true);
  }

  async save() {
    const raw = this.form.getRawValue();
    try {
      await this.admin.saveCoupon({
        ...raw,
        value: Number(raw.value),
        minOrder: Number(raw.minOrder),
        maxDiscount: Number(raw.maxDiscount),
        usageLimit: Number(raw.usageLimit),
      }, this.editing() || undefined);
      this.openForm.set(false);
      await this.reload();
      this.toasts.show('Coupon saved');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async archive(coupon: Coupon) {
    if (!coupon.id) return;
    try {
      await this.admin.archiveCoupon(coupon.id);
      await this.reload();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async reload() {
    this.coupons.set(await this.admin.coupons());
  }
}
