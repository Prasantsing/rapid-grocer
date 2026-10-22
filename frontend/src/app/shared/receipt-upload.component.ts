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
  template: `
    <div class="receipt-verify-card">
      <!-- HEADER -->
      <div class="receipt-header d-flex justify-content-between align-items-center mb-3">
        <div>
          <div class="d-flex align-items-center gap-2">
            <h4 class="h6 fw-bold mb-0 text-dark">
              <i class="bi bi-file-earmark-check me-1 text-primary"></i>
              Payment Receipt Verification
            </h4>
            @if (verificationStatus() === 'verified') {
              <span class="badge bg-success-subtle text-success border border-success-subtle">
                <i class="bi bi-check-circle-fill me-1"></i> Auto-Verified
              </span>
            } @else if (verificationStatus() === 'manual_utr_submitted') {
              <span class="badge bg-info-subtle text-info-emphasis border border-info-subtle">
                <i class="bi bi-clock-history me-1"></i> UTR Submitted
              </span>
            } @else if (verificationStatus() === 'mismatched') {
              <span class="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                <i class="bi bi-exclamation-triangle-fill me-1"></i> Mismatch Alert
              </span>
            } @else if (verificationStatus() === 'admin_approved') {
              <span class="badge bg-success text-white">
                <i class="bi bi-shield-fill-check me-1"></i> Store Approved
              </span>
            }
          </div>
          <p class="text-muted small mb-0 mt-1">
            Upload your UPI/bank transaction screenshot to automatically verify Order <b>#{{ order.orderNumber }}</b> ({{ order.total | inr }}).
          </p>
        </div>
      </div>

      <!-- STATE 1: SCANNING / OCR IN PROGRESS -->
      @if (scanning()) {
        <div class="scanning-stage text-center p-4 border rounded-3 bg-light">
          <div class="scanner-preview mb-3 position-relative d-inline-block">
            @if (previewUrl()) {
              <img [src]="previewUrl()" alt="Receipt preview" class="scanner-img rounded border" />
              <div class="scan-laser"></div>
            } @else {
              <div class="scanner-placeholder rounded border bg-white d-flex align-items-center justify-content-center">
                <i class="bi bi-file-earmark-image fs-1 text-muted"></i>
              </div>
              <div class="scan-laser"></div>
            }
          </div>
          <h5 class="h6 fw-bold text-dark mb-1">Scanning Receipt with AI…</h5>
          <p class="text-muted small mb-3">{{ scanningStep() }}</p>
          <div class="progress" style="height: 6px; max-width: 280px; margin: 0 auto;">
            <div class="progress-bar progress-bar-striped progress-bar-animated bg-primary w-100"></div>
          </div>
        </div>
      }

      <!-- STATE 2: AUTO-VERIFIED MATCH STATE -->
      @else if (verificationStatus() === 'verified' || verificationStatus() === 'admin_approved') {
        <div class="verified-stage p-3 border rounded-3 bg-white shadow-sm">
          <div class="d-flex align-items-center justify-content-between pb-2 mb-2 border-bottom">
            <div class="d-flex align-items-center gap-2">
              <div class="check-circle-icon bg-success text-white rounded-circle d-flex align-items-center justify-content-center">
                <i class="bi bi-check-lg"></i>
              </div>
              <div>
                <strong class="text-success small d-block">Receipt Matched & Verified</strong>
                <span class="text-muted" style="font-size: 0.76rem;">
                  Order reference and amount matched automatically. Order is pending store review for dispatch.
                </span>
              </div>
            </div>
            @if (receipt()?.receiptImageUrl) {
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                (click)="showSlipModal.set(true)"
                title="View uploaded slip"
              >
                <i class="bi bi-zoom-in me-1"></i> View Slip
              </button>
            }
          </div>

          <!-- COMPARISON TELEMETRY TABLE -->
          <div class="match-telemetry p-2 rounded-2 bg-light mb-3">
            <div class="row g-2 text-start small">
              <div class="col-6">
                <div class="text-muted" style="font-size: 0.72rem;">ORDER TOTAL:</div>
                <div class="fw-bold">{{ order.total | inr }}</div>
              </div>
              <div class="col-6">
                <div class="text-muted" style="font-size: 0.72rem;">PAID AMOUNT:</div>
                <div class="fw-bold text-success">
                  {{ (receipt()?.extractedAmount ?? order.total) | inr }}
                  <i class="bi bi-check-circle-fill text-success ms-1"></i>
                </div>
              </div>
              <div class="col-6">
                <div class="text-muted" style="font-size: 0.72rem;">ORDER REFERENCE:</div>
                <div class="fw-bold">#{{ order.orderNumber }}</div>
              </div>
              <div class="col-6">
                <div class="text-muted" style="font-size: 0.72rem;">EXTRACTED UTR:</div>
                <div class="font-monospace text-dark">
                  {{ receipt()?.extractedUtr || order.upiTransactionId || 'Verified' }}
                </div>
              </div>
              @if (receipt()?.appName) {
                <div class="col-12 border-top pt-1 text-muted" style="font-size: 0.72rem;">
                  Payment App: <span class="fw-semibold text-dark">{{ receipt()?.appName }}</span>
                  · Recipient: <span class="font-monospace text-dark">{{ receipt()?.extractedPayeeVpa || '9101516662@ybl' }}</span>
                </div>
              }
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center">
            <span class="text-muted small">
              <i class="bi bi-shield-check text-success me-1"></i>
              Payment verified · Store review in progress
            </span>
            <button
              type="button"
              class="btn btn-link text-muted btn-sm p-0 text-decoration-none"
              (click)="resetToUpload()"
            >
              <i class="bi bi-arrow-repeat me-1"></i> Re-upload receipt
            </button>
          </div>
        </div>
      }

      <!-- STATE 3: MANUAL UTR SUBMITTED -->
      @else if (verificationStatus() === 'manual_utr_submitted') {
        <div class="manual-utr-stage p-3 border rounded-3 bg-white shadow-sm">
          <div class="d-flex align-items-center gap-2 mb-2">
            <div class="check-circle-icon bg-info text-white rounded-circle d-flex align-items-center justify-content-center">
              <i class="bi bi-hash"></i>
            </div>
            <div>
              <strong class="text-dark small d-block">Manual UTR Submitted</strong>
              <span class="text-muted" style="font-size: 0.76rem;">
                Reference <b>{{ receipt()?.manualUtr || order.upiTransactionId }}</b> submitted for admin verification.
              </span>
            </div>
          </div>

          <div class="alert alert-info py-2 px-3 small mb-3">
            Our store administrator will cross-reference this bank reference with the merchant UPI account and confirm your order shortly.
          </div>

          <div class="d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-outline-dark btn-sm" (click)="resetToUpload()">
              <i class="bi bi-upload me-1"></i> Upload Receipt Screenshot
            </button>
          </div>
        </div>
      }

      <!-- STATE 4: MISMATCH OR BLURRY ERROR ALERT WITH RE-UPLOAD OR MANUAL UTR -->
      @else if (verificationStatus() === 'mismatched') {
        <div class="mismatch-stage p-3 border border-warning rounded-3 bg-warning-subtle mb-3">
          <div class="d-flex align-items-start gap-2 mb-2">
            <i class="bi bi-exclamation-triangle-fill text-warning-emphasis fs-5 flex-shrink-0 mt-1"></i>
            <div>
              <strong class="text-warning-emphasis small d-block">Automatic Verification Issue</strong>
              <p class="small text-dark mb-1">
                {{ mismatchReason() || 'We could not automatically verify the Order ID or amount on this screenshot.' }}
              </p>
            </div>
          </div>

          @if (extractedData()) {
            <div class="p-2 rounded bg-white border mb-3 small">
              <div class="d-flex justify-content-between mb-1">
                <span class="text-muted">Expected Amount:</span>
                <span class="fw-bold">{{ order.total | inr }}</span>
              </div>
              <div class="d-flex justify-content-between mb-1">
                <span class="text-muted">Extracted from Slip:</span>
                <span class="fw-bold" [class.text-danger]="!extractedData()?.matchDetails?.amountMatched" [class.text-success]="extractedData()?.matchDetails?.amountMatched">
                  {{ extractedData()?.extracted?.amount !== null ? (extractedData()?.extracted?.amount | inr) : 'Not detected' }}
                </span>
              </div>
              @if (extractedData()?.extracted?.utr) {
                <div class="d-flex justify-content-between">
                  <span class="text-muted">Extracted UTR:</span>
                  <span class="font-monospace">{{ extractedData()?.extracted?.utr }}</span>
                </div>
              }
            </div>
          }

          <!-- ACTIONS: RE-UPLOAD OR MANUAL UTR -->
          <div class="d-flex gap-2 flex-wrap">
            <button type="button" class="btn btn-sm btn-dark" (click)="resetToUpload()">
              <i class="bi bi-arrow-repeat me-1"></i> Upload Clearer Screenshot
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-dark"
              (click)="showManualUtrForm.set(!showManualUtrForm())"
            >
              <i class="bi bi-keyboard me-1"></i> Enter 12-Digit UTR Manually
            </button>
          </div>

          @if (showManualUtrForm()) {
            <div class="p-3 bg-white rounded border mt-3">
              <label class="form-label small fw-bold mb-1">12-Digit Bank Reference / UTR Number</label>
              <div class="input-group input-group-sm mb-2">
                <input
                  type="text"
                  class="form-control font-monospace"
                  placeholder="e.g. 412389123456"
                  [(ngModel)]="manualUtrInput"
                  maxlength="24"
                />
                <button
                  type="button"
                  class="btn btn-success"
                  [disabled]="submittingUtr() || !manualUtrInput.trim()"
                  (click)="submitManualUtr()"
                >
                  @if (submittingUtr()) {
                    <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                    <span>Submitting…</span>
                  } @else {
                    <span>Submit UTR</span>
                  }
                </button>
              </div>
              <div class="form-text" style="font-size: 0.72rem;">
                Found in Google Pay, PhonePe, or Paytm payment details under "UPI Transaction ID" or "Bank Ref No".
              </div>
            </div>
          }
        </div>
      }

      <!-- STATE 5: DEFAULT UPLOAD DROPZONE -->
      @if (verificationStatus() === 'not_uploaded' || (!scanning() && verificationStatus() !== 'verified' && verificationStatus() !== 'manual_utr_submitted' && verificationStatus() !== 'admin_approved' && !previewUrl())) {
        <div
          class="dropzone-box p-4 text-center border border-2 border-dashed rounded-3"
          [class.dragover]="isDragging()"
          (dragover)="onDragOver($event)"
          (dragleave)="onDragLeave($event)"
          (drop)="onDrop($event)"
          (paste)="onPaste($event)"
          tabindex="0"
        >
          <input
            type="file"
            #fileInput
            class="d-none"
            accept="image/png, image/jpeg, image/jpg, image/webp"
            (change)="onFileSelected($event)"
          />

          <div class="mb-2">
            <div class="upload-icon-wrap d-inline-flex align-items-center justify-content-center rounded-circle bg-light mb-2">
              <i class="bi bi-cloud-arrow-up text-primary fs-3"></i>
            </div>
            <h5 class="h6 fw-bold mb-1">Drag & Drop transaction screenshot</h5>
            <p class="text-muted small mb-2">
              Supports Google Pay, PhonePe, Paytm, CRED, BHIM & bank slips (PNG, JPG, WEBP)
            </p>
          </div>

          <div class="d-flex justify-content-center gap-2 flex-wrap mb-2">
            <button
              type="button"
              class="btn btn-dark btn-sm px-3"
              (click)="fileInput.click()"
            >
              <i class="bi bi-image me-1"></i> Select from device
            </button>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm px-3"
              (click)="showManualUtrForm.set(!showManualUtrForm())"
            >
              <i class="bi bi-keyboard me-1"></i> Enter UTR directly
            </button>
          </div>

          <div class="text-muted" style="font-size: 0.72rem;">
            Tip: You can also paste directly here with <b>Ctrl+V</b> / <b>Cmd+V</b>
          </div>
        </div>

        @if (showManualUtrForm()) {
          <div class="p-3 bg-light rounded border mt-3">
            <label class="form-label small fw-bold mb-1">Enter 12-Digit UTR / Bank Reference Number</label>
            <div class="input-group input-group-sm mb-1">
              <input
                type="text"
                class="form-control font-monospace"
                placeholder="e.g. 412389123456"
                [(ngModel)]="manualUtrInput"
                maxlength="24"
              />
              <button
                type="button"
                class="btn btn-success"
                [disabled]="submittingUtr() || !manualUtrInput.trim()"
                (click)="submitManualUtr()"
              >
                @if (submittingUtr()) {
                  <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                  <span>Submitting…</span>
                } @else {
                  <span>Submit for Review</span>
                }
              </button>
            </div>
            <div class="form-text" style="font-size: 0.72rem;">
              We will match the UTR with incoming transactions in our merchant UPI register.
            </div>
          </div>
        }
      }
    </div>

    <!-- FULLSCREEN ZOOM MODAL FOR UPLOADED RECEIPT SLIP -->
    @if (showSlipModal()) {
      <div class="slip-modal-backdrop" (click)="showSlipModal.set(false)">
        <div class="slip-modal-content" (click)="$event.stopPropagation()">
          <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
            <h5 class="h6 fw-bold mb-0">Uploaded Payment Receipt</h5>
            <button type="button" class="btn-close" (click)="showSlipModal.set(false)"></button>
          </div>
          <div class="p-3 text-center bg-dark" style="max-height: 75vh; overflow: auto;">
            <img
              [src]="receipt()?.receiptImageUrl || previewUrl()"
              alt="Payment receipt full"
              class="img-fluid rounded"
              style="max-height: 70vh;"
            />
          </div>
          <div class="p-3 bg-light d-flex justify-content-between align-items-center">
            <div class="small text-muted">
              Order #{{ order.orderNumber }} · {{ order.total | inr }}
            </div>
            <button type="button" class="btn btn-sm btn-dark" (click)="showSlipModal.set(false)">Close</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .receipt-verify-card {
      border: 1px solid var(--line, #e2e8f0);
      background: #ffffff;
      border-radius: 16px;
      padding: 1.25rem;
    }
    .check-circle-icon {
      width: 28px;
      height: 28px;
      font-size: 0.95rem;
      flex-shrink: 0;
    }
    .dropzone-box {
      border-color: #cbd5e1 !important;
      background: #f8fafc;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .dropzone-box:hover, .dropzone-box.dragover {
      background: #f1f5f9;
      border-color: #0f172a !important;
    }
    .upload-icon-wrap {
      width: 52px;
      height: 52px;
    }
    .scanner-preview {
      width: 140px;
      height: 140px;
      overflow: hidden;
    }
    .scanner-img, .scanner-placeholder {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .scan-laser {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, rgba(37,99,235,0) 0%, rgba(37,99,235,1) 50%, rgba(37,99,235,0) 100%);
      box-shadow: 0 0 10px #2563eb, 0 0 18px #3b82f6;
      animation: laserScan 1.6s ease-in-out infinite alternate;
    }
    @keyframes laserScan {
      0% { top: 0%; }
      100% { top: 96%; }
    }
    .slip-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      z-index: 2500;
      display: grid;
      place-items: center;
      padding: 1rem;
    }
    .slip-modal-content {
      background: #ffffff;
      border-radius: 16px;
      max-width: 520px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
    }
  `],
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
