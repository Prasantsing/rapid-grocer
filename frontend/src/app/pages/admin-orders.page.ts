import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FlatClaim, Order, OrderStatus, User } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { STATUS_LABEL } from '../shared/status';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [DatePipe, InrPipe, FormsModule],
  templateUrl: './admin-orders.page.html',
  styleUrl: './admin-orders.page.scss',
})
export class AdminOrdersPage {
  private readonly admin = inject(AdminService);
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);

  readonly activeTab = signal<'orders' | 'claims' | 'riders'>('orders');
  readonly orders = signal<Order[]>([]);
  readonly partners = signal<User[]>([]);
  readonly claims = signal<FlatClaim[]>([]);
  readonly loading = signal(false);
  readonly loadingClaims = signal(false);
  readonly reviewing = signal(false);

  readonly pendingClaimsCount = computed(() => this.claims().filter((c) => c.status === 'pending').length);
  readonly totalRiderCash = computed(() => this.partners().reduce((sum, p) => sum + (p.cashInHand || 0), 0));

  readonly pickerOrder = signal<Order | null>(null);
  readonly pickerItemsChecked = signal<string[]>([]);
  pickerBagBarcode = '';
  readonly packingInProgress = signal(false);

  readonly settlePartner = signal<User | null>(null);
  settleAmount = 0;
  settleNote = 'End-of-shift COD deposit settled';
  readonly settlingCash = signal(false);

  readonly selectedOrder = signal<Order | null>(null);
  readonly zoomed = signal(false);

  readonly bypassOrder = signal<Order | null>(null);
  bypassReason = '';
  readonly submittingBypass = signal(false);

  status = '';
  receiptFilter = '';
  search = '';
  reviewNote = '';

  readonly statuses: OrderStatus[] = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];

  openAdminBypass(order: Order) {
    this.bypassOrder.set(order);
    this.bypassReason = 'Customer device offline / verbal confirmation';
  }

  async submitAdminBypass() {
    const order = this.bypassOrder();
    if (!order || !this.bypassReason.trim()) return;

    this.submittingBypass.set(true);
    try {
      await this.shop.adminBypassDeliveryOtp(order.id, this.bypassReason.trim());
      this.toasts.show(`Order ${order.orderNumber} successfully marked delivered with admin authorization!`);
      this.bypassOrder.set(null);
      await this.load();
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.submittingBypass.set(false);
    }
  }

  constructor() {
    void this.load();
    void this.refreshPartners();
    void this.loadClaims();
  }

  async refreshPartners() {
    try {
      const page = await this.admin.users({ role: 'delivery' });
      this.partners.set(page.items);
    } catch {
      // silently ignored
    }
  }

  label(status: string) {
    return STATUS_LABEL[status] || status;
  }

  customer(order: Order) {
    return order.user && typeof order.user === 'object' ? order.user.name : 'Customer';
  }

  isAssigned(order: Order, partnerId: string): boolean {
    if (!order.deliveryPartner) return false;
    const current = typeof order.deliveryPartner === 'object' ? order.deliveryPartner.id : order.deliveryPartner;
    return current === partnerId;
  }

  async load() {
    this.loading.set(true);
    try {
      const page = await this.admin.orders({ status: this.status, search: this.search });
      this.orders.set(page.items);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters() {
    // Triggers re-computation of filteredOrders
  }

  filteredOrders(): Order[] {
    let list = this.orders();
    if (this.receiptFilter) {
      list = list.filter((ord) => ord.receiptVerification?.verificationStatus === this.receiptFilter);
    }
    return list;
  }

  async move(order: Order, status: string) {
    try {
      if (status === 'cancelled') await this.shop.cancelOrder(order.id);
      else await this.shop.updateOrderStatus(order.id, status);
      await this.load();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async assign(order: Order, event: Event) {
    const deliveryPartnerId = (event.target as HTMLSelectElement).value;
    if (!deliveryPartnerId) return;
    try {
      await this.admin.assign(order.id, deliveryPartnerId);
      this.toasts.show('Rider assigned');
      await this.load();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  openReceiptReview(order: Order) {
    this.selectedOrder.set(order);
    this.reviewNote = order.receiptVerification?.adminReviewNote || '';
  }

  closeReceiptReview() {
    this.selectedOrder.set(null);
    this.zoomed.set(false);
  }

  toggleZoom() {
    this.zoomed.set(!this.zoomed());
  }

  async submitReview(order: Order, decision: 'approve' | 'reject') {
    this.reviewing.set(true);
    try {
      await this.admin.reviewReceipt(order.id, decision, this.reviewNote);
      this.toasts.show(decision === 'approve' ? 'Receipt approved and order confirmed!' : 'Receipt marked as rejected.');
      this.closeReceiptReview();
      await this.load();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.reviewing.set(false);
    }
  }

  // --- CLAIMS QUEUE & REFUNDS ---
  formatClaimReason(reason: string): string {
    switch (reason) {
      case 'damaged_spoiled': return 'Damaged / Spoiled';
      case 'missing_item': return 'Missing Item';
      case 'expired': return 'Expired Product';
      case 'wrong_item': return 'Wrong Item Delivered';
      case 'poor_quality': return 'Poor Quality';
      default: return reason || 'Other';
    }
  }

  switchToClaims() {
    this.activeTab.set('claims');
    void this.loadClaims();
  }

  switchToClaimsForOrder(orderId: string) {
    this.activeTab.set('claims');
    void this.loadClaims();
  }

  async loadClaims() {
    this.loadingClaims.set(true);
    try {
      const list = await this.shop.listAdminClaims();
      this.claims.set(list);
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.loadingClaims.set(false);
    }
  }

  previewPhoto(url: string) {
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(`<img src="${url}" style="max-width:100%; height:auto; margin:auto; display:block;" />`);
    }
  }

  async resolveClaim(claim: FlatClaim, action: 'approved' | 'rejected') {
    const note = prompt(
      action === 'approved'
        ? `Approve refund of ₹${claim.refundAmount} for ${claim.productName}? Optional note:`
        : `Decline refund for ${claim.productName}? Reason:`,
      action === 'approved' ? 'Approved for instant customer refund' : 'Condition unverified'
    );
    if (note === null) return;
    try {
      await this.shop.resolveClaim(claim.orderId, claim.claimId, { action, adminNote: note });
      this.toasts.show(action === 'approved' ? `Refund of ₹${claim.refundAmount} approved!` : 'Claim declined.');
      await this.loadClaims();
      await this.load();
    } catch (err) {
      this.toasts.error(errorMessage(err));
    }
  }

  // --- DARK STORE PICK & PACK ---
  openPickerChecklist(order: Order) {
    this.pickerOrder.set(order);
    this.pickerItemsChecked.set(order.picking?.itemsChecked || []);
    this.pickerBagBarcode = order.picking?.bagBarcode || `ZB-BAG-${order.orderNumber.replace(/[^0-9]/g, '').slice(-4) || '001'}`;
  }

  togglePickerItem(productId: string) {
    const current = this.pickerItemsChecked();
    if (current.includes(productId)) {
      this.pickerItemsChecked.set(current.filter((id) => id !== productId));
    } else {
      this.pickerItemsChecked.set([...current, productId]);
    }
  }

  isPickerItemChecked(productId: string): boolean {
    return this.pickerItemsChecked().includes(productId);
  }

  checkAllPickerItems() {
    const ord = this.pickerOrder();
    if (!ord) return;
    this.pickerItemsChecked.set(ord.items.map((it) => it.productId));
  }

  isAllPickerItemsChecked(): boolean {
    const ord = this.pickerOrder();
    if (!ord || !ord.items.length) return false;
    const checked = this.pickerItemsChecked();
    return ord.items.every((it) => checked.includes(it.productId));
  }

  async confirmPackOrder() {
    const ord = this.pickerOrder();
    if (!ord) return;
    this.packingInProgress.set(true);
    try {
      await this.shop.packOrder(ord.id, {
        bagBarcode: this.pickerBagBarcode.trim() || undefined,
        itemsChecked: this.pickerItemsChecked(),
      });
      this.toasts.show(`Order #${ord.orderNumber} marked packed & ready!`);
      this.pickerOrder.set(null);
      await this.load();
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.packingInProgress.set(false);
    }
  }

  printThermalBagSlip(order: Order) {
    const slipWin = window.open('', '_blank', 'width=380,height=600');
    if (!slipWin) {
      this.toasts.error('Popup blocked. Allow popups to print thermal slip.');
      return;
    }
    const bagBarcode = order.picking?.bagBarcode || `ZB-BAG-${order.orderNumber.replace(/[^0-9]/g, '').slice(-4) || '001'}`;
    const custName = this.customer(order);
    const dateStr = new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

    const itemsRows = order.items.map((it, idx) => `
      <tr>
        <td style="padding:4px 0; border-bottom:1px dashed #ddd;">${idx + 1}. [ ] ${it.name}</td>
        <td style="text-align:center; padding:4px 0; border-bottom:1px dashed #ddd;">${it.quantity} ${it.unit}</td>
        <td style="text-align:right; padding:4px 0; border-bottom:1px dashed #ddd;">₹${it.price * it.quantity}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Packing Slip #${order.orderNumber}</title>
        <style>
          @page { size: 80mm auto; margin: 4mm; }
          body {
            font-family: 'Courier New', Courier, monospace;
            font-size: 12px;
            color: #000;
            width: 72mm;
            margin: 0 auto;
            padding: 4px;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; margin: 6px 0; }
          .barcode { font-size: 16px; letter-spacing: 4px; padding: 4px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
        </style>
      </head>
      <body>
        <div class="center">
          <div class="bold" style="font-size:16px;">⚡ ZAP BASKET</div>
          <div style="font-size:10px;">Dark Store Packing & Delivery Slip</div>
          <div class="barcode bold">*${bagBarcode}*</div>
          <div>Bag ID: ${bagBarcode}</div>
        </div>
        <div class="divider"></div>
        <div><b>Order:</b> #${order.orderNumber}</div>
        <div><b>Time:</b> ${dateStr}</div>
        <div><b>Pay Mode:</b> ${order.paymentMethod.toUpperCase()} (${order.paymentStatus.toUpperCase()})</div>
        <div class="divider"></div>
        <div><b>Customer:</b> ${custName}</div>
        <div><b>Address:</b> ${order.address.line1}, ${order.address.line2 || ''}</div>
        <div><b>City/PIN:</b> ${order.address.city} - ${order.address.pincode}</div>
        ${order.notes ? `<div style="background:#eee; padding:2px; margin-top:4px;"><b>Note:</b> ${order.notes}</div>` : ''}
        <div class="divider"></div>
        <div class="bold center">CHECKLIST (${order.items.length} ITEMS)</div>
        <div class="divider"></div>
        <table>
          <thead>
            <tr>
              <th style="text-align:left;">Item</th>
              <th style="text-align:center;">Qty</th>
              <th style="text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>
        <div class="divider"></div>
        <div style="display:flex; justify-content:space-between;">
          <span>Subtotal:</span>
          <span>₹${order.subtotal}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Delivery Fee:</span>
          <span>₹${order.deliveryFee}</span>
        </div>
        <div class="divider"></div>
        <div class="bold" style="display:flex; justify-content:space-between; font-size:14px;">
          <span>TOTAL:</span>
          <span>₹${order.total}</span>
        </div>
        <div class="double-divider"></div>
        <div class="center" style="font-size:10px;">
          <div>Packed at: ${order.picking?.packedAt ? new Date(order.picking.packedAt).toLocaleTimeString() : new Date().toLocaleTimeString()}</div>
          <div>Thank you for shopping on ZapBasket!</div>
        </div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    slipWin.document.write(html);
    slipWin.document.close();
  }

  // --- RIDER CASH SETTLEMENT ---
  openSettleModal(partner: User) {
    this.settlePartner.set(partner);
    this.settleAmount = partner.cashInHand || 0;
    this.settleNote = 'End-of-shift COD deposit settled';
  }

  async confirmSettleCash() {
    const partner = this.settlePartner();
    if (!partner || this.settleAmount <= 0) return;
    this.settlingCash.set(true);
    try {
      const res = await this.shop.settleRiderCash(partner.id, {
        amount: this.settleAmount,
        note: this.settleNote,
      });
      this.toasts.show(`Cash settled! Receipt #${res.receiptNumber} issued for ₹${res.settlement.amount}.`);
      this.settlePartner.set(null);
      await this.refreshPartners();
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.settlingCash.set(false);
    }
  }
}
