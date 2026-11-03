import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Order, ReceiptVerification } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { InrPipe } from './inr.pipe';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-receipt-upload',
  standalone: true,
  imports: [FormsModule, InrPipe],
  templateUrl: './receipt-upload.component.html',
  styleUrl: './receipt-upload.component.scss',
})
export class ReceiptUploadComponent {
  @Input({ required: true }) order!: Order;
  @Output() readonly receiptVerified = new EventEmitter<Order>();
  @Output() readonly cancelled = new EventEmitter<void>();

  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);

  readonly scanning = signal(false);
  readonly scanningStep = signal('');
  readonly isDragging = signal(false);
  readonly previewUrl = signal('');
  readonly showManualUtrForm = signal(false);
  readonly submittingUtr = signal(false);
  readonly showSlipModal = signal(false);

  readonly mismatchReason = signal('');
  readonly extractedData = signal<{
    extracted: { amount: number | null; orderId: string; utr: string; payeeVpa: string; appName: string };
    matchDetails: { amountMatched: boolean; orderIdMatched: boolean; vpaMatched: boolean; utrFound: boolean };
  } | null>(null);

  manualUtrInput = '';

  receipt(): ReceiptVerification | null | undefined {
    return this.order?.receiptVerification;
  }

  verificationStatus(): string {
    return this.receipt()?.verificationStatus || 'not_uploaded';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) void this.processFile(file);
  }

  onPaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) {
          void this.processFile(file);
          break;
        }
      }
    }
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) void this.processFile(file);
  }

  resetToUpload() {
    this.previewUrl.set('');
    this.mismatchReason.set('');
    this.extractedData.set(null);
    this.showManualUtrForm.set(false);
    if (this.order?.receiptVerification) {
      this.order.receiptVerification.verificationStatus = 'not_uploaded';
    }
  }

  async processFile(file: File) {
    if (!file.type.startsWith('image/')) {
      this.toasts.error('Please upload an image file (PNG, JPG, or WEBP)');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      this.toasts.error('Screenshot size should be less than 15MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      this.previewUrl.set(base64);
      await this.runAiVerification(base64);
    };
    reader.readAsDataURL(file);
  }

  async runAiVerification(base64Image: string) {
    this.scanning.set(true);
    this.scanningStep.set('Analyzing payment receipt screenshot with Gemini…');

    const stepTimer1 = setTimeout(() => {
      this.scanningStep.set('Reading Payee VPA, UTR reference & Amount…');
    }, 900);

    const stepTimer2 = setTimeout(() => {
      this.scanningStep.set(`Matching with Order #${this.order.orderNumber} (₹${this.order.total})…`);
    }, 1800);

    try {
      const res = await this.shop.verifyReceipt(this.order.id, base64Image);
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      this.scanning.set(false);

      this.extractedData.set({
        extracted: res.extracted,
        matchDetails: res.matchDetails,
      });

      if (res.isMatched) {
        this.order = res.order;
        this.toasts.show('Payment receipt verified successfully! Order queued for review.');
        this.receiptVerified.emit(res.order);
      } else {
        this.order = res.order;
        this.mismatchReason.set(res.matchReason);
        this.toasts.show(res.matchReason);
      }
    } catch (err) {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      this.scanning.set(false);
      this.toasts.error(errorMessage(err));
    }
  }

  async submitManualUtr() {
    const utr = this.manualUtrInput.trim();
    if (!utr || utr.length < 6) {
      this.toasts.error('Please enter a valid UPI reference or UTR (at least 6 digits)');
      return;
    }

    this.submittingUtr.set(true);
    try {
      const res = await this.shop.submitManualUtr(this.order.id, utr);
      this.order = res.order;
      this.submittingUtr.set(false);
      this.showManualUtrForm.set(false);
      this.toasts.show('Manual UTR submitted for admin verification.');
      this.receiptVerified.emit(res.order);
    } catch (err) {
      this.submittingUtr.set(false);
      this.toasts.error(errorMessage(err));
    }
  }
}
