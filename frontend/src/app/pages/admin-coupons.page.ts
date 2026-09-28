import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Coupon } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-admin-coupons',
  imports: [ReactiveFormsModule],
  template: `
    <div class="section-head">
      <h2>Coupons</h2>
      <button class="btn btn-dark" type="button" (click)="open()">New coupon</button>
    </div>
    <div class="panel">
      @for (coupon of coupons(); track coupon.id) {
        <div class="line-item">
          <div>
            <strong>{{ coupon.code }}</strong>
            <div class="muted">{{ coupon.description }} · used {{ coupon.usedCount || 0 }}{{ coupon.usageLimit ? ' / ' + coupon.usageLimit : '' }}</div>
          </div>
          <div>
            <span class="status-pill" [class.cancelled]="!coupon.isActive">{{ coupon.isActive ? 'Active' : 'Off' }}</span>
            <button class="btn btn-sm btn-outline-dark ms-2" type="button" (click)="open(coupon)">Edit</button>
            <button class="btn btn-sm btn-outline-danger ms-1" type="button" (click)="archive(coupon)">Disable</button>
          </div>
        </div>
      }
    </div>
    @if (openForm()) {
      <div class="modal-sheet" (click)="openForm.set(false)">
        <form class="sheet" [formGroup]="form" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <h3>{{ editing() ? 'Edit coupon' : 'New coupon' }}</h3>
          <div class="row g-2">
            <div class="col-md-4"><input class="form-control" placeholder="CODE" formControlName="code" /></div>
            <div class="col-md-4">
              <select class="form-select" formControlName="type"><option value="flat">Flat ₹</option><option value="percent">Percent</option></select>
            </div>
            <div class="col-md-4"><input class="form-control" type="number" placeholder="Value" formControlName="value" /></div>
            <div class="col-12"><input class="form-control" placeholder="Description" formControlName="description" /></div>
            <div class="col-md-4"><input class="form-control" type="number" placeholder="Min order" formControlName="minOrder" /></div>
            <div class="col-md-4"><input class="form-control" type="number" placeholder="Max discount" formControlName="maxDiscount" /></div>
            <div class="col-md-4"><input class="form-control" type="number" placeholder="Usage limit" formControlName="usageLimit" /></div>
          </div>
          <div class="form-check my-2">
            <input class="form-check-input" type="checkbox" id="couponOn" formControlName="isActive" />
            <label class="form-check-label" for="couponOn">Active</label>
          </div>
          <button class="btn btn-dark" [disabled]="form.invalid" type="submit">Save</button>
        </form>
      </div>
    }
  `,
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
    type: 'flat' as 'flat' | 'percent',
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
