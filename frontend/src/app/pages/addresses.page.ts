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
  templateUrl: './addresses.page.html',
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
