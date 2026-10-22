import { Component, computed, inject, signal } from '@angular/core';
import { Address } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { AddressFormComponent } from '../shared/address-form.component';

@Component({
  selector: 'app-addresses-page',
  standalone: true,
  imports: [AddressFormComponent],
  template: `
    <div class="section-head">
      <div>
        <h2>Saved Addresses</h2>
        <p class="muted mb-0">Delivery locations for fast 12-minute orders</p>
      </div>
      @if (editingId()) {
        <button class="btn btn-outline-dark btn-sm" (click)="resetForm()">
          <i class="bi bi-plus-lg me-1"></i> Add New Address
        </button>
      }
    </div>
    <div class="split">
      <div>
        @for (address of addresses(); track address.id) {
          <article class="panel mb-3" [class.border-success]="editingId() === address.id">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <div class="d-flex align-items-center gap-2">
                <strong>{{ address.label }}</strong>
                @if (address.isDefault) {
                  <span class="badge bg-success" style="font-size: 0.68rem;">DEFAULT</span>
                }
              </div>
              <button class="btn btn-sm btn-link p-0 text-success fw-semibold" type="button" (click)="edit(address)">
                <i class="bi bi-pencil-square me-1"></i>Edit
              </button>
            </div>
            <p class="mb-1 fw-semibold">{{ address.fullName }} · {{ address.phone }}</p>
            <p class="muted mb-2">{{ address.line1 }}, {{ address.city }}, {{ address.state }} {{ address.pincode }}</p>
            <div class="d-flex justify-content-between align-items-center">
              <button class="btn btn-sm btn-outline-danger" type="button" (click)="remove(address)">Remove</button>
              @if (!address.isDefault) {
                <button class="btn btn-sm btn-link text-muted p-0" type="button" (click)="makeDefault(address)">Make default</button>
              }
            </div>
          </article>
        }
        @if (!addresses().length) {
          <div class="empty panel">
            <h2>No address yet</h2>
            <p>Add your first delivery address using GPS or manual details.</p>
          </div>
        }
      </div>
      <div class="panel">
        <h3 class="mb-3">{{ editingId() ? 'Edit Address' : 'Add New Address' }}</h3>
        <app-address-form
          [initialAddress]="editingAddress()"
          (saved)="onAddressSaved($event)"
          (cancelled)="resetForm()"
        />
      </div>
    </div>
  `,
})
export class AddressesPage {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  readonly addresses = signal<Address[]>([]);
  readonly editingId = signal<string | null>(null);

  readonly editingAddress = computed(() => {
    const id = this.editingId();
    if (!id) return null;
    return this.addresses().find((a) => a.id === id) || null;
  });

  constructor() {
    void this.reload();
  }

  edit(address: Address) {
    this.editingId.set(address.id);
  }

  resetForm() {
    this.editingId.set(null);
  }

  onAddressSaved(_address: Address) {
    this.editingId.set(null);
    void this.reload();
  }

  async makeDefault(address: Address) {
    try {
      const saved = await this.shop.saveAddress({ ...address, isDefault: true }, address.id);
      this.addresses.set(saved);
      this.toasts.show(`${address.label} set as default address`);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async remove(address: Address) {
    if (!confirm(`Delete ${address.label} address?`)) return;
    try {
      this.addresses.set(await this.shop.deleteAddress(address.id));
      if (this.editingId() === address.id) this.editingId.set(null);
      this.toasts.show('Address removed');
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
