import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Order, UpiPaymentDetails, UpiStatusResponse } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from './inr.pipe';

@Component({
  selector: 'app-upi-payment-modal',
  standalone: true,
  imports: [InrPipe],
  template: `
    <div class="upi-overlay" (click)="onBackdropClick($event)">
      <div class="upi-dialog" role="dialog" aria-modal="true" aria-labelledby="upi-dialog-title">
        <!-- Close button (top right) -->
        @if (status() !== 'success' && !showCancelPrompt()) {
          <button type="button" class="close-btn" (click)="requestClose()" aria-label="Close UPI payment">
            <i class="bi bi-x-lg"></i>
          </button>
        }

        <!-- SUCCESS STATE -->
        @if (status() === 'success') {
          <div class="payment-success-card">
            <div class="success-icon-wrap">
              <i class="bi bi-check2-circle"></i>
            </div>
            <h2 id="upi-dialog-title" class="success-title">Order Confirmed!</h2>
            <p class="success-amount">{{ details.amount | inr }}</p>
            <div class="badge bg-success-subtle text-success border border-success-subtle px-3 py-1 mb-2">
              <i class="bi bi-shield-fill-check me-1"></i> Gateway Callback Verified
            </div>
            <p class="success-msg">
              The payment gateway confirmed receipt at <b>{{ details.upiId }}</b>.
              Order status has been updated to <b>Confirmed</b>!
            </p>
            <div class="order-chip mb-3">
              <span>Order #<b>{{ details.orderNumber }}</b></span>
              @if (gatewayRef()) {
                <span class="ms-2 text-muted">· Ref: {{ gatewayRef() }}</span>
              }
            </div>

            <div class="receipt-prompt-banner p-3 rounded-3 bg-light border mb-3 text-start">
              <div class="d-flex align-items-center gap-2 mb-1">
                <i class="bi bi-file-earmark-arrow-up text-primary fs-5"></i>
                <strong class="small text-dark">Upload Transaction Receipt</strong>
              </div>
              <p class="small text-muted mb-2" style="font-size: 0.78rem;">
                Upload your payment screenshot now. AI OCR will extract Order #{{ details.orderNumber }} and ₹{{ details.amount }} for instant automated verification.
              </p>
              <button
                type="button"
                class="btn btn-primary btn-sm w-100 fw-bold py-2"
                (click)="navigateToOrderToUploadReceipt()"
              >
                <i class="bi bi-cloud-arrow-up-fill me-1"></i> Upload Payment Receipt Now
              </button>
            </div>

            <div class="d-flex justify-content-between align-items-center">
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                (click)="navigateToOrderToUploadReceipt()"
              >
                Go to Order Tracking
              </button>
              <span class="text-muted small" style="font-size: 0.74rem;">
                <span class="spinner-border spinner-border-sm text-success me-1" role="status"></span>
                Redirecting in {{ redirectCountdown() }}s…
              </span>
            </div>
          </div>
        }

        <!-- CANCEL / INCOMPLETE CONFIRMATION PROMPT -->
        @if (showCancelPrompt() && status() !== 'success') {
          <div class="cancel-prompt-card p-4">
            <div class="text-center mb-3">
              <div class="warning-icon-wrap mb-2">
                <i class="bi bi-exclamation-triangle-fill text-warning fs-1"></i>
              </div>
              <h3 class="h5 fw-bold mb-1">Payment Not Completed</h3>
              <p class="text-muted small mb-0">
                You haven't confirmed your payment of <b>{{ details.amount | inr }}</b> to <b>{{ details.upiId }}</b>.
                How would you like to proceed?
              </p>
            </div>

            <div class="d-grid gap-2">
              <!-- Primary: Continue Payment -->
              <button
                type="button"
                class="btn btn-dark py-2 fw-semibold"
                (click)="showCancelPrompt.set(false)"
              >
                <i class="bi bi-arrow-left me-1"></i> Continue UPI Payment
              </button>

              <!-- Option 1: Cancel order and restore items to cart -->
              <button
                type="button"
                class="btn btn-outline-danger py-2"
                [disabled]="isActionLoading()"
                (click)="cancelAndRestoreCart()"
              >
                @if (isActionLoading()) {
                  <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                  <span>Restoring cart…</span>
                } @else {
                  <i class="bi bi-cart-x me-1"></i> Cancel Order & Keep Items in Basket
                }
              </button>

              <!-- Option 2: Switch to Cash on Delivery -->
              <button
                type="button"
                class="btn btn-outline-success py-2"
                [disabled]="isActionLoading()"
                (click)="switchToCod()"
              >
                @if (isActionLoading()) {
                  <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                  <span>Switching…</span>
                } @else {
                  <i class="bi bi-cash-coin me-1"></i> Switch to Cash on Delivery (COD)
                }
              </button>

              <!-- Option 3: Leave as unpaid order -->
              <button
                type="button"
                class="btn btn-link text-muted btn-sm mt-1"
                [disabled]="isActionLoading()"
                (click)="leaveAsUnpaidOrder()"
              >
                Pay later from My Orders
              </button>
            </div>
          </div>
        }

        <!-- AWAITING GATEWAY CALLBACK / VERIFICATION STATE -->
        @if (status() === 'awaiting_gateway' && !showCancelPrompt()) {
          <div class="awaiting-gateway-card p-4 text-center">
            <div class="radar-ping-wrap mb-3">
              <div class="radar-circle circle-1"></div>
              <div class="radar-circle circle-2"></div>
              <div class="radar-circle circle-3"></div>
              <div class="radar-center">
                <i class="bi bi-broadcast text-success fs-3"></i>
              </div>
            </div>

            <h3 class="h5 fw-bold mb-1">Awaiting Gateway Verification</h3>
            <p class="text-muted small mb-2">
              Payment was submitted. The server is waiting for an API callback ping from the payment gateway to verify transaction status before updating order status to <b>Confirmed</b>.
            </p>

            <div class="status-summary-box p-3 rounded-3 mb-3 bg-light text-start">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small text-muted">Order Status:</span>
                <span class="badge bg-secondary text-uppercase" style="font-size: 0.7rem;">Placed (Unconfirmed)</span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small text-muted">Amount:</span>
                <span class="fw-bold text-dark">{{ details.amount | inr }}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-1">
                <span class="small text-muted">Payee VPA:</span>
                <span class="font-monospace small text-success">{{ details.upiId }}</span>
              </div>
              @if (utr()) {
                <div class="d-flex justify-content-between align-items-center">
                  <span class="small text-muted">Submitted UTR:</span>
                  <span class="font-monospace small">{{ utr() }}</span>
                </div>
              }
            </div>

            <!-- Server-Side Verification Action / Simulate Callback -->
            <div class="d-grid gap-2 mb-3">
              <button
                type="button"
                class="btn btn-success py-2 fw-bold pulse-btn"
                [disabled]="isVerifying()"
                (click)="triggerGatewayPing()"
              >
                @if (isVerifying()) {
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  <span>Verifying with Gateway…</span>
                } @else {
                  <i class="bi bi-lightning-charge-fill me-1 text-warning"></i>
                  <span>Ping Gateway Callback & Verify</span>
                }
              </button>

              <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                (click)="status.set('idle')"
                [disabled]="isVerifying()"
              >
                <i class="bi bi-arrow-counterclockwise me-1"></i> Edit UTR or Change UPI App
              </button>

              <button
                type="button"
                class="btn btn-outline-dark btn-sm"
                (click)="navigateToOrderToUploadReceipt()"
              >
                <i class="bi bi-file-earmark-arrow-up me-1 text-primary"></i> Upload Transaction Receipt & Verify
              </button>
            </div>

            <div class="d-flex align-items-center justify-content-center gap-2 text-muted small">
              <span class="spinner-grow spinner-grow-sm text-success" role="status"></span>
              <span>Listening for payment gateway callback ping…</span>
            </div>
          </div>
        }

        <!-- MAIN PAYMENT WORKFLOW (IDLE) -->
        @if (status() === 'idle' && !showCancelPrompt()) {
          <div class="upi-body">
            <!-- Header -->
            <div class="upi-header">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <span class="upi-badge">
                  <i class="bi bi-shield-check me-1"></i> Gateway-Verified UPI
                </span>
                <span class="badge bg-light text-dark border">Order #{{ details.orderNumber }}</span>
              </div>
              <h2 id="upi-dialog-title" class="upi-title">Pay {{ details.amount | inr }}</h2>
              <p class="upi-subtitle">Scan QR or open UPI app, then wait for gateway verification</p>
            </div>

            <!-- Return from App Banner (if user returned from Google Pay / PhonePe) -->
            @if (openedApp()) {
              <div class="return-app-banner mb-3 p-3 rounded-3">
                <div class="d-flex align-items-center gap-2 mb-1">
                  <span class="pulse-dot"></span>
                  <strong class="small text-success">Switched back from {{ openedApp() }}?</strong>
                </div>
                <p class="small text-muted mb-2">
                  Submit transaction for server-side gateway verification:
                </p>
                <button
                  type="button"
                  class="btn btn-sm btn-success w-100 fw-bold"
                  [disabled]="isVerifying()"
                  (click)="submitPaymentForVerification()"
                >
                  <i class="bi bi-check-circle-fill me-1"></i> I Paid in {{ openedApp() }} (Verify Now)
                </button>
              </div>
            }

            <!-- Error Banner -->
            @if (errorText()) {
              <div class="alert alert-danger py-2 px-3 d-flex align-items-center gap-2 mb-3">
                <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
                <div class="small flex-grow-1">{{ errorText() }}</div>
                <button type="button" class="btn-close btn-close-sm" (click)="errorText.set('')" aria-label="Dismiss"></button>
              </div>
            }

            <!-- Payee VPA / UPI ID Card -->
            <div class="vpa-card mb-3">
              <div class="vpa-info">
                <span class="vpa-label">Payee UPI ID</span>
                <span class="vpa-id" title="Recipient UPI ID">{{ details.upiId }}</span>
                <small class="vpa-name">Recipient: {{ details.payeeName }}</small>
              </div>
              <button
                type="button"
                class="copy-vpa-btn"
                [class.copied]="copied()"
                (click)="copyUpiId()"
                title="Copy UPI ID to clipboard"
              >
                <i class="bi" [class.bi-clipboard]="!copied()" [class.bi-check2]="copied()"></i>
                <span>{{ copied() ? 'Copied' : 'Copy' }}</span>
              </button>
            </div>

            <!-- STEP 1: PAYMENT METHOD SELECTION -->
            <div class="step-card mb-3">
              <div class="step-tag">STEP 1: OPEN UPI APP OR SCAN</div>

              <!-- UPI Apps Direct Pay Buttons -->
              <div class="upi-apps-grid mb-3">
                <!-- Google Pay -->
                <a
                  [href]="details.gpayUri"
                  (click)="onAppClicked('Google Pay')"
                  class="app-btn gpay-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="app-icon gpay-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                      <path d="M12 24c6.6 0 12-5.4 12-12S18.6 0 12 0 0 5.4 0 12s5.4 12 12 12z" fill="#fff"/>
                      <path d="M17.6 12.3c0-.4 0-.8-.1-1.2H12v2.3h3.2c-.1.8-.6 1.5-1.3 1.9v1.6h2.1c1.2-1.1 1.8-2.7 1.8-4.6z" fill="#4285F4"/>
                      <path d="M12 18c1.6 0 3-.5 4-1.5l-2.1-1.6c-.5.4-1.2.6-1.9.6-1.5 0-2.8-1-3.2-2.4H6.6v1.7C7.6 16.8 9.6 18 12 18z" fill="#34A853"/>
                      <path d="M8.8 13.1c-.2-.6-.2-1.3 0-1.9V9.5H6.6c-.7 1.4-.7 3.1 0 4.5l2.2-.9z" fill="#FBBC05"/>
                      <path d="M12 7.8c.9 0 1.7.3 2.3.9l1.7-1.7C15 6 13.6 5.4 12 5.4c-2.4 0-4.4 1.2-5.4 3.1l2.2 1.7c.4-1.4 1.7-2.4 3.2-2.4z" fill="#EA4335"/>
                    </svg>
                  </span>
                  <span class="app-name">Google Pay</span>
                </a>

                <!-- PhonePe -->
                <a
                  [href]="details.phonepeUri"
                  (click)="onAppClicked('PhonePe')"
                  class="app-btn phonepe-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="app-icon phonepe-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                      <circle cx="12" cy="12" r="12" fill="#5f259f"/>
                      <path d="M15.5 8.5H12c-.3 0-.5.2-.5.5v1.2h3.5c.3 0 .5.2.5.5s-.2.5-.5.5H11.5v3.8c0 .3-.2.5-.5.5s-.5-.2-.5-.5v-6c0-.8.7-1.5 1.5-1.5h3.5c.3 0 .5.2.5.5s-.2.5-.5.5z" fill="#fff"/>
                    </svg>
                  </span>
                  <span class="app-name">PhonePe</span>
                </a>

                <!-- Paytm -->
                <a
                  [href]="details.paytmUri"
                  (click)="onAppClicked('Paytm')"
                  class="app-btn paytm-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="app-icon paytm-icon">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                      <rect width="24" height="24" rx="6" fill="#002e6e"/>
                      <text x="12" y="15" fill="#00b9f5" font-size="7" font-weight="bold" text-anchor="middle" font-family="sans-serif">paytm</text>
                    </svg>
                  </span>
                  <span class="app-name">Paytm</span>
                </a>

                <!-- Other / Generic UPI -->
                <a
                  [href]="details.genericUri"
                  (click)="onAppClicked('UPI App')"
                  class="app-btn other-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="app-icon upi-icon">
                    <i class="bi bi-wallet2"></i>
                  </span>
                  <span class="app-name">Any UPI</span>
                </a>
              </div>

              <!-- QR Code Section -->
              <div class="qr-container">
                <div class="qr-box">
                  <img
                    [src]="qrImageUrl()"
                    (error)="onQrImageError()"
                    alt="Scan QR code to pay using Google Pay or any UPI app"
                    class="qr-code-img"
                    width="160"
                    height="160"
                  />
                  <div class="qr-overlay-brand">
                    <span>9101516662&#64;ybl</span>
                  </div>
                </div>
                <p class="qr-caption mt-2">
                  <i class="bi bi-camera me-1"></i>
                  Scan with Google Pay, PhonePe, Paytm, BHIM, or any banking app
                </p>
              </div>
            </div>

            <!-- STEP 2: GATEWAY VERIFICATION PANEL -->
            <div class="step-card highlight-step mb-3">
              <div class="step-tag highlight-tag">STEP 2: GATEWAY VERIFICATION CHECK</div>

              <div class="mb-2">
                <label for="utr-input" class="form-label small fw-semibold mb-1">
                  UPI Ref / UTR Number (from payment receipt):
                </label>
                <input
                  id="utr-input"
                  type="text"
                  class="form-control form-control-sm font-monospace"
                  [value]="utr()"
                  (input)="utr.set(asValue($event))"
                  placeholder="e.g. 428901234567 (12 digits)"
                  maxlength="40"
                />
                <div class="form-text small text-muted">
                  Gateway verifies this reference with the bank before confirming the order.
                </div>
              </div>

              <!-- Primary Submit Button -->
              <button
                type="button"
                class="btn btn-success w-100 confirm-pay-btn mb-2"
                [disabled]="isVerifying()"
                (click)="submitPaymentForVerification()"
              >
                <div class="d-flex align-items-center justify-content-center gap-2">
                  <i class="bi bi-send-check fs-5"></i>
                  <span class="fw-bold">Submit for Gateway Verification</span>
                </div>
              </button>

              <!-- Quick Gateway Webhook Ping Button -->
              <button
                type="button"
                class="btn btn-outline-dark w-100 btn-sm"
                [disabled]="isVerifying()"
                (click)="triggerGatewayPing()"
                title="Sends a gateway verification callback ping to the server"
              >
                <i class="bi bi-lightning-charge-fill text-warning me-1"></i>
                <span>Simulate Gateway Callback Ping</span>
              </button>
            </div>

            <!-- Footer Actions -->
            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
              <button
                type="button"
                class="btn btn-link text-danger p-0 small text-decoration-none"
                (click)="requestClose()"
                [disabled]="isVerifying()"
              >
                <i class="bi bi-x-circle me-1"></i> Cancel / Change Method
              </button>

              <button
                type="button"
                class="btn btn-link text-muted p-0 small text-decoration-none"
                (click)="leaveAsUnpaidOrder()"
                [disabled]="isVerifying()"
              >
                Pay later from My Orders
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .upi-overlay {
      position: fixed;
      inset: 0;
      background: rgba(18, 15, 12, 0.72);
      backdrop-filter: blur(5px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 1rem;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .upi-dialog {
      position: relative;
      background: #ffffff;
      border-radius: 22px;
      max-width: 480px;
      width: 100%;
      max-height: 94vh;
      overflow-y: auto;
      box-shadow: 0 24px 52px rgba(0, 0, 0, 0.28);
      border: 1px solid var(--line, #e4dccb);
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes slideUp {
      from { transform: translateY(16px) scale(0.97); opacity: 0; }
      to { transform: translateY(0) scale(1); opacity: 1; }
    }

    .close-btn {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: #f4efe4;
      border: none;
      width: 34px;
      height: 34px;
      border-radius: 999px;
      display: grid;
      place-items: center;
      color: #6f675c;
      font-size: 0.88rem;
      cursor: pointer;
      z-index: 10;
      transition: all 0.15s ease;
    }

    .close-btn:hover {
      background: #e5ded0;
      color: #1c1915;
    }

    .upi-body {
      padding: 1.5rem;
    }

    .upi-header {
      margin-bottom: 1.15rem;
      padding-right: 2rem;
    }

    .upi-badge {
      display: inline-flex;
      align-items: center;
      background: #e8f5e9;
      color: #0e6b4f;
      font-weight: 700;
      font-size: 0.75rem;
      padding: 0.2rem 0.6rem;
      border-radius: 999px;
    }

    .upi-title {
      font-size: 1.5rem;
      font-weight: 750;
      color: var(--ink, #1c1915);
      margin: 0.25rem 0 0.15rem;
    }

    .upi-subtitle {
      font-size: 0.85rem;
      color: var(--muted, #6f675c);
      margin: 0;
    }

    /* Radar Ping Animation */
    .radar-ping-wrap {
      position: relative;
      width: 100px;
      height: 100px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .radar-circle {
      position: absolute;
      border-radius: 50%;
      border: 2px solid #22c55e;
      opacity: 0;
      animation: radarPulse 2.4s infinite cubic-bezier(0.215, 0.61, 0.355, 1);
    }

    .circle-1 {
      width: 40px;
      height: 40px;
      animation-delay: 0s;
    }

    .circle-2 {
      width: 70px;
      height: 70px;
      animation-delay: 0.8s;
    }

    .circle-3 {
      width: 100px;
      height: 100px;
      animation-delay: 1.6s;
    }

    @keyframes radarPulse {
      0% {
        transform: scale(0.3);
        opacity: 0.9;
      }
      80% {
        opacity: 0.3;
      }
      100% {
        transform: scale(1.1);
        opacity: 0;
      }
    }

    .radar-center {
      position: relative;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #f0fdf4;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(34, 197, 94, 0.25);
    }

    /* Pulse Button */
    .pulse-btn {
      box-shadow: 0 0 0 0 rgba(14, 107, 79, 0.4);
      animation: buttonPulse 1.8s infinite;
    }

    @keyframes buttonPulse {
      0% {
        box-shadow: 0 0 0 0 rgba(14, 107, 79, 0.5);
      }
      70% {
        box-shadow: 0 0 0 10px rgba(14, 107, 79, 0);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(14, 107, 79, 0);
      }
    }

    /* Return from App Banner */
    .return-app-banner {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
    }

    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      display: inline-block;
      animation: blink 1.2s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.85); }
    }

    /* VPA Card */
    .vpa-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 1rem;
      background: #faf7f2;
      border: 1.5px dashed #d8cfbe;
      border-radius: 12px;
    }

    .vpa-info {
      display: flex;
      flex-direction: column;
    }

    .vpa-label {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted, #6f675c);
      font-weight: 600;
    }

    .vpa-id {
      font-family: monospace;
      font-size: 1rem;
      font-weight: 700;
      color: #0e6b4f;
      letter-spacing: 0.02em;
    }

    .vpa-name {
      font-size: 0.75rem;
      color: var(--muted, #6f675c);
    }

    .copy-vpa-btn {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      background: #ffffff;
      border: 1px solid #d8cfbe;
      padding: 0.4rem 0.75rem;
      border-radius: 8px;
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--ink, #1c1915);
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .copy-vpa-btn:hover {
      background: #0e6b4f;
      border-color: #0e6b4f;
      color: #ffffff;
    }

    .copy-vpa-btn.copied {
      background: #0e6b4f;
      border-color: #0e6b4f;
      color: #ffffff;
    }

    /* Step Cards */
    .step-card {
      border: 1px solid #e7e0d2;
      border-radius: 14px;
      padding: 0.95rem;
      background: #ffffff;
    }

    .step-tag {
      font-size: 0.68rem;
      font-weight: 750;
      letter-spacing: 0.06em;
      color: var(--muted, #6f675c);
      margin-bottom: 0.75rem;
    }

    .highlight-step {
      background: #fcfdfa;
      border: 2px solid #bbf7d0;
      box-shadow: 0 4px 16px rgba(14, 107, 79, 0.08);
    }

    .highlight-tag {
      color: #0e6b4f;
    }

    /* UPI Apps Grid */
    .upi-apps-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
    }

    .app-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.65rem 0.25rem;
      border-radius: 12px;
      border: 1px solid #e7e0d2;
      background: #faf7f2;
      text-decoration: none;
      color: var(--ink, #1c1915);
      font-size: 0.75rem;
      font-weight: 600;
      transition: all 0.15s ease;
    }

    .app-btn:hover {
      background: #ffffff;
      border-color: #0e6b4f;
      transform: translateY(-2px);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
      color: #0e6b4f;
    }

    .app-icon {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 8px;
    }

    .upi-icon {
      background: #0e6b4f;
      color: #fff;
      font-size: 1.1rem;
    }

    /* QR Code */
    .qr-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.5rem 0 0.2rem;
    }

    .qr-box {
      position: relative;
      background: #ffffff;
      padding: 0.6rem;
      border-radius: 14px;
      border: 1.5px solid #e7e0d2;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.06);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .qr-code-img {
      display: block;
      border-radius: 6px;
    }

    .qr-overlay-brand {
      position: absolute;
      bottom: -10px;
      background: #1c1915;
      color: #ffffff;
      font-size: 0.68rem;
      font-weight: 600;
      padding: 0.15rem 0.6rem;
      border-radius: 999px;
      letter-spacing: 0.02em;
    }

    .qr-caption {
      font-size: 0.74rem;
      color: var(--muted, #6f675c);
      margin: 0;
      text-align: center;
    }

    /* Confirmation Button */
    .confirm-pay-btn {
      background: linear-gradient(135deg, #0e6b4f 0%, #0a3d2e 100%);
      border: none;
      padding: 0.8rem 1rem;
      border-radius: 14px;
      font-size: 1rem;
      box-shadow: 0 4px 14px rgba(14, 107, 79, 0.35);
      transition: all 0.2s ease;
    }

    .confirm-pay-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(14, 107, 79, 0.45);
    }

    /* Cancel Prompt Card */
    .cancel-prompt-card {
      background: #ffffff;
      border-radius: 22px;
    }

    .warning-icon-wrap {
      line-height: 1;
    }

    /* SUCCESS CARD */
    .payment-success-card {
      padding: 2.8rem 1.75rem;
      text-align: center;
    }

    .success-icon-wrap {
      font-size: 4.5rem;
      color: #0e6b4f;
      line-height: 1;
      margin-bottom: 0.85rem;
      animation: scalePop 0.35s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes scalePop {
      0% { transform: scale(0.5); opacity: 0; }
      100% { transform: scale(1); opacity: 1; }
    }

    .success-title {
      font-size: 1.75rem;
      font-weight: 750;
      color: var(--ink, #1c1915);
      margin-bottom: 0.25rem;
    }

    .success-amount {
      font-size: 1.5rem;
      font-weight: 800;
      color: #0e6b4f;
      margin-bottom: 0.5rem;
    }

    .success-msg {
      color: var(--muted, #6f675c);
      font-size: 0.9rem;
      margin-bottom: 1.25rem;
    }

    .order-chip {
      display: inline-block;
      background: #f4efe4;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      font-size: 0.85rem;
      color: var(--ink, #1c1915);
    }

    .redirect-hint {
      font-size: 0.88rem;
      color: #0e6b4f;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @media (max-width: 576px) {
      .upi-overlay {
        align-items: flex-end;
        padding: 0;
      }
      .upi-dialog {
        border-radius: 22px 22px 0 0;
        max-width: 100%;
        width: 100%;
        max-height: 92vh;
        margin: 0;
        animation: upiSlideBottom 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .upi-body {
        padding: 1.15rem 1rem max(1.25rem, env(safe-area-inset-bottom));
      }
      @keyframes upiSlideBottom {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
    }
  `],
})
export class UpiPaymentModalComponent implements OnInit, OnDestroy {
  @Input({ required: true }) details!: UpiPaymentDetails;
  @Output() paymentSuccess = new EventEmitter<Order>();
  @Output() paymentCancelled = new EventEmitter<void>();
  @Output() switchedToCod = new EventEmitter<Order>();
  @Output() payLater = new EventEmitter<Order>();

  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  private readonly elementRef = inject(ElementRef);

  readonly copied = signal(false);
  readonly isVerifying = signal(false);
  readonly isActionLoading = signal(false);
  readonly utr = signal('');
  readonly openedApp = signal<string | null>(null);
  readonly status = signal<'idle' | 'awaiting_gateway' | 'success' | 'error'>('idle');
  readonly errorText = signal('');
  readonly gatewayRef = signal('');
  readonly redirectCountdown = signal(2);
  readonly showCancelPrompt = signal(false);

  private redirectTimer: any = null;
  private copyTimeout: any = null;
  private pollTimer: any = null;
  private boundWindowFocus = () => this.onWindowFocus();

  ngOnInit() {
    // If the order was already confirmed or paid, show success immediately
    if (this.details.paymentStatus === 'paid' || this.details.orderStatus === 'confirmed') {
      this.status.set('success');
      this.startRedirect();
      return;
    }

    // Listen to window focus for app return
    window.addEventListener('focus', this.boundWindowFocus);
    document.addEventListener('visibilitychange', this.boundWindowFocus);

    // Start background status polling to wait for server-side gateway callback
    this.startStatusPolling();
  }

  ngOnDestroy() {
    if (this.redirectTimer) clearInterval(this.redirectTimer);
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    if (this.pollTimer) clearInterval(this.pollTimer);
    window.removeEventListener('focus', this.boundWindowFocus);
    document.removeEventListener('visibilitychange', this.boundWindowFocus);
  }

  private onWindowFocus() {
    if (this.status() === 'success' || this.isVerifying()) return;
    if (this.openedApp() || this.status() === 'awaiting_gateway') {
      void this.checkGatewayStatus();
    }
  }

  private startStatusPolling() {
    // Check every 2.5 seconds in background if gateway callback was processed
    this.pollTimer = setInterval(async () => {
      if (this.status() === 'success' || this.showCancelPrompt()) return;
      await this.checkGatewayStatus();
    }, 2500);
  }

  private async checkGatewayStatus() {
    try {
      const upiStatus = await this.shop.getUpiStatus(this.details.orderId);
      // Wait for callback or ping to update status to 'confirmed' or 'paid'
      if (upiStatus.isConfirmed || upiStatus.paymentStatus === 'paid' || upiStatus.orderStatus === 'confirmed') {
        const order = await this.shop.order(this.details.orderId);
        this.gatewayRef.set(upiStatus.gatewayVerification?.gatewayTransactionId || upiStatus.upiTransactionId || '');
        this.status.set('success');
        this.paymentSuccess.emit(order);
        this.startRedirect();
      } else if (upiStatus.paymentStatus === 'failed') {
        this.status.set('error');
        this.errorText.set('Payment gateway reported transaction failed.');
      }
    } catch {
      // Ignore background poll errors
    }
  }

  asValue(event: Event) {
    return (event.target as HTMLInputElement).value;
  }

  qrImageUrl() {
    const data = encodeURIComponent(this.details.genericUri);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=4&data=${data}`;
  }

  onQrImageError() {
    // Fallback if needed
  }

  copyUpiId() {
    void navigator.clipboard?.writeText(this.details.upiId);
    this.copied.set(true);
    this.toasts.show(`UPI ID copied: ${this.details.upiId}`);
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => this.copied.set(false), 2500);
  }

  onAppClicked(appName: string) {
    this.openedApp.set(appName);
    this.toasts.show(`Opened ${appName}. After payment, submit your reference here.`);
  }

  /**
   * Submit payment details for server-side verification without auto-confirming
   */
  async submitPaymentForVerification() {
    this.isVerifying.set(true);
    this.errorText.set('');

    try {
      await this.shop.submitUpiPayment({
        orderId: this.details.orderId,
        upiApp: this.openedApp() || 'Google Pay / UPI',
        utr: this.utr().trim() || undefined,
        note: 'Customer submitted payment for gateway verification',
      });

      this.status.set('awaiting_gateway');
      this.toasts.show('Payment submitted. Waiting for payment gateway callback ping to confirm order…');
    } catch (error) {
      this.status.set('error');
      const msg = errorMessage(error, 'Could not record payment. Please retry.');
      this.errorText.set(msg);
      this.toasts.error(msg);
    } finally {
      this.isVerifying.set(false);
    }
  }

  /**
   * Triggers the server-side gateway verification check (API endpoint ping / webhook simulation)
   */
  async triggerGatewayPing() {
    this.isVerifying.set(true);
    this.errorText.set('');

    try {
      const response = await this.shop.pingGatewayCallback({
        orderId: this.details.orderId,
        utr: this.utr().trim() || undefined,
        gatewayStatus: 'SUCCESS',
      });

      if (response.verified) {
        this.gatewayRef.set(response.gatewayTransactionId || response.utr || '');
        this.status.set('success');
        this.toasts.show('Gateway callback verified! Order is confirmed.');
        this.paymentSuccess.emit(response.order);
        this.startRedirect();
      }
    } catch (error) {
      const msg = errorMessage(error, 'Gateway verification failed. Please check your transaction.');
      this.errorText.set(msg);
      this.toasts.error(msg);
    } finally {
      this.isVerifying.set(false);
    }
  }

  requestClose() {
    this.showCancelPrompt.set(true);
  }

  async cancelAndRestoreCart() {
    this.isActionLoading.set(true);
    try {
      await this.shop.cancelAndRestoreCart(this.details.orderId, 'Customer cancelled UPI payment from checkout');
      await this.shop.loadCart();
      this.toasts.show('Payment cancelled. Your basket items have been restored.');
      this.paymentCancelled.emit();
    } catch (error) {
      this.toasts.error(errorMessage(error));
      this.paymentCancelled.emit();
    } finally {
      this.isActionLoading.set(false);
    }
  }

  async switchToCod() {
    this.isActionLoading.set(true);
    try {
      const order = await this.shop.switchToCod(this.details.orderId);
      this.toasts.show('Order switched to Cash on Delivery! Order confirmed.');
      this.switchedToCod.emit(order);
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.isActionLoading.set(false);
    }
  }

  async leaveAsUnpaidOrder() {
    try {
      const order = await this.shop.order(this.details.orderId);
      this.toasts.show('Order saved as pending. Please pay from your orders page.');
      this.payLater.emit(order);
    } catch {
      this.paymentCancelled.emit();
    }
  }

  navigateToOrderToUploadReceipt() {
    this.paymentCancelled.emit();
    void this.router.navigate(['/orders', this.details.orderId]);
  }

  private startRedirect() {
    this.redirectCountdown.set(5);
    this.redirectTimer = setInterval(() => {
      const next = this.redirectCountdown() - 1;
      this.redirectCountdown.set(next);
      if (next <= 0) {
        clearInterval(this.redirectTimer);
        void this.router.navigate(['/orders', this.details.orderId]);
      }
    }, 1000);
  }

  onBackdropClick(event: MouseEvent) {
    if (this.status() === 'success' || this.isVerifying() || this.isActionLoading()) return;
    const dialog = this.elementRef.nativeElement.querySelector('.upi-dialog');
    if (dialog && !dialog.contains(event.target as Node)) {
      this.requestClose();
    }
  }
}
