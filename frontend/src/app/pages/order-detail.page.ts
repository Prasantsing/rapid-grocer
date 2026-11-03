import { DatePipe } from '@angular/common';
import { Component, inject, signal, OnDestroy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order, UpiPaymentDetails } from '../core/models';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { FcmService } from '../core/fcm.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { ORDER_STEPS, STATUS_LABEL } from '../shared/status';
import { UpiPaymentModalComponent } from '../shared/upi-payment-modal.component';
import { OrderProgressBarComponent } from '../shared/order-progress-bar.component';
import { ReceiptUploadComponent } from '../shared/receipt-upload.component';
import { OrderTrackingMapComponent } from '../shared/order-tracking-map.component';

@Component({
  selector: 'app-order-detail-page',
  imports: [DatePipe, RouterLink, InrPipe, UpiPaymentModalComponent, OrderProgressBarComponent, ReceiptUploadComponent, OrderTrackingMapComponent],
  templateUrl: './order-detail.page.html',
})
export class OrderDetailPage implements OnDestroy {
  readonly shop = inject(ShopService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly fcm = inject(FcmService);
  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly steps = ORDER_STEPS;
  readonly upiDetails = signal<UpiPaymentDetails | null>(null);
  readonly resendOtpLoading = signal(false);

  async resendOtp(orderId: string) {
    this.resendOtpLoading.set(true);
    try {
      const res = await this.shop.resendDeliveryOtp(orderId);
      this.toasts.show(res.message || 'OTP resent to your mobile number!');
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.resendOtpLoading.set(false);
    }
  }

  readonly pushBannerDismissed = signal(typeof sessionStorage !== 'undefined' && sessionStorage.getItem('zb_dismiss_push_banner') === '1');
  readonly pushBusy = signal(false);

  showPushBanner(): boolean {
    return (
      !this.pushBannerDismissed() &&
      this.fcm.isSupported() &&
      this.fcm.permissionStatus() === 'default'
    );
  }

  async enablePushAlerts() {
    this.pushBusy.set(true);
    try {
      const granted = await this.fcm.requestPermissionAndRegister();
      if (granted) {
        this.toasts.show('Push alerts enabled for your delivery!');
      }
    } finally {
      this.pushBusy.set(false);
    }
  }

  dismissPushBanner() {
    this.pushBannerDismissed.set(true);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('zb_dismiss_push_banner', '1');
    }
  }

  readonly remainingSeconds = signal(0);
  readonly showCancelPrompt = signal(false);
  readonly cancelling = signal(false);
  private timerHandle: any = null;

  readonly selectedStoreRating = signal(5);
  readonly hoverStoreRating = signal(0);
  readonly selectedRiderRating = signal(5);
  readonly hoverRiderRating = signal(0);
  readonly selectedFeedbackTags = signal<string[]>(['⚡ Lightning Fast', '🥬 Fresh Quality']);
  readonly feedbackComments = signal('');
  readonly submittingFeedback = signal(false);
  readonly feedbackTags = [
    '⚡ Lightning Fast',
    '🥬 Fresh Quality',
    '🛵 Polite Rider',
    '📦 Great Packaging',
    '💰 Value for Money',
    '🛡️ Safe & Contactless',
  ];
  readonly selectedTipAmount = signal(30);
  readonly submittingTip = signal(false);

  readonly showClaimModal = signal(false);
  readonly selectedClaimProductId = signal('');
  readonly selectedClaimReason = signal<'damaged_spoiled' | 'missing_item' | 'wrong_item' | 'expired' | 'quality_issue'>('damaged_spoiled');
  readonly claimComments = signal('');
  readonly claimPhoto = signal('');
  readonly submittingClaim = signal(false);

  constructor() {
    void this.shop.loadStoreConfig();
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || '';
      this.loading.set(true);
      this.shop
        .order(id)
        .then((order) => {
          this.order.set(order);
          this.startCountdown(order);
        })
        .catch((error) => this.toasts.error(errorMessage(error)))
        .finally(() => this.loading.set(false));
    });
  }

  ngOnDestroy() {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  startCountdown(order: Order) {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
    const update = () => {
      if (order.status !== 'placed') {
        this.remainingSeconds.set(0);
        return;
      }
      const windowMinutes = this.shop.storeConfig()?.cancellationWindowMinutes ?? 3;
      const windowMs = windowMinutes * 60 * 1000;
      const createdAt = new Date(order.createdAt).getTime();
      const expiresAt = createdAt + windowMs;
      const diff = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      this.remainingSeconds.set(diff);
      if (diff <= 0 && this.timerHandle) {
        clearInterval(this.timerHandle);
        this.timerHandle = null;
      }
    };
    update();
    this.timerHandle = setInterval(update, 1000);
  }

  formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  label(status: string) {
    return STATUS_LABEL[status] || status;
  }

  reached(order: Order, step: string) {
    return ORDER_STEPS.indexOf(order.status) >= ORDER_STEPS.indexOf(step);
  }

  noteFor(order: Order, step: string) {
    return order.timeline.find((entry) => entry.status === step)?.note || '';
  }

  eta(order: Order) {
    return new Date(new Date(order.createdAt).getTime() + 12 * 60 * 1000)
      .toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  }

  partnerName(order: Order) {
    return order.deliveryPartner && typeof order.deliveryPartner === 'object' ? order.deliveryPartner.name : '';
  }

  partnerPhone(order: Order): string {
    return order.deliveryPartner && typeof order.deliveryPartner === 'object' && order.deliveryPartner.phone
      ? order.deliveryPartner.phone
      : '';
  }

  partnerCallLink(order: Order): string {
    const phone = this.partnerPhone(order) || this.shop.storeConfig()?.supportPhone || '+919101516662';
    return `tel:${phone}`;
  }

  partnerWhatsAppLink(order: Order): string {
    const raw = this.partnerPhone(order);
    const digits = raw.replace(/\D/g, '');
    const phone = digits.length === 10 ? `91${digits}` : (digits || '919101516662');
    const name = this.partnerName(order) || 'Rider';
    const text = encodeURIComponent(`Hi ${name}, regarding my ZapBasket order #${order.orderNumber}`);
    return `https://wa.me/${phone}?text=${text}`;
  }

  supportWhatsAppLink(order: Order): string {
    const raw = this.shop.storeConfig()?.supportPhone || '9101516662';
    const digits = raw.replace(/\D/g, '');
    const phone = digits.length === 10 ? `91${digits}` : (digits.length === 12 ? digits : '919101516662');
    const text = encodeURIComponent(`Hi ZapBasket Support, I need assistance with order #${order.orderNumber}`);
    return `https://wa.me/${phone}?text=${text}`;
  }

  shareOrderWhatsAppLink(order: Order): string {
    const text = encodeURIComponent(
      `Track my ZapBasket rapid grocery order #${order.orderNumber} (₹${order.total}): ${window.location.origin}/orders/${order.id}`
    );
    return `https://api.whatsapp.com/send?text=${text}`;
  }

  canCancel(order: Order) {
    if (this.auth.user()?.role !== 'customer') return false;
    if (order.status !== 'placed') return false;
    const config = this.shop.storeConfig();
    if (config && config.allowCustomerCancellation === false) return false;
    return this.remainingSeconds() > 0;
  }

  async cancel(order: Order) {
    this.cancelling.set(true);
    try {
      const updated = await this.shop.cancelOrder(order.id);
      this.order.set(updated);
      this.showCancelPrompt.set(false);
      this.remainingSeconds.set(0);
      if (this.timerHandle) {
        clearInterval(this.timerHandle);
        this.timerHandle = null;
      }
      this.toasts.show('Order cancelled successfully. Any online payment will be refunded.');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.cancelling.set(false);
    }
  }

  async openUpiPayment(orderId: string) {
    try {
      const details = await this.shop.getUpiDetails(orderId);
      this.upiDetails.set(details);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  onUpiSuccess(updatedOrder: Order) {
    this.order.set(updatedOrder);
    this.upiDetails.set(null);
    this.toasts.show('Payment confirmed!');
  }

  onUpiModalClosed() {
    this.upiDetails.set(null);
    const id = this.order()?.id;
    if (id) {
      void this.shop.order(id).then((ord) => this.order.set(ord));
    }
  }

  onSwitchedToCod(updatedOrder: Order) {
    this.order.set(updatedOrder);
    this.upiDetails.set(null);
    this.toasts.show('Order switched to Cash on Delivery!');
  }

  async switchToCod(orderId: string) {
    try {
      const updated = await this.shop.switchToCod(orderId);
      this.order.set(updated);
      this.toasts.show('Order switched to Cash on Delivery!');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  onReceiptVerified(updatedOrder: Order) {
    this.order.set(updatedOrder);
  }

  ratingStoreLabel(rating: number): string {
    switch (rating) {
      case 5: return 'Excellent 🌟';
      case 4: return 'Very Good 👍';
      case 3: return 'Average 👌';
      case 2: return 'Below Average 😕';
      case 1: return 'Poor 👎';
      default: return 'Select rating';
    }
  }

  ratingRiderLabel(rating: number): string {
    switch (rating) {
      case 5: return 'Polite & Super Fast 🚀';
      case 4: return 'Good Behavior 😊';
      case 3: return 'Satisfactory 👍';
      case 2: return 'Could be better 😐';
      case 1: return 'Needs improvement 👎';
      default: return 'Select rating';
    }
  }

  isTagSelected(tag: string): boolean {
    return this.selectedFeedbackTags().includes(tag);
  }

  toggleFeedbackTag(tag: string): void {
    const current = this.selectedFeedbackTags();
    if (current.includes(tag)) {
      this.selectedFeedbackTags.set(current.filter((t) => t !== tag));
    } else {
      this.selectedFeedbackTags.set([...current, tag]);
    }
  }

  async submitFeedback(orderId: string): Promise<void> {
    if (this.selectedStoreRating() === 0) return;
    this.submittingFeedback.set(true);
    try {
      const updated = await this.shop.submitOrderFeedback(orderId, {
        storeRating: this.selectedStoreRating(),
        riderRating: this.selectedRiderRating() || undefined,
        deliveryTags: this.selectedFeedbackTags(),
        comments: this.feedbackComments().trim() || undefined,
      });
      this.order.set(updated);
      this.toasts.show('Thank you for rating ZapBasket & your delivery rider! ⭐');
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.submittingFeedback.set(false);
    }
  }

  setTipAmount(amt: number): void {
    this.selectedTipAmount.set(Math.max(1, amt || 0));
  }

  tipUpiDeepLink(order: Order): string {
    const amt = this.selectedTipAmount() || 30;
    return `upi://pay?pa=9101516662@ybl&pn=ZapBasket&am=${amt}&tn=Tip%20for%20order%20${order.orderNumber}`;
  }

  async recordTip(orderId: string, manualPrompt = false): Promise<void> {
    const amt = this.selectedTipAmount() || 30;
    this.submittingTip.set(true);
    try {
      const updated = await this.shop.submitOrderTip(orderId, {
        amount: amt,
        upiTransactionId: `TIP-${Date.now()}`,
      });
      this.order.set(updated);
      this.toasts.show(`₹${amt} tip sent to your delivery rider! Thank you! 💚`);
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.submittingTip.set(false);
    }
  }

  formatClaimReason(reason: string): string {
    switch (reason) {
      case 'damaged_spoiled': return 'Damaged / Spoiled Produce 🥬';
      case 'missing_item': return 'Missing in Delivery Bag 📦';
      case 'expired': return 'Expired / Close to Expiry ⏳';
      case 'wrong_item': return 'Wrong Item / Variant ❌';
      case 'quality_issue': return 'Quality Defect 😕';
      default: return reason;
    }
  }

  openClaimModal(): void {
    const ord = this.order();
    if (ord?.items?.length) {
      this.selectedClaimProductId.set(ord.items[0].productId);
    }
    this.claimComments.set('');
    this.claimPhoto.set('');
    this.showClaimModal.set(true);
  }

  getClaimSelectedLine(ord: Order) {
    const pid = this.selectedClaimProductId();
    return ord.items.find((it) => it.productId === pid);
  }

  onClaimPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        this.claimPhoto.set((e.target?.result as string) || '');
      };
      reader.readAsDataURL(file);
    }
  }

  async submitItemClaim(orderId: string): Promise<void> {
    const pid = this.selectedClaimProductId();
    if (!pid) return;
    this.submittingClaim.set(true);
    try {
      const updated = await this.shop.submitItemClaim(orderId, {
        productId: pid,
        reason: this.selectedClaimReason(),
        comments: this.claimComments().trim() || undefined,
        photoUrl: this.claimPhoto() || undefined,
      });
      this.order.set(updated);
      this.showClaimModal.set(false);
      this.toasts.show('Item claim submitted! Our store manager will review and refund promptly.');
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.submittingClaim.set(false);
    }
  }

  async downloadTaxInvoice(orderId: string) {
    try {
      this.toasts.show('Preparing official GST tax invoice…');
      const data = await this.shop.getOrderInvoice(orderId);
      const inv = data.invoice;
      const s = data.store;
      if (!inv || !s) {
        throw new Error('Invoice data not available');
      }

      const fmtInr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      const itemsHtml = (inv.items || []).map((it: any) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #e2e8f0;">${it.name}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${it.hsn || '0802'}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${it.quantity} ${it.unit}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(it.price)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(it.taxable)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(it.cgst + it.sgst)} (${it.gstRate}%)</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${fmtInr(it.total)}</td>
        </tr>
      `).join('');

      const invoiceDoc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Tax Invoice - ${inv.invoiceNumber}</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
    .bill-card { max-width: 800px; margin: 0 auto; background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header-row { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
    .info-grid { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: left; font-size: 11px; text-transform: uppercase; }
    .totals-box { width: 280px; margin-left: auto; font-size: 13px; margin-bottom: 20px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #e2e8f0; }
    .signature-row { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 12px; color: #64748b; }
    @media print {
      body { background: #fff; padding: 0; }
      .bill-card { border: none; box-shadow: none; padding: 0; width: 100%; }
    }
  </style>
</head>
<body>
  <div class="bill-card">
    <div class="header-row">
      <div>
        <h2 style="margin: 0; font-size: 24px; font-weight: 800; color: #0f172a;">${s.businessName}</h2>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Trade Name: ${s.tradeName} | CIN: ${s.cin}</div>
        <div style="font-size: 12px; color: #64748b;">${s.address}</div>
        <div style="font-size: 12px; color: #64748b;">FSSAI Lic: ${s.fssaiLicense}</div>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; background: #0f172a; color: #fff; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 4px;">TAX INVOICE</span>
        <div style="font-size: 14px; font-weight: bold; font-family: monospace; margin-top: 8px;">${inv.invoiceNumber}</div>
        <div style="font-size: 12px; color: #64748b;">GSTIN: <strong style="color: #0f172a;">${s.gstin}</strong></div>
        <div style="font-size: 12px; color: #64748b;">Date: ${new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</div>
      </div>
    </div>

    <div class="info-grid">
      <div style="width: 48%;">
        <strong style="display: block; font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Billed To / Delivery Customer:</strong>
        <div style="font-weight: bold; font-size: 14px;">${inv.customer?.name || 'Retail Customer'}</div>
        <div>${inv.customer?.address?.line1 || ''}</div>
        <div>${inv.customer?.address?.city || ''} ${inv.customer?.address?.pincode || ''}</div>
        <div>Phone: ${inv.customer?.phone || ''}</div>
      </div>
      <div style="width: 48%; text-align: right;">
        <strong style="display: block; font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Order & Payment Details:</strong>
        <div>Order Number: <strong>#${inv.orderNumber}</strong></div>
        <div>Payment Method: <span style="text-transform: uppercase;">${inv.payment?.method || 'UPI'}</span> (${inv.payment?.status || 'PAID'})</div>
        ${inv.payment?.transactionId ? `<div>Ref / UTR: <span style="font-family: monospace;">${inv.payment.transactionId}</span></div>` : ''}
        <div>State / Place of Supply: <strong>${s.state} (Code: ${s.stateCode})</strong></div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th>HSN</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Rate (₹)</th>
          <th style="text-align: right;">Taxable (₹)</th>
          <th style="text-align: right;">GST Rate</th>
          <th style="text-align: right;">Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals-box">
      <div class="totals-row">
        <span>Taxable Amount:</span>
        <span style="font-family: monospace;">${fmtInr(inv.subtotal)}</span>
      </div>
      <div class="totals-row">
        <span>CGST (Central Tax):</span>
        <span style="font-family: monospace; color: #047857;">${fmtInr(inv.cgst)}</span>
      </div>
      <div class="totals-row">
        <span>SGST (State Tax):</span>
        <span style="font-family: monospace; color: #047857;">${fmtInr(inv.sgst)}</span>
      </div>
      <div class="totals-row">
        <span>Total Tax (GST):</span>
        <span style="font-family: monospace; font-weight: bold; color: #047857;">${fmtInr(inv.totalGst)}</span>
      </div>
      ${inv.discount ? `
      <div class="totals-row" style="color: #dc2626;">
        <span>Coupon Discount:</span>
        <span style="font-family: monospace;">- ${fmtInr(inv.discount)}</span>
      </div>` : ''}
      <div class="totals-row" style="font-size: 15px; font-weight: bold; border-top: 2px solid #0f172a; padding-top: 8px; margin-top: 4px;">
        <span>Grand Total:</span>
        <span style="font-family: monospace; color: #0f172a;">${fmtInr(inv.total)}</span>
      </div>
    </div>

    <div class="signature-row">
      <div>
        <div style="font-weight: 600; color: #0f172a;">Authorized Signatory</div>
        <div style="font-size: 11px;">For ${s.businessName}</div>
      </div>
      <div style="text-align: right; font-size: 11px;">
        <div>This is a computer generated invoice under GST Law.</div>
        <div>Thank you for ordering with ${s.tradeName}!</div>
      </div>
    </div>
  </div>
</body>
</html>`;

      const blob = new Blob([invoiceDoc], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice_${inv.invoiceNumber}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.toasts.show('📥 GST Tax Invoice downloaded successfully');
    } catch (err) {
      this.toasts.error(errorMessage(err) || 'Failed to download invoice');
    }
  }
}

