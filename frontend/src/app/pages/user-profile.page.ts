import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { FcmService } from '../core/fcm.service';
import { ThemeService } from '../core/theme.service';
import { Address, Order } from '../core/models';
import { errorMessage } from '../core/http-error';
import { AddressFormComponent } from '../shared/address-form.component';
import { OrderProgressBarComponent } from '../shared/order-progress-bar.component';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';

type ProfileTab = 'orders' | 'addresses' | 'settings';
type OrderFilter = 'all' | 'active' | 'delivered' | 'cancelled';

@Component({
  selector: 'app-user-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    UpperCasePipe,
    DatePipe,
    InrPipe,
    AddressFormComponent,
    OrderProgressBarComponent,
  ],
  templateUrl: './user-profile.page.html',
  styleUrl: './user-profile.page.scss',
})
export class UserProfilePage implements OnInit {
  readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly fcm = inject(FcmService);
  readonly themeService = inject(ThemeService);

  readonly activeTab = signal<ProfileTab>('orders');
  readonly orderFilter = signal<OrderFilter>('all');
  readonly orderSearch = signal<string>('');

  readonly orders = signal<Order[]>([]);
  readonly loadingOrders = signal<boolean>(true);

  readonly addresses = signal<Address[]>([]);
  readonly loadingAddresses = signal<boolean>(true);

  readonly showAddressForm = signal<boolean>(false);
  readonly editingAddress = signal<Address | null>(null);

  readonly savingProfile = signal<boolean>(false);
  readonly reorderingId = signal<string | null>(null);

  readonly profileForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.pattern(/^[6-9]\d{9}$/)]],
  });

  // Filtered Orders Computation
  readonly filteredOrders = computed(() => {
    let list = this.orders();
    const filter = this.orderFilter();
    const search = this.orderSearch().trim().toLowerCase();

    if (filter === 'active') {
      list = list.filter((o) => ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(o.status));
    } else if (filter === 'delivered') {
      list = list.filter((o) => o.status === 'delivered');
    } else if (filter === 'cancelled') {
      list = list.filter((o) => o.status === 'cancelled');
    }

    if (search) {
      list = list.filter((o) =>
        o.orderNumber.toLowerCase().includes(search) ||
        o.items.some((i) => (i.name || '').toLowerCase().includes(search))
      );
    }

    return list;
  });

  readonly activeOrdersCount = computed(() =>
    this.orders().filter((o) => ['placed', 'confirmed', 'packed', 'out_for_delivery'].includes(o.status)).length
  );

  readonly deliveredOrdersCount = computed(() =>
    this.orders().filter((o) => o.status === 'delivered').length
  );

  readonly cancelledOrdersCount = computed(() =>
    this.orders().filter((o) => o.status === 'cancelled').length
  );

  ngOnInit() {
    // 1. Parse query param for default tab (e.g. /profile?tab=addresses)
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab') as ProfileTab;
      if (tab && ['orders', 'addresses', 'settings'].includes(tab)) {
        this.activeTab.set(tab);
      }
    });

    // 2. Initialize profile form with current user data
    const user = this.auth.user();
    if (user) {
      this.resetProfileForm(user);
    }

    // 3. Load Orders and Addresses in parallel
    this.loadOrders();
    this.loadAddresses();
  }

  setTab(tab: ProfileTab) {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  async loadOrders() {
    this.loadingOrders.set(true);
    try {
      const res = await this.shop.orders();
      this.orders.set(res.items || []);
    } catch (err) {
      this.toast.error('Could not load order history: ' + errorMessage(err));
    } finally {
      this.loadingOrders.set(false);
    }
  }

  async loadAddresses() {
    this.loadingAddresses.set(true);
    try {
      const list = await this.shop.loadAddresses();
      this.addresses.set(list || []);
    } catch (err) {
      this.toast.error('Could not load saved addresses: ' + errorMessage(err));
    } finally {
      this.loadingAddresses.set(false);
    }
  }

  resetProfileForm(user: { name: string; phone?: string }) {
    this.profileForm.patchValue({
      name: user.name,
      phone: user.phone || '',
    });
    this.profileForm.markAsPristine();
  }

  async saveProfile() {
    if (this.profileForm.invalid) return;
    this.savingProfile.set(true);
    const { name, phone } = this.profileForm.getRawValue();
    try {
      await this.auth.updateProfile({ name, phone });
      this.profileForm.markAsPristine();
      this.toast.show('Your profile details have been saved.', 'ok');
    } catch (err) {
      this.toast.error('Failed to update profile: ' + errorMessage(err));
    } finally {
      this.savingProfile.set(false);
    }
  }

  openAddAddressForm() {
    this.editingAddress.set(null);
    this.showAddressForm.set(true);
  }

  editAddress(address: Address) {
    this.editingAddress.set(address);
    this.showAddressForm.set(true);
  }

  closeAddressForm() {
    this.showAddressForm.set(false);
    this.editingAddress.set(null);
  }

  async onAddressSaved(saved: Address) {
    this.closeAddressForm();
    await this.loadAddresses();
    this.toast.show(`Address "${saved.label}" saved successfully.`, 'ok');
  }

  async deleteAddress(address: Address) {
    const confirmDelete = window.confirm(`Are you sure you want to delete the "${address.label}" address?`);
    if (!confirmDelete) return;

    try {
      await this.shop.deleteAddress(address.id);
      this.addresses.update((list) => list.filter((a) => a.id !== address.id));
      this.toast.show(`Address "${address.label}" removed.`, 'ok');
    } catch (err) {
      this.toast.error('Could not remove address: ' + errorMessage(err));
    }
  }

  async makeDefaultAddress(address: Address) {
    try {
      await this.shop.saveAddress({ ...address, isDefault: true }, address.id);
      this.addresses.update((list) =>
        list.map((a) => ({ ...a, isDefault: a.id === address.id }))
      );
      this.toast.show(`"${address.label}" set as your default delivery address.`, 'ok');
    } catch (err) {
      this.toast.error('Could not set default address: ' + errorMessage(err));
    }
  }

  async reorderItems(order: Order) {
    this.reorderingId.set(order.id);
    let count = 0;
    try {
      for (const line of order.items) {
        if (line.productId) {
          await this.shop.addItem(line.productId, line.quantity);
          count++;
        }
      }
      this.toast.show(`Added ${count} items from ${order.orderNumber} to your basket!`, 'ok');
      this.router.navigate(['/cart']);
    } catch (err) {
      this.toast.error('Could not repeat order: ' + errorMessage(err));
    } finally {
      this.reorderingId.set(null);
    }
  }

  async requestPushPermission() {
    try {
      await this.fcm.requestPermissionAndRegister();
    } catch (err) {
      this.toast.error('Notification setup: ' + errorMessage(err));
    }
  }

  async logout() {
    await this.auth.logout();
    this.toast.show('You have logged out.', 'ok');
    this.router.navigate(['/']);
  }

  userInitials(name: string): string {
    if (!name) return 'Z';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }

  getStatusLabel(status: string): string {
    return STATUS_LABEL[status] || status;
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'placed':
        return 'bi-hourglass-split';
      case 'confirmed':
        return 'bi-check2-circle';
      case 'packed':
        return 'bi-box-seam';
      case 'out_for_delivery':
        return 'bi-bicycle';
      case 'delivered':
        return 'bi-check-all';
      case 'cancelled':
        return 'bi-x-circle';
      default:
        return 'bi-record-circle';
    }
  }

  addressTypeIcon(label: string): string {
    const l = (label || '').toLowerCase();
    if (l.includes('home')) return 'bi-house-door-fill text-success';
    if (l.includes('work') || l.includes('office')) return 'bi-briefcase-fill text-primary';
    return 'bi-geo-alt-fill text-warning';
  }
}
