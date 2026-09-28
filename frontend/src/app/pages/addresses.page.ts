import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Address } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-addresses-page',
  imports: [ReactiveFormsModule],
  template: `
    <div class="section-head"><h2>Addresses</h2></div>
    <div class="split">
      <div>
        @for (address of addresses(); track address.id) {
          <article class="panel mb-3">
            <div class="d-flex justify-content-between">
              <strong>{{ address.label }} @if (address.isDefault) { <span class="status-pill">Default</span> }</strong>
              <button class="btn btn-link p-0" type="button" (click)="edit(address)">Edit</button>
            </div>
            <p class="mb-1">{{ address.fullName }} · {{ address.phone }}</p>
            <p class="muted mb-2">{{ address.line1 }}, {{ address.city }}, {{ address.state }} {{ address.pincode }}</p>
            <button class="btn btn-sm btn-outline-danger" type="button" (click)="remove(address)">Remove</button>
          </article>
        }
        @if (!addresses().length) { <div class="empty panel"><h2>No address yet</h2><p>Add one so the rider knows which gate.</p></div> }
      </div>
      <form class="panel" [formGroup]="form" (ngSubmit)="save()">
        <h3>{{ editing() ? 'Edit address' : 'New address' }}</h3>
        <div class="mb-2">
          <select class="form-select" formControlName="label">
            <option value="Home">Home</option>
            <option value="Work">Work</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <input class="form-control mb-2" placeholder="Full name" formControlName="fullName" />
        <input class="form-control mb-2" placeholder="Mobile" formControlName="phone" />
        <input class="form-control mb-2" placeholder="Address line" formControlName="line1" />
        <input class="form-control mb-2" placeholder="Landmark" formControlName="landmark" />
        <div class="row g-2">
          <div class="col-6"><input class="form-control" placeholder="City" formControlName="city" /></div>
          <div class="col-6"><input class="form-control" placeholder="State" formControlName="state" /></div>
          <div class="col-6"><input class="form-control" placeholder="Pincode" formControlName="pincode" /></div>
        </div>
        <div class="form-check my-2">
          <input class="form-check-input" type="checkbox" formControlName="isDefault" id="defaultAddress" />
          <label class="form-check-label" for="defaultAddress">Use as default</label>
        </div>
        <button class="btn btn-dark" type="submit" [disabled]="form.invalid">Save</button>
      </form>
    </div>
  `,
})
export class AddressesPage {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly addresses = signal<Address[]>([]);
  readonly editing = signal<string | null>(null);
  readonly form = this.fb.nonNullable.group({
    label: this.fb.nonNullable.control<'Home' | 'Work' | 'Other'>('Home'),
    fullName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    line1: ['', Validators.required],
    landmark: [''],
    city: ['Bengaluru', Validators.required],
    state: ['Karnataka', Validators.required],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    isDefault: false,
  });

  constructor() {
    void this.reload();
  }

  edit(address: Address) {
    this.editing.set(address.id);
    this.form.patchValue(address);
  }

  async save() {
    try {
      const payload = this.form.getRawValue();
      const saved = await this.shop.saveAddress(payload, this.editing() || undefined);
      this.addresses.set(saved);
      this.editing.set(null);
      this.form.reset({ label: 'Home', city: 'Bengaluru', state: 'Karnataka', isDefault: false });
      this.toasts.show('Address saved');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async remove(address: Address) {
    try {
      this.addresses.set(await this.shop.deleteAddress(address.id));
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async reload() {
    try {
      this.addresses.set(await this.shop.loadAddresses());
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }
}
