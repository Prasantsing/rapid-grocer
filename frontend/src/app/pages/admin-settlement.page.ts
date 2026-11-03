import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { StoreConfig } from '../core/models';
import { InrPipe } from '../shared/inr.pipe';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-admin-settlement',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, InrPipe],
  templateUrl: './admin-settlement.page.html',
  styleUrl: './admin-settlement.page.scss',
})
export class AdminSettlementPage implements OnInit {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);

  readonly config = signal<StoreConfig | null>(null);
  readonly isLoading = signal(false);
  readonly isSaving = signal(false);

  testAmount = 1;

  formData = {
    upiVpa: '9101516662@ybl',
    payeeName: 'ZapBasket',
    webhookSecret: 'zb_webhook_secret_live',
  };

  readonly previewUpiUri = computed(() => {
    const vpa = (this.formData.upiVpa || '9101516662@ybl').trim();
    const name = (this.formData.payeeName || 'ZapBasket').trim();
    const amt = Number(this.testAmount || 1).toFixed(2);
    return `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${amt}&cu=INR&tn=ZapBasket%20Test%20Settlement`;
  });

  readonly previewQrUrl = computed(() => {
    const uri = this.previewUpiUri();
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${encodeURIComponent(uri)}`;
  });

  ngOnInit() {
    void this.loadConfig();
  }

  async loadConfig() {
    this.isLoading.set(true);
    try {
      const data = await this.shop.getAdminStoreConfig();
      this.config.set(data);
      this.formData = {
        upiVpa: data.upiVpa || '9101516662@ybl',
        payeeName: data.payeeName || 'ZapBasket',
        webhookSecret: data.webhookSecret || 'zb_webhook_secret_live',
      };
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Could not load settlement configuration'));
    } finally {
      this.isLoading.set(false);
    }
  }

  isValidVpa(vpa: string): boolean {
    return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test((vpa || '').trim());
  }

  getPspLabel(vpa?: string): string {
    const handle = (vpa || '').toLowerCase().trim();
    if (handle.endsWith('@ybl') || handle.endsWith('@ibl') || handle.endsWith('@axl')) return 'PhonePe / Yes Bank';
    if (handle.endsWith('@okaxis')) return 'Google Pay (Axis Bank)';
    if (handle.endsWith('@okhdfcbank')) return 'Google Pay (HDFC Bank)';
    if (handle.endsWith('@okicici')) return 'Google Pay (ICICI Bank)';
    if (handle.endsWith('@oksbi')) return 'Google Pay (State Bank of India)';
    if (handle.endsWith('@paytm')) return 'Paytm Payments Bank';
    if (handle.endsWith('@upi')) return 'BHIM / NPCI Official';
    if (handle.endsWith('@apl')) return 'Amazon Pay';
    return 'UPI Bank Provider';
  }

  setTestAmount(amt: number) {
    this.testAmount = amt;
  }

  applyVpaPreset(vpa: string, payeeName: string) {
    this.formData.upiVpa = vpa;
    this.formData.payeeName = payeeName;
    this.toasts.show(`Applied preset: ${vpa}`);
  }

  resetToDefaults() {
    this.formData.upiVpa = '9101516662@ybl';
    this.formData.payeeName = 'ZapBasket';
    this.formData.webhookSecret = 'zb_webhook_secret_live';
    this.toasts.show('Reset to default ZapBasket receiving account');
  }

  async saveConfig() {
    const vpa = (this.formData.upiVpa || '').trim();
    if (!this.isValidVpa(vpa)) {
      this.toasts.error('Please enter a valid Merchant UPI VPA (e.g. yourname@bank)');
      return;
    }

    if (!this.formData.payeeName?.trim()) {
      this.toasts.error('Please enter the merchant business display name');
      return;
    }

    this.isSaving.set(true);
    try {
      const updated = await this.shop.updateStoreConfig({
        upiVpa: vpa,
        payeeName: this.formData.payeeName.trim(),
        webhookSecret: this.formData.webhookSecret?.trim() || 'zb_webhook_secret_live',
      });
      this.config.set(updated);
      this.toasts.show('Merchant receiving account updated successfully!');
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Failed to update receiving account'));
    } finally {
      this.isSaving.set(false);
    }
  }

  copyToClipboard(text: string, label: string) {
    if (!text) return;
    void navigator.clipboard?.writeText(text);
    this.toasts.show(`${label} copied to clipboard!`);
  }
}
