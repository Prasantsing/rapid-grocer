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
      <app-order-progress-bar [order]="current" [status]="current.status" class="mb-3" />

      <!-- Customer Live Order Tracking Map -->
      @if (current.status !== 'cancelled') {
        <app-order-tracking-map [order]="current" [storeConfig]="shop.storeConfig()" />
      }

      <!-- DOORSTEP DELIVERY OTP SPOTLIGHT CARD -->
      @if (['confirmed', 'packed', 'out_for_delivery'].includes(current.status)) {
        <div class="card border-2 border-primary bg-primary-subtle text-primary-emphasis p-3 rounded-4 mb-4 shadow-sm text-center">
          <div class="d-flex align-items-center justify-content-center gap-2 mb-1">
            <i class="bi bi-shield-lock-fill text-primary fs-5"></i>
            <span class="text-uppercase small fw-bold text-primary" style="letter-spacing: 0.05em;">Doorstep Delivery Verification Code</span>
          </div>
          <div class="display-5 fw-bold font-monospace text-ink my-1" style="letter-spacing: 0.3em;">
            {{ current.deliveryOtp?.code || '••••' }}
          </div>
          <p class="small text-muted mb-2" style="font-size: 0.82rem;">
            Please share this 4-digit code with your ZapBasket delivery partner at your door to accept your items.
          </p>
          <div class="d-flex justify-content-center align-items-center gap-2">
            <button
              type="button"
              class="btn btn-outline-primary btn-sm rounded-pill px-3 py-1"
              style="font-size: 0.75rem;"
              [disabled]="resendOtpLoading()"
              (click)="resendOtp(current.id)">
              <i class="bi bi-arrow-repeat me-1" [class.spin]="resendOtpLoading()"></i>
              Resend Code via SMS
            </button>
            <span class="text-muted small" style="font-size: 0.72rem;">
              <i class="bi bi-shield-check text-success me-1"></i> Verified Handover
            </span>
          </div>
        </div>
      } @else if (current.status === 'delivered') {
        <div class="card border border-success-subtle bg-success-subtle text-success-emphasis p-3 rounded-4 mb-4 text-center">
          <div class="d-flex align-items-center justify-content-center gap-2">
            <i class="bi bi-patch-check-fill text-success fs-5"></i>
            <span class="fw-bold">Handover Verified & Successfully Delivered</span>
          </div>
          <div class="small text-muted mt-1" style="font-size: 0.78rem;">
            Delivered on {{ current.updatedAt | date:'d MMM, h:mm a' }}
            @if (current.deliveryOtp?.verifiedBy === 'customer_otp') {
              · Verified via Customer OTP
            } @else if (current.deliveryOtp?.verifiedBy === 'admin_bypass') {
              · Authorized via Dark Store Admin Bypass
            }
          </div>
        </div>
      }

      <!-- Soft Push Notification Opt-in Prompt -->
      @if (showPushBanner()) {
        <div class="card border-0 bg-primary-subtle text-primary-emphasis p-3 rounded-4 mb-4 shadow-sm">
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div class="d-flex align-items-center gap-3">
              <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center flex-shrink-0" style="width: 44px; height: 44px;">
                <i class="bi bi-bell-fill fs-5"></i>
              </div>
              <div>
                <div class="fw-bold fs-6">Enable Live Order Tracking Push Alerts</div>
                <div class="small text-secondary">Get instant screen notifications when your rider departs, packs your bag, and reaches your door.</div>
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <button
                type="button"
                class="btn btn-primary btn-sm px-3 fw-bold rounded-pill"
                (click)="enablePushAlerts()"
                [disabled]="pushBusy()"
              >
                @if (pushBusy()) { <span class="spinner-border spinner-border-sm me-1"></span> }
                <i class="bi bi-bell me-1"></i> Enable Push Alerts
              </button>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm rounded-pill"
                (click)="dismissPushBanner()"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      }

      <div class="split">
        <div class="panel">
          <div class="d-flex align-items-center justify-content-between mb-3">
            <h3 class="mb-0">Items in basket ({{ current.items.length }})</h3>
            <span class="badge bg-light text-muted border small">Direct Dark Store Dispatch</span>
          </div>

          @for (item of current.items; track item.productId) {
            <div class="line-item">
              <div class="d-flex gap-3 align-items-center">
                <div class="line-art" [style.background]="item.tint">{{ item.emoji }}</div>
                <div>
                  <div class="fw-medium">{{ item.name }}</div>
                  <div class="muted small">{{ item.quantity }} × {{ item.unit }}</div>
                  @if (!item.isReturnable) {
                    <span class="badge bg-light text-secondary border mt-1" style="font-size: 0.65rem;">
                      <i class="bi bi-shield-x text-danger me-1"></i> Non-returnable grocery
                    </span>
                  }
                </div>
              </div>
              <strong>{{ item.lineTotal | inr }}</strong>
            </div>
          }

          <!-- Non-Returnable Grocery Policy Disclosures -->
          <div class="mt-4 p-3 rounded-3 bg-light border text-muted small">
            <div class="d-flex align-items-start gap-2">
              <i class="bi bi-shield-exclamation text-warning fs-5 flex-shrink-0 mt-1"></i>
              <div>
                <div class="fw-bold text-dark mb-1">Return & Replacement Policy</div>
                <p class="mb-1 text-secondary" style="font-size: 0.8rem;">
                  {{ shop.storeConfig()?.nonReturnableNotice || 'Perishable groceries (fresh produce, dairy, bakery) cannot be returned once delivered as per food safety standards.' }}
                </p>
                <div class="small">
                  Damaged, defective, or missing item? <a routerLink="/contact" class="text-primary text-decoration-underline">Contact 24x7 Support</a> or review our <a routerLink="/refund-policy" class="text-primary text-decoration-underline">Refund Guidelines</a>.
                </div>
              </div>
            </div>
          </div>

          <!-- FSSAI Food Safety & Regulatory Disclosure -->
          <div class="mt-3 p-3 rounded-3 bg-white border d-flex align-items-center justify-content-between flex-wrap gap-2 text-muted small">
            <div class="d-flex align-items-center gap-2">
              <span class="badge bg-success text-white px-2 py-1">FSSAI Certified</span>
              <span class="font-monospace text-dark fw-bold">Lic. No. {{ shop.storeConfig()?.fssaiLicense || '11224333000542' }}</span>
            </div>
            <span class="text-secondary" style="font-size: 0.76rem;">Certified Food-Grade Hyperlocal Fulfillment</span>
          </div>
        </div>

        <aside class="panel">
          <h3>Drop</h3>
          <p class="mb-1"><strong>{{ current.address.fullName }}</strong></p>
          <p class="muted mb-2">{{ current.address.line1 }}<br>{{ current.address.city }} {{ current.address.pincode }}<br>{{ current.address.phone }}</p>

          <!-- Live Delivery Rider Contact Hub -->
          @if (partnerName(current)) {
            @if (shop.storeConfig()?.allowDirectRiderContact !== false) {
              <div class="card border border-primary-subtle bg-primary-subtle bg-opacity-10 rounded-3 p-3 mt-2 mb-3">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center" style="width: 38px; height: 38px;">
                      <i class="bi bi-bicycle fs-5"></i>
                    </div>
                    <div>
                      <div class="fw-bold small">{{ partnerName(current) }}</div>
                      <div class="text-success small d-flex align-items-center gap-1" style="font-size: 0.72rem;">
                        <span class="spinner-grow spinner-grow-sm text-success" style="width: 7px; height: 7px;"></span>
                        Assigned Delivery Rider
                      </div>
                    </div>
                  </div>
                  @if (partnerPhone(current)) {
                    <span class="badge bg-white text-secondary border small font-monospace">{{ partnerPhone(current) }}</span>
                  }
                </div>

                <div class="row g-2 mt-1">
                  <div class="col-6">
                    <a class="btn btn-sm btn-outline-primary w-100 d-inline-flex align-items-center justify-content-center gap-1"
                       [href]="partnerCallLink(current)">
                      <i class="bi bi-telephone-fill"></i> Call Rider
                    </a>
                  </div>
                  <div class="col-6">
                    <a class="btn btn-sm btn-success w-100 d-inline-flex align-items-center justify-content-center gap-1"
                       target="_blank"
                       rel="noopener"
                       [href]="partnerWhatsAppLink(current)">
                      <i class="bi bi-whatsapp"></i> WhatsApp
                    </a>
                  </div>
                </div>
              </div>
            } @else {
              <!-- When admin disabled direct rider contact for privacy/safety -->
              <div class="card border bg-light rounded-3 p-3 mt-2 mb-3">
                <div class="d-flex align-items-center gap-2 mb-2">
                  <div class="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center" style="width: 36px; height: 36px;">
                    <i class="bi bi-person-badge fs-5"></i>
                  </div>
                  <div>
                    <div class="fw-bold small">Rider: {{ partnerName(current) }}</div>
                    <div class="text-muted" style="font-size: 0.72rem;">Direct calling disabled by store policy. Connect with ZapBasket Desk.</div>
                  </div>
                </div>
                <div class="d-flex gap-2">
                  <a class="btn btn-sm btn-outline-dark flex-grow-1" [href]="'tel:' + (shop.storeConfig()?.supportPhone || '+919101516662')">
                    <i class="bi bi-telephone-outbound me-1"></i> Call Support
                  </a>
                  <a class="btn btn-sm btn-outline-success flex-grow-1" target="_blank" rel="noopener" [href]="supportWhatsAppLink(current)">
                    <i class="bi bi-whatsapp me-1"></i> WhatsApp
                  </a>
                </div>
              </div>
            }
          }

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
                Send <b>{{ current.total | inr }}</b> to <b>{{ shop.storeConfig()?.upiVpa || '9101516662@ybl' }}</b> to confirm packaging.
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
                <strong>Paid via UPI to {{ shop.storeConfig()?.upiVpa || '9101516662@ybl' }}</strong>
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

          <a
            class="btn btn-outline-success w-100 mt-2 d-inline-flex align-items-center justify-content-center gap-1"
            target="_blank"
            rel="noopener"
            [href]="shareOrderWhatsAppLink(current)"
          >
            <i class="bi bi-whatsapp"></i> Share Tracking on WhatsApp
          </a>

          @if (current.status === 'delivered') {
            @if (current.claims?.length) {
              <div class="mt-2 border rounded-3 p-2 bg-light text-start">
                <div class="fw-bold small mb-1 d-flex align-items-center justify-content-between">
                  <span><i class="bi bi-shield-exclamation text-primary me-1"></i> Item Claims</span>
                  <span class="badge bg-secondary">{{ current.claims?.length || 0 }}</span>
                </div>
                @for (c of current.claims; track c.id || c.productId) {
                  <div class="p-2 mb-1 rounded bg-white border small">
                    <div class="d-flex justify-content-between align-items-start">
                      <div>
                        <strong>{{ c.productName }}</strong>
                        <div class="text-muted" style="font-size: 0.72rem;">Reason: {{ formatClaimReason(c.reason) }}</div>
                      </div>
                      <span class="badge" [class.bg-warning-subtle]="c.status === 'pending'" [class.text-warning-emphasis]="c.status === 'pending'" [class.bg-success-subtle]="c.status === 'approved'" [class.text-success]="c.status === 'approved'" [class.bg-danger-subtle]="c.status === 'rejected'" [class.text-danger]="c.status === 'rejected'">
                        {{ c.status === 'pending' ? 'Reviewing' : (c.status === 'approved' ? '₹' + c.refundAmount + ' Refunded' : 'Declined') }}
                      </span>
                    </div>
                    @if (c.adminNote) {
                      <div class="mt-1 text-muted" style="font-size: 0.7rem;">Store note: {{ c.adminNote }}</div>
                    }
                  </div>
                }
              </div>
            }

            <button
              class="btn btn-outline-danger w-100 mt-2 d-inline-flex align-items-center justify-content-center gap-1"
              type="button"
              (click)="openClaimModal()">
              <i class="bi bi-shield-exclamation"></i> Report Damaged / Missing Item
            </button>
          }

          <!-- Customer Self-Cancellation & Dynamic Grace Window -->
          @if (current.status === 'cancelled') {
            <div class="alert alert-danger py-2 px-3 mt-2 mb-0 rounded-3 small">
              <i class="bi bi-x-octagon-fill me-1"></i>
              <strong>Order Cancelled</strong>
              <div class="mt-1 text-muted" style="font-size: 0.75rem;">
                {{ noteFor(current, 'cancelled') || 'This order was cancelled. Any online payment will be refunded to source.' }}
              </div>
            </div>
          } @else if (auth.user()?.role === 'customer') {
            @if (shop.storeConfig()?.allowCustomerCancellation === false) {
              <div class="p-2 mt-2 rounded-3 bg-light border text-muted small">
                <i class="bi bi-info-circle me-1"></i>
                Customer self-cancellation is paused by store. Contact support desk for urgent changes.
              </div>
            } @else if (current.status === 'placed') {
              @if (remainingSeconds() > 0) {
                @if (!showCancelPrompt()) {
                  <button class="btn btn-outline-danger w-100 mt-2 d-flex align-items-center justify-content-center gap-2" type="button" (click)="showCancelPrompt.set(true)">
                    <i class="bi bi-x-circle"></i>
                    <span>Cancel Order</span>
                    <span class="badge bg-danger text-white rounded-pill ms-1 font-monospace">{{ formatCountdown(remainingSeconds()) }}</span>
                  </button>
                  <div class="text-center text-muted mt-1" style="font-size: 0.72rem;">
                    Grace cancellation window: {{ shop.storeConfig()?.cancellationWindowMinutes || 3 }} mins
                  </div>
                } @else {
                  <div class="card border-danger-subtle bg-danger-subtle bg-opacity-10 rounded-3 p-3 mt-2 text-start">
                    <div class="fw-bold small text-danger mb-1"><i class="bi bi-exclamation-triangle-fill me-1"></i> Cancel this order?</div>
                    <div class="small text-muted mb-2">Packing has not started yet. Any online payment will be refunded to your account.</div>
                    <div class="d-flex gap-2">
                      <button class="btn btn-sm btn-danger flex-grow-1" type="button" [disabled]="cancelling()" (click)="cancel(current)">
                        @if (cancelling()) { <span class="spinner-border spinner-border-sm me-1"></span> Cancelling… } @else { Confirm Cancel }
                      </button>
                      <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="cancelling()" (click)="showCancelPrompt.set(false)">
                        Keep Order
                      </button>
                    </div>
                  </div>
                }
              } @else {
                <div class="p-2 mt-2 rounded-3 bg-light border text-muted small">
                  <i class="bi bi-lock-fill text-secondary me-1"></i>
                  Cancellation grace window ({{ shop.storeConfig()?.cancellationWindowMinutes || 3 }}m) expired. Order packing is underway.
                </div>
              }
            } @else if (['confirmed', 'packed', 'out_for_delivery'].includes(current.status)) {
              <div class="p-2 mt-2 rounded-3 bg-light border text-muted small">
                <i class="bi bi-shield-lock text-primary me-1"></i>
                Order is packed & in transit. Self-cancellation locked.
              </div>
            }
          }
        </aside>
      </div>

      <!-- CUSTOMER ORDER FEEDBACK & DELIVERY PARTNER TIPPING SECTION -->
      @if (current.status === 'delivered') {
        <div class="row g-4 mt-2">
          <!-- STORE & DELIVERY FEEDBACK -->
          <div class="col-12 col-md-7">
            <div class="card border rounded-3 p-4 shadow-sm bg-white h-100">
              <div class="d-flex align-items-center justify-content-between mb-3">
                <div class="d-flex align-items-center gap-2">
                  <div class="rounded-circle bg-warning-subtle text-warning-emphasis d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                    <i class="bi bi-star-fill fs-5"></i>
                  </div>
                  <div>
                    <h5 class="mb-0 fw-bold">Rate Your Experience</h5>
                    <small class="text-muted">How was your ZapBasket delivery?</small>
                  </div>
                </div>
                @if (current.feedback) {
                  <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                    <i class="bi bi-check2-circle me-1"></i> Feedback Submitted
                  </span>
                }
              </div>

              @if (current.feedback) {
                <!-- Feedback Summary View -->
                <div class="p-3 bg-light rounded-3 border">
                  <div class="row g-3">
                    <div class="col-6">
                      <div class="text-muted small">Store & Quality</div>
                      <div class="text-warning fw-bold fs-5 mt-1">
                        @for (s of [1,2,3,4,5]; track s) {
                          <i class="bi" [class.bi-star-fill]="s <= (current.feedback.storeRating || 0)" [class.bi-star]="s > (current.feedback.storeRating || 0)"></i>
                        }
                        <span class="text-dark small ms-1">({{ current.feedback.storeRating }}/5)</span>
                      </div>
                    </div>
                    @if (current.feedback.riderRating) {
                      <div class="col-6">
                        <div class="text-muted small">Delivery Partner</div>
                        <div class="text-warning fw-bold fs-5 mt-1">
                          @for (s of [1,2,3,4,5]; track s) {
                            <i class="bi" [class.bi-star-fill]="s <= (current.feedback.riderRating || 0)" [class.bi-star]="s > (current.feedback.riderRating || 0)"></i>
                          }
                          <span class="text-dark small ms-1">({{ current.feedback.riderRating }}/5)</span>
                        </div>
                      </div>
                    }
                  </div>

                  @if (current.feedback.deliveryTags?.length) {
                    <div class="mt-3">
                      <div class="text-muted small mb-1">Highlights:</div>
                      <div class="d-flex flex-wrap gap-1">
                        @for (tag of current.feedback.deliveryTags; track tag) {
                          <span class="badge bg-white text-dark border px-2 py-1">{{ tag }}</span>
                        }
                      </div>
                    </div>
                  }

                  @if (current.feedback.comments) {
                    <div class="mt-3 p-2 bg-white rounded border small text-secondary">
                      <i class="bi bi-chat-quote-fill text-muted me-1"></i>
                      "{{ current.feedback.comments }}"
                    </div>
                  }
                  <div class="mt-2 text-end text-muted" style="font-size: 0.72rem;">
                    Submitted on {{ current.feedback.submittedAt | date:'mediumDate' }}
                  </div>
                </div>
              } @else {
                <!-- Interactive Feedback Form -->
                <div class="d-flex flex-column gap-3">
                  <div>
                    <label class="form-label small fw-bold text-dark mb-1">Overall Store & Grocery Quality</label>
                    <div class="d-flex align-items-center gap-2">
                      @for (star of [1,2,3,4,5]; track star) {
                        <button
                          type="button"
                          class="btn p-0 border-0 bg-transparent text-warning fs-3 lh-1 cursor-pointer"
                          (click)="selectedStoreRating.set(star)"
                          (mouseenter)="hoverStoreRating.set(star)"
                          (mouseleave)="hoverStoreRating.set(0)">
                          <i class="bi" [class.bi-star-fill]="star <= (hoverStoreRating() || selectedStoreRating())" [class.bi-star]="star > (hoverStoreRating() || selectedStoreRating())"></i>
                        </button>
                      }
                      <span class="small fw-semibold ms-2 text-secondary">{{ ratingStoreLabel(selectedStoreRating()) }}</span>
                    </div>
                  </div>

                  <div>
                    <label class="form-label small fw-bold text-dark mb-1">Delivery Partner Behavior & Speed</label>
                    <div class="d-flex align-items-center gap-2">
                      @for (star of [1,2,3,4,5]; track star) {
                        <button
                          type="button"
                          class="btn p-0 border-0 bg-transparent text-warning fs-3 lh-1 cursor-pointer"
                          (click)="selectedRiderRating.set(star)"
                          (mouseenter)="hoverRiderRating.set(star)"
                          (mouseleave)="hoverRiderRating.set(0)">
                          <i class="bi" [class.bi-star-fill]="star <= (hoverRiderRating() || selectedRiderRating())" [class.bi-star]="star > (hoverRiderRating() || selectedRiderRating())"></i>
                        </button>
                      }
                      <span class="small fw-semibold ms-2 text-secondary">{{ ratingRiderLabel(selectedRiderRating()) }}</span>
                    </div>
                  </div>

                  <div>
                    <label class="form-label small fw-bold text-dark mb-1">What went great?</label>
                    <div class="d-flex flex-wrap gap-2">
                      @for (tag of feedbackTags; track tag) {
                        <button
                          type="button"
                          class="btn btn-sm rounded-pill"
                          [class.btn-dark]="isTagSelected(tag)"
                          [class.btn-outline-secondary]="!isTagSelected(tag)"
                          (click)="toggleFeedbackTag(tag)">
                          {{ tag }}
                        </button>
                      }
                    </div>
                  </div>

                  <div>
                    <label class="form-label small fw-bold text-dark mb-1">Detailed comments (optional)</label>
                    <textarea
                      class="form-control form-control-sm"
                      rows="2"
                      placeholder="Tell us about the packaging, quality, or speed..."
                      [value]="feedbackComments()"
                      (input)="feedbackComments.set($any($event.target).value)"
                      maxlength="500"></textarea>
                  </div>

                  <button
                    class="btn btn-dark w-100 fw-semibold"
                    type="button"
                    [disabled]="submittingFeedback() || selectedStoreRating() === 0"
                    (click)="submitFeedback(current.id)">
                    @if (submittingFeedback()) {
                      <span class="spinner-border spinner-border-sm me-1"></span> Submitting…
                    } @else {
                      <i class="bi bi-send-fill me-1"></i> Submit Review
                    }
                  </button>
                </div>
              }
            </div>
          </div>

          <!-- OPTIONAL UPI TIPPING STATION -->
          <div class="col-12 col-md-5">
            <div class="card border rounded-3 p-4 shadow-sm bg-white h-100">
              <div class="d-flex align-items-center gap-2 mb-3">
                <div class="rounded-circle bg-success-subtle text-success d-flex align-items-center justify-content-center" style="width: 40px; height: 40px;">
                  <i class="bi bi-cash-coin fs-5"></i>
                </div>
                <div>
                  <h5 class="mb-0 fw-bold">Tip Delivery Partner</h5>
                  <small class="text-muted">100% tip goes directly to your rider</small>
                </div>
              </div>

              @if (current.tip?.status === 'paid') {
                <div class="p-3 bg-success-subtle bg-opacity-25 rounded-3 border border-success-subtle text-center">
                  <div class="text-success fs-1 mb-1"><i class="bi bi-heart-fill"></i></div>
                  <h6 class="fw-bold text-success mb-1">₹{{ current.tip?.amount }} Tip Sent!</h6>
                  <p class="small text-muted mb-2">Thank you! Your generosity means the world to our delivery team.</p>
                  @if (current.tip?.upiTransactionId) {
                    <div class="badge bg-white text-secondary border font-monospace small">Ref: {{ current.tip?.upiTransactionId }}</div>
                  }
                </div>
              } @else {
                <div class="p-3 bg-light rounded-3 border mb-3">
                  <div class="d-flex align-items-center gap-2">
                    <div class="rounded-circle bg-secondary text-white d-flex align-items-center justify-content-center" style="width: 32px; height: 32px;">
                      <i class="bi bi-person-fill"></i>
                    </div>
                    <div>
                      <div class="fw-bold small">{{ partnerName(current) || 'ZapBasket Rider' }}</div>
                      <div class="text-muted" style="font-size: 0.72rem;">Delivered on-time to your doorstep</div>
                    </div>
                  </div>
                </div>

                <div class="mb-3">
                  <label class="form-label small fw-bold text-dark mb-1">Choose tip amount</label>
                  <div class="row g-2">
                    @for (amt of [20, 30, 50, 100]; track amt) {
                      <div class="col-3">
                        <button
                          type="button"
                          class="btn btn-sm w-100 rounded-3 fw-bold"
                          [class.btn-success]="selectedTipAmount() === amt"
                          [class.btn-outline-secondary]="selectedTipAmount() !== amt"
                          (click)="setTipAmount(amt)">
                          ₹{{ amt }}
                        </button>
                      </div>
                    }
                  </div>
                  <div class="input-group input-group-sm mt-2">
                    <span class="input-group-text">₹</span>
                    <input
                      type="number"
                      class="form-control"
                      placeholder="Other amount"
                      min="5"
                      max="1000"
                      [value]="selectedTipAmount() || ''"
                      (input)="setTipAmount(+$any($event.target).value)" />
                  </div>
                </div>

                <div class="d-flex flex-column gap-2">
                  <a
                    class="btn btn-success w-100 fw-semibold d-inline-flex align-items-center justify-content-center gap-2"
                    [href]="tipUpiDeepLink(current)"
                    (click)="recordTip(current.id)">
                    <i class="bi bi-wallet2"></i> Pay ₹{{ selectedTipAmount() || 30 }} via UPI
                  </a>
                  <button
                    class="btn btn-outline-dark btn-sm w-100"
                    type="button"
                    [disabled]="submittingTip()"
                    (click)="recordTip(current.id, true)">
                    @if (submittingTip()) {
                      <span class="spinner-border spinner-border-sm me-1"></span> Recording…
                    } @else {
                      <i class="bi bi-check-lg me-1"></i> I Have Paid via UPI / Confirm Tip
                    }
                  </button>
                  <div class="text-center text-muted" style="font-size: 0.7rem;">
                    VPA: <b>9101516662&#64;ybl</b> (ZapBasket Instant Tipping)
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }

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

      <!-- ITEM CLAIM & REFUND MODAL -->
      @if (showClaimModal()) {
        <div class="review-modal-backdrop" (click)="showClaimModal.set(false)">
          <div class="review-modal-content" style="max-width: 500px;" (click)="$event.stopPropagation()">
            <div class="p-3 border-bottom d-flex justify-content-between align-items-center">
              <h5 class="h6 fw-bold mb-0">
                <i class="bi bi-shield-exclamation text-danger me-1"></i>
                Report Damaged / Missing Item
              </h5>
              <button type="button" class="btn-close" (click)="showClaimModal.set(false)"></button>
            </div>

            <div class="p-3">
              <div class="mb-3">
                <label class="form-label small fw-bold">Select Affected Item</label>
                <select class="form-select form-select-sm" [value]="selectedClaimProductId()" (change)="selectedClaimProductId.set($any($event.target).value)">
                  <option value="">Choose item from order…</option>
                  @for (it of current.items; track it.productId) {
                    <option [value]="it.productId">{{ it.emoji }} {{ it.name }} ({{ it.quantity }} {{ it.unit }}) · ₹{{ it.price * it.quantity }}</option>
                  }
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label small fw-bold">Issue Reason</label>
                <select class="form-select form-select-sm" [value]="selectedClaimReason()" (change)="selectedClaimReason.set($any($event.target).value)">
                  <option value="damaged_spoiled">Damaged or Spoiled Produce / Leaked Pack 🥬</option>
                  <option value="missing_item">Item Missing in Delivery Bag 📦</option>
                  <option value="expired">Expired or Near Expiry Date ⏳</option>
                  <option value="wrong_item">Wrong Item / Variant Delivered ❌</option>
                  <option value="quality_issue">General Quality Defect 😕</option>
                </select>
              </div>

              <div class="mb-3">
                <label class="form-label small fw-bold">Attach Photo Proof (Required for damaged/spoiled)</label>
                <input type="file" class="form-control form-control-sm" accept="image/*" (change)="onClaimPhotoSelected($event)" />
                @if (claimPhoto()) {
                  <div class="mt-2 text-center p-2 bg-light rounded border">
                    <img [src]="claimPhoto()" alt="Proof preview" class="img-fluid rounded" style="max-height: 140px;" />
                    <div class="text-success small mt-1"><i class="bi bi-check-circle-fill me-1"></i> Photo attached</div>
                  </div>
                }
              </div>

              <div class="mb-3">
                <label class="form-label small fw-bold">Comments / Details</label>
                <textarea
                  class="form-control form-control-sm"
                  rows="2"
                  placeholder="Describe the issue (e.g. seal was broken, bruised tomatoes)..."
                  [value]="claimComments()"
                  (input)="claimComments.set($any($event.target).value)"
                  maxlength="500"></textarea>
              </div>

              @if (getClaimSelectedLine(current); as line) {
                <div class="alert alert-info py-2 px-3 small d-flex justify-content-between align-items-center mb-3">
                  <span>Eligible Refund Amount:</span>
                  <strong class="fs-6 text-dark">₹{{ line.price * line.quantity }}</strong>
                </div>
              }

              <button
                class="btn btn-danger w-100 fw-semibold"
                type="button"
                [disabled]="submittingClaim() || !selectedClaimProductId()"
                (click)="submitItemClaim(current.id)">
                @if (submittingClaim()) {
                  <span class="spinner-border spinner-border-sm me-1"></span> Submitting…
                } @else {
                  <i class="bi bi-send-fill me-1"></i> Submit Claim for Refund
                }
              </button>
            </div>
          </div>
        </div>
      }
    }
  `,
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

