import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { GstInvoiceLedgerEntry, GstReportData, GstSlabSummary, StoreGstProfile } from '../core/models';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-admin-gst-billing-page',
  imports: [CommonModule, FormsModule, InrPipe],
  templateUrl: './admin-gst-billing.page.html',
})
export class AdminGstBillingPage {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);

  readonly report = signal<GstReportData | null>(null);
  readonly store = signal<StoreGstProfile | null>(null);
  readonly loading = signal(false);

  readonly selectedPeriod = signal<string>('this_month');
  customFrom = '';
  customTo = '';
  readonly todayDate = new Date();

  readonly activeInvoice = signal<GstInvoiceLedgerEntry | null>(null);

  constructor() {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const today = now.toISOString().split('T')[0];
    this.customFrom = firstDay;
    this.customTo = today;

    void this.load();
  }

  async load() {
    this.loading.set(true);
    try {
      const query: { period?: string; from?: string; to?: string } = {
        period: this.selectedPeriod(),
      };
      if (this.selectedPeriod() === 'custom') {
        query.from = this.customFrom;
        query.to = this.customTo;
      }
      const data = await this.admin.gstReport(query);
      this.report.set(data);
      this.store.set(data.store);
    } catch (err) {
      this.toasts.error(errorMessage(err) || 'Failed to generate GST statement');
    } finally {
      this.loading.set(false);
    }
  }

  setPeriod(period: string) {
    this.selectedPeriod.set(period);
    void this.load();
  }

  printStatement() {
    window.print();
  }

  viewInvoiceModal(inv: GstInvoiceLedgerEntry) {
    this.activeInvoice.set(inv);
  }

  closeInvoiceModal() {
    this.activeInvoice.set(null);
  }

  /**
   * Generates and downloads a complete standalone, styled GST Statement Bill document
   */
  downloadStatement() {
    const r = this.report();
    const s = this.store();
    if (!r || !s) {
      this.toasts.error('Statement data is still loading');
      return;
    }

    const fmtInr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const slabsHtml = r.slabs.map((slab) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;"><strong>${slab.rate}%</strong><br/><small style="color: #64748b;">${slab.label}</small></td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${slab.hsn}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${slab.itemsCount}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(slab.taxableValue)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(slab.cgst)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(slab.sgst)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold; color: #047857;">${fmtInr(slab.totalTax)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${fmtInr(slab.gross)}</td>
      </tr>
    `).join('');

    const invoicesHtml = r.invoices.map((inv) => `
      <tr>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-weight: bold;">${inv.invoiceNumber}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 12px;">${new Date(inv.createdAt).toLocaleDateString('en-IN')}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0;">${inv.customerName}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: center;">${inv.paymentMethod}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(inv.taxableAmount)}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #64748b;">${fmtInr(inv.cgstAmount)}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #64748b;">${fmtInr(inv.sgstAmount)}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold; color: #047857;">${fmtInr(inv.totalGst)}</td>
        <td style="padding: 6px 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${fmtInr(inv.grossAmount)}</td>
      </tr>
    `).join('');

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GST Tax Statement - ${s.businessName} - ${this.selectedPeriod()}</title>
  <style>
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { margin: 0; padding: 24px; color: #0f172a; background: #f8fafc; }
    .doc-card { max-width: 960px; margin: 0 auto; background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 24px; }
    .badge { display: inline-block; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #0f172a; color: #ffffff; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .kpi-box { padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
    .kpi-box span { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .kpi-box strong { font-size: 20px; font-family: monospace; }
    .tax-highlight { background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 13px; }
    th { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; text-align: left; font-size: 11px; text-transform: uppercase; }
    .signature-row { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 32px; font-size: 12px; }
    @media print {
      body { background: #fff; padding: 0; }
      .doc-card { border: none; box-shadow: none; padding: 0; width: 100%; max-width: 100%; }
      .print-btn { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="doc-card">
    <div style="text-align: right; margin-bottom: 12px;" class="print-btn">
      <button onclick="window.print()" style="padding: 6px 14px; background: #0e6b4f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        🖨️ Print / Save as PDF
      </button>
    </div>

    <div class="header-row">
      <div>
        <h2 style="margin: 0 0 4px 0;">${s.businessName}</h2>
        <div style="color: #64748b; font-size: 13px; margin-bottom: 4px;">Trade Name: <strong>${s.tradeName}</strong> · CIN: ${s.cin}</div>
        <div style="font-size: 12px; margin-bottom: 4px;">${s.address}</div>
        <div style="font-size: 12px; color: #64748b;">Email: ${s.email} | Phone: ${s.phone} | FSSAI: ${s.fssaiLicense}</div>
      </div>
      <div style="text-align: right; font-size: 12px;">
        <span class="badge">OFFICIAL GST STATEMENT</span>
        <div style="margin-top: 8px; font-family: monospace;">
          <div><strong>GSTIN:</strong> ${s.gstin}</div>
          <div><strong>State:</strong> ${s.state} (Code: ${s.stateCode})</div>
          <div><strong>Period:</strong> ${new Date(r.period.startDate).toLocaleDateString('en-IN')} to ${new Date(r.period.endDate).toLocaleDateString('en-IN')}</div>
          <div><strong>Generated:</strong> ${new Date().toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-box">
        <span>GROSS BUSINESS TURNOVER</span>
        <strong style="color: #0f172a;">${fmtInr(r.summary.totalGrossTurnover)}</strong>
        <small style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">${r.summary.totalOrders} total orders</small>
      </div>
      <div class="kpi-box">
        <span>TAXABLE VALUE (PRE-TAX)</span>
        <strong style="color: #0284c7;">${fmtInr(r.summary.totalTaxableValue)}</strong>
        <small style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">Net retail revenue</small>
      </div>
      <div class="kpi-box">
        <span>CGST (CENTRAL TAX)</span>
        <strong style="color: #059669;">${fmtInr(r.summary.totalCgst)}</strong>
        <small style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">50% Central share</small>
      </div>
      <div class="kpi-box">
        <span>SGST (STATE TAX)</span>
        <strong style="color: #059669;">${fmtInr(r.summary.totalSgst)}</strong>
        <small style="display: block; font-size: 11px; color: #64748b; margin-top: 4px;">50% State share</small>
      </div>
    </div>

    <div class="tax-highlight">
      <div>
        <h4 style="margin: 0; color: #065f46;">Total GST Liability (CGST + SGST)</h4>
        <small style="color: #047857;">Collected for Government remission under GST Rules 2017</small>
      </div>
      <div style="font-size: 26px; font-weight: bold; font-family: monospace; color: #065f46;">
        ${fmtInr(r.summary.totalGstCollected)}
      </div>
    </div>

    <h4 style="margin: 0 0 8px 0;">1. HSN / GST Rate Slab Summary</h4>
    <table>
      <thead>
        <tr>
          <th>GST Rate</th>
          <th>HSN Codes</th>
          <th style="text-align: center;">Units</th>
          <th style="text-align: right;">Taxable Amount</th>
          <th style="text-align: right;">CGST (₹)</th>
          <th style="text-align: right;">SGST (₹)</th>
          <th style="text-align: right;">Total Tax (₹)</th>
          <th style="text-align: right;">Gross (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${slabsHtml}
      </tbody>
      <tfoot style="background: #f1f5f9; font-weight: bold;">
        <tr>
          <td colspan="3" style="padding: 8px; border: 1px solid #e2e8f0;">TOTALS</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(r.summary.totalTaxableValue)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(r.summary.totalCgst)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(r.summary.totalSgst)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(r.summary.totalGstCollected)}</td>
          <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(r.summary.totalGrossTurnover)}</td>
        </tr>
      </tfoot>
    </table>

    <h4 style="margin: 0 0 8px 0;">2. Order-by-Order Retail Tax Ledger (${r.invoices.length} Invoices)</h4>
    <table>
      <thead>
        <tr>
          <th>Invoice No.</th>
          <th>Date</th>
          <th>Customer (B2C)</th>
          <th style="text-align: center;">Payment</th>
          <th style="text-align: right;">Taxable</th>
          <th style="text-align: right;">CGST</th>
          <th style="text-align: right;">SGST</th>
          <th style="text-align: right;">GST Total</th>
          <th style="text-align: right;">Bill Total</th>
        </tr>
      </thead>
      <tbody>
        ${invoicesHtml}
      </tbody>
    </table>

    <div class="signature-row">
      <div style="max-width: 65%; color: #64748b;">
        <p style="margin: 0 0 4px 0;"><strong>Declaration:</strong> We declare that this statement shows the actual price of the goods described and that all particulars are true and correct under Indian GST Rules.</p>
        <p style="margin: 0;">Whether tax is payable on reverse charge basis: <strong>No</strong></p>
      </div>
      <div style="text-align: right;">
        <div style="height: 48px;"></div>
        <div style="border-top: 1px solid #0f172a; padding-top: 4px; font-weight: bold;">
          For ${s.businessName}<br/>
          <span style="font-weight: normal; color: #64748b;">Authorized Signatory</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ZapBasket_GST_Statement_${this.selectedPeriod()}_${Date.now()}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toasts.show('📥 GST Statement Bill downloaded successfully');
  }

  /**
   * Generates and downloads an individual customer tax invoice bill
   */
  downloadInvoice(targetInv?: GstInvoiceLedgerEntry | null) {
    const inv = targetInv || this.activeInvoice();
    const s = this.store();
    if (!inv || !s) {
      this.toasts.error('No invoice selected to download');
      return;
    }

    const fmtInr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const itemsHtml = (inv.items || []).map((it) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #e2e8f0;">${it.name}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; font-family: monospace;">${it.hsn}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: center;">${it.quantity} ${it.unit}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(it.rate)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">${fmtInr(it.taxableAmount)}</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; color: #047857;">${fmtInr(it.totalGst)} (${it.gstRate}%)</td>
        <td style="padding: 8px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace; font-weight: bold;">${fmtInr(it.grossAmount)}</td>
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
      .print-btn { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="bill-card">
    <div style="text-align: right; margin-bottom: 12px;" class="print-btn">
      <button onclick="window.print()" style="padding: 6px 14px; background: #0e6b4f; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">
        🖨️ Print / Save as PDF
      </button>
    </div>

    <div class="header-row">
      <div>
        <h2 style="margin: 0 0 4px 0;">${s.businessName}</h2>
        <div style="font-size: 12px; color: #64748b;">${s.address}</div>
        <div style="font-size: 12px; color: #64748b;">Email: ${s.email} | Phone: ${s.phone} | FSSAI: ${s.fssaiLicense}</div>
      </div>
      <div style="text-align: right;">
        <span style="display: inline-block; padding: 4px 8px; font-size: 11px; font-weight: 700; border-radius: 6px; background: #0f172a; color: #ffffff;">RETAIL TAX INVOICE</span>
        <div style="margin-top: 6px; font-family: monospace; font-size: 12px;">
          <div><strong>Invoice No:</strong> ${inv.invoiceNumber}</div>
          <div><strong>Order Ref:</strong> ${inv.orderNumber}</div>
          <div><strong>Date:</strong> ${new Date(inv.createdAt).toLocaleString('en-IN')}</div>
          <div><strong>GSTIN:</strong> ${s.gstin}</div>
        </div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <strong>Billed To (Customer):</strong>
        <div>${inv.customerName}</div>
        <div>Phone: ${inv.customerPhone || 'N/A'}</div>
        <div>Delivery Destination: ${inv.customerCity}</div>
        <div>State Code: ${s.stateCode} (${s.state})</div>
      </div>
      <div style="text-align: right;">
        <strong>Payment Information:</strong>
        <div>Method: <strong>${inv.paymentMethod}</strong></div>
        <div>Status: <span style="color: #047857; font-weight: bold;">${inv.paymentStatus.toUpperCase()}</span></div>
        <div>Place of Supply: ${s.state}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item Description</th>
          <th>HSN</th>
          <th style="text-align: center;">Qty</th>
          <th style="text-align: right;">Unit Rate</th>
          <th style="text-align: right;">Taxable Amount</th>
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
        <span>Taxable Subtotal:</span>
        <span style="font-family: monospace;">${fmtInr(inv.taxableAmount)}</span>
      </div>
      <div class="totals-row">
        <span>CGST (Central Tax):</span>
        <span style="font-family: monospace; color: #047857;">${fmtInr(inv.cgstAmount)}</span>
      </div>
      <div class="totals-row">
        <span>SGST (State Tax):</span>
        <span style="font-family: monospace; color: #047857;">${fmtInr(inv.sgstAmount)}</span>
      </div>
      <div class="totals-row" style="font-size: 15px; font-weight: bold; padding-top: 6px; border-top: 2px solid #0f172a;">
        <span>Invoice Total:</span>
        <span style="font-family: monospace;">${fmtInr(inv.grossAmount)}</span>
      </div>
    </div>

    <div class="signature-row">
      <div style="max-width: 65%;">
        <p style="margin: 0 0 4px 0;"><strong>Declaration:</strong> This invoice shows the actual price of the goods described under the Goods and Services Tax Act.</p>
        <p style="margin: 0;">Supply is meant for retail consumption.</p>
      </div>
      <div style="text-align: right; font-weight: bold; color: #0f172a;">
        <div style="height: 40px;"></div>
        <div style="border-top: 1px solid #0f172a; padding-top: 4px;">
          For ${s.businessName}<br/>
          <span style="font-weight: normal; color: #64748b;">Authorized Signatory</span>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([invoiceDoc], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ZapBasket_Tax_Invoice_${inv.orderNumber}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    this.toasts.show(`📥 Downloaded Invoice Bill for ${inv.orderNumber}`);
  }

  exportCsv() {
    const r = this.report();
    if (!r || !r.invoices || r.invoices.length === 0) {
      this.toasts.error('No invoice data available to export');
      return;
    }

    const headers = ['Invoice Number', 'Order Number', 'Date', 'Customer Name', 'Phone', 'City', 'Payment Method', 'Taxable Value', 'CGST', 'SGST', 'Total GST', 'Gross Total'];
    const rows = r.invoices.map((inv) => [
      inv.invoiceNumber,
      inv.orderNumber,
      new Date(inv.createdAt).toISOString(),
      `"${inv.customerName}"`,
      inv.customerPhone,
      inv.customerCity,
      inv.paymentMethod,
      inv.taxableAmount,
      inv.cgstAmount,
      inv.sgstAmount,
      inv.totalGst,
      inv.grossAmount,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `ZapBasket_GST_Report_${this.selectedPeriod()}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toasts.show('CSV Report exported');
  }
}
