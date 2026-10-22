import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Order, UpiPaymentDetails } from '../core/models';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';
import { ORDER_STEPS, STATUS_LABEL } from '../shared/status';
import { UpiPaymentModalComponent } from '../shared/upi-payment-modal.component';
import { OrderProgressBarComponent } from '../shared/order-progress-bar.component';
import { ReceiptUploadComponent } from '../shared/receipt-upload.component';

@Component({
  selector: 'app-order-detail-page',
  imports: [DatePipe, RouterLink, InrPipe, UpiPaymentModalComponent, OrderProgressBarComponent, ReceiptUploadComponent],
  template: `
    <a class="muted" routerLink="/orders">All orders</a>
    @if (loading()) {
      <p class="mt-3">Tracking the bag…</p>
    } @else if (order(); as current) {
      <div class="section-head mb-3">
        <div>
          <h2>{{ current.orderNumber }}</h2>
          <p class="muted mb-0">{{ current.createdAt | date:'d MMM, h:mm a' }}</p>
        </div>
        <span [class]="'status-pill ' + current.status">{{ label(current.status) }}</span>
      </div>

      <!-- Order Tracking Progress Bar Component -->
      <app-order-progress-bar [order]="current" [status]="current.status" class="mb-4" />

      <div class="split">
        <div class="panel">
          <h3 class="mb-3">Items in basket ({{ current.items.length }})</h3>
          @for (item of current.items; track item.productId) {
            <div class="line-item">
              <div class="d-flex gap-3 align-items-center">
                <div class="line-art" [style.background]="item.tint">{{ item.emoji }}</div>
                <div>{{ item.name }}<div class="muted">{{ item.quantity }} × {{ item.unit }}</div></div>
              </div>
              <strong>{{ item.lineTotal | inr }}</strong>
            </div>
          }
        </div>
        <aside class="panel">
          <h3>Drop</h3>
          <p class="mb-1"><strong>{{ current.address.fullName }}</strong></p>
          <p class="muted">{{ current.address.line1 }}<br>{{ current.address.city }} {{ current.address.pincode }}<br>{{ current.address.phone }}</p>
          @if (partnerName(current)) { <p>Rider: {{ partnerName(current) }}</p> }
          <p class="summary-row"><span>Payment</span><span [class]="'status-pill ' + current.paymentStatus">{{ label(current.paymentStatus) }}</span></p>
          <p class="summary-row"><span>Items</span><span>{{ current.subtotal | inr }}</span></p>
          <p class="summary-row"><span>Discount</span><span>− {{ current.discount | inr }}</span></p>
          <p class="summary-row total-row"><span>Total</span><span>{{ current.total | inr }}</span></p>

          @if (current.paymentMethod === 'upi' && current.paymentStatus !== 'paid' && current.status !== 'cancelled') {
            <div class="alert alert-warning py-2 px-3 mt-3 mb-2 rounded-3">
              <div class="d-flex align-items-center gap-2 mb-1">
                <i class="bi bi-clock-history text-warning-emphasis"></i>
                <strong class="small">UPI Payment Pending</strong>
              </div>
              <p class="small mb-2 text-muted">
                Send <b>{{ current.total | inr }}</b> to <b>9101516662&#64;ybl</b> to confirm packaging.
              </p>
              <div class="d-grid gap-2">
                <button class="btn btn-sm btn-success w-100 fw-semibold" type="button" (click)="openUpiPayment(current.id)">
                  <i class="bi bi-wallet2 me-1"></i> Pay with Google Pay / UPI
                </button>
                <button class="btn btn-sm btn-outline-dark w-100" type="button" (click)="switchToCod(current.id)">
                  <i class="bi bi-cash-coin me-1"></i> Switch to Cash on Delivery (COD)
                </button>
              </div>
            </div>
          }

          @if (current.paymentMethod === 'upi' && current.paymentStatus === 'paid') {
            <div class="alert alert-success py-2 px-3 mt-3 mb-2 rounded-3 small">
              <div class="d-flex align-items-center gap-1 mb-1">
                <i class="bi bi-check-circle-fill text-success"></i>
                <strong>Paid via UPI to 9101516662&#64;ybl</strong>
              </div>
              @if (current.gatewayVerification?.verified) {
                <div class="badge bg-success-subtle text-success border border-success-subtle d-inline-block mb-1" style="font-size: 0.68rem;">
                  <i class="bi bi-shield-check me-1"></i> Gateway Callback Verified
                </div>
              }
              @if (current.upiTransactionId) {
                <div class="text-muted" style="font-size: 0.72rem;">Ref: {{ current.upiTransactionId }}</div>
              }
            </div>
          }

          <button class="btn btn-outline-dark w-100 mt-2 d-inline-flex align-items-center justify-content-center gap-1" type="button" (click)="downloadTaxInvoice(current.id)">
            <i class="bi bi-download"></i> Download Tax Invoice (GST)
          </button>

          @if (canCancel(current)) {
            <button class="btn btn-outline-danger w-100 mt-2" type="button" (click)="cancel(current)">Cancel order</button>
          }
        </aside>
      </div>

      <!-- TRANSACTION RECEIPT VERIFICATION SECTION -->
      @if (current.paymentMethod === 'upi' || current.receiptVerification?.receiptImageUrl || current.receiptVerification?.manualUtr) {
        <div class="mt-4 mb-4">
          <app-receipt-upload [order]="current" (receiptVerified)="onReceiptVerified($event)" />
        </div>
      }

      @if (upiDetails(); as upi) {
        <app-upi-payment-modal
          [details]="upi"
          (paymentSuccess)="onUpiSuccess($event)"
          (paymentCancelled)="onUpiModalClosed()"
          (switchedToCod)="onSwitchedToCod($event)"
          (payLater)="onUpiModalClosed()"
        />
      }
    }
  `,
})
export class OrderDetailPage {
  private readonly shop = inject(ShopService);
  private readonly route = inject(ActivatedRoute);
  private readonly toasts = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly steps = ORDER_STEPS;
  readonly upiDetails = signal<UpiPaymentDetails | null>(null);

  constructor() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id') || '';
      this.loading.set(true);
      this.shop.order(id).then((order) => this.order.set(order))
        .catch((error) => this.toasts.error(errorMessage(error)))
        .finally(() => this.loading.set(false));
    });
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

  canCancel(order: Order) {
    return this.auth.user()?.role === 'customer' && (order.status === 'placed' || order.status === 'confirmed');
  }

  async cancel(order: Order) {
    try {
      this.order.set(await this.shop.cancelOrder(order.id));
      this.toasts.show('Order cancelled');
    } catch (error) {
      this.toasts.error(errorMessage(error));
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

