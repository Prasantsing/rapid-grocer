import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Order, OrderStatus, User } from '../core/models';
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
  template: `
    <div class="section-head mb-3">
      <div>
        <h2>Orders & Payment Verification</h2>
        <p class="muted mb-0">Track dark-store orders and review customer uploaded transaction receipts</p>
      </div>
    </div>

    <!-- FILTER TOOLBAR -->
    <div class="d-flex gap-2 mb-3 flex-wrap align-items-center">
      <select class="form-select w-auto" [(ngModel)]="status" (change)="load()">
        <option value="">All order statuses</option>
        @for (item of statuses; track item) { <option [value]="item">{{ label(item) }}</option> }
      </select>

      <select class="form-select w-auto" [(ngModel)]="receiptFilter" (change)="applyFilters()">
        <option value="">All receipt verification states</option>
        <option value="verified">Auto-Verified (Pending Review)</option>
        <option value="manual_utr_submitted">Manual UTR Submitted</option>
        <option value="mismatched">Receipt Mismatch Alert</option>
        <option value="admin_approved">Admin Approved</option>
      </select>

      <input
        class="form-control"
        style="max-width: 240px"
        placeholder="Search order number or UTR…"
        [(ngModel)]="search"
        (keyup.enter)="load()"
      />

      <button type="button" class="btn btn-outline-dark btn-sm ms-auto" (click)="load()">
        <i class="bi bi-arrow-clockwise me-1"></i> Refresh
      </button>
    </div>

    <!-- ORDERS LIST -->
    <div class="d-grid gap-3">
      @if (loading()) {
        <div class="p-4 text-center text-muted">Loading orders…</div>
      } @else if (!filteredOrders().length) {
        <div class="panel text-center p-4">
          <p class="text-muted mb-0">No orders match the selected filters.</p>
        </div>
      } @else {
        @for (order of filteredOrders(); track order.id) {
          <article class="panel" [class.border-warning]="order.receiptVerification?.verificationStatus === 'verified' && order.status === 'placed'">
            <!-- ORDER HEADER -->
            <div class="d-flex justify-content-between gap-2 flex-wrap mb-2">
              <div>
                <strong class="fs-6 me-2">{{ order.orderNumber }}</strong>
                <span class="muted small">{{ customer(order) }} · {{ order.createdAt | date:'d MMM, h:mm a' }} · <b>{{ order.total | inr }}</b></span>
              </div>
              <div class="d-flex align-items-center gap-2">
                <span [class]="'status-pill ' + order.status">{{ label(order.status) }}</span>
                <span [class]="'status-pill ' + order.paymentStatus">Pay: {{ label(order.paymentStatus) }}</span>
              </div>
            </div>

            <!-- RECEIPT VERIFICATION CALLOUT (IF PRESENT) -->
            @if (order.receiptVerification) {
              <div class="receipt-admin-badge-strip p-2 rounded-2 mb-2 d-flex justify-content-between align-items-center flex-wrap gap-2"
                [class.bg-success-subtle]="order.receiptVerification.verificationStatus === 'verified' || order.receiptVerification.verificationStatus === 'admin_approved'"
                [class.bg-warning-subtle]="order.receiptVerification.verificationStatus === 'mismatched'"
                [class.bg-info-subtle]="order.receiptVerification.verificationStatus === 'manual_utr_submitted'"
              >
                <div class="d-flex align-items-center gap-2 small">
                  @if (order.receiptVerification.verificationStatus === 'verified') {
                    <i class="bi bi-shield-fill-check text-success fs-6"></i>
                    <div>
                      <strong class="text-success">Receipt Auto-Verified</strong>
                      <span class="text-muted ms-1">(Expected ₹{{ order.total }} matched; UTR: {{ order.receiptVerification.extractedUtr || order.upiTransactionId || 'Extracted' }})</span>
                    </div>
                  } @else if (order.receiptVerification.verificationStatus === 'manual_utr_submitted') {
                    <i class="bi bi-keyboard text-info-emphasis fs-6"></i>
                    <div>
                      <strong class="text-info-emphasis">Manual UTR Submitted:</strong>
                      <span class="font-monospace fw-bold ms-1">{{ order.receiptVerification.manualUtr || order.upiTransactionId }}</span>
                    </div>
                  } @else if (order.receiptVerification.verificationStatus === 'mismatched') {
                    <i class="bi bi-exclamation-triangle-fill text-warning-emphasis fs-6"></i>
                    <div>
                      <strong class="text-warning-emphasis">Receipt Mismatch:</strong>
                      <span class="text-muted ms-1">{{ order.receiptVerification.matchReason || 'Discrepancy detected' }}</span>
                    </div>
                  } @else if (order.receiptVerification.verificationStatus === 'admin_approved') {
                    <i class="bi bi-check2-all text-success fs-6"></i>
                    <div>
                      <strong class="text-success">Store Approved</strong>
                      <span class="text-muted ms-1">{{ order.receiptVerification.adminReviewNote ? '· ' + order.receiptVerification.adminReviewNote : '' }}</span>
                    </div>
                  }
                </div>

                <button
                  type="button"
                  class="btn btn-sm btn-outline-dark py-1 px-2"
                  style="font-size: 0.78rem;"
                  (click)="openReceiptReview(order)"
                >
                  <i class="bi bi-receipt me-1"></i> Inspect Receipt & Verify
                </button>
              </div>
            } @else if (order.paymentMethod === 'upi') {
              <div class="p-1 px-2 rounded-1 bg-light text-muted small mb-2 d-flex justify-content-between align-items-center" style="font-size: 0.74rem;">
                <span>Payment: UPI (9101516662&#64;ybl) · No transaction slip uploaded yet</span>
                @if (order.upiTransactionId) {
                  <span class="font-monospace">Ref: {{ order.upiTransactionId }}</span>
                }
              </div>
            }

            <p class="muted small mb-2">{{ order.address.line1 }}, {{ order.address.city }} {{ order.address.pincode }}</p>

            <!-- ORDER ACTIONS -->
            <div class="d-flex gap-2 flex-wrap align-items-center pt-1 border-top">
              @if (order.status === 'placed') {
                <button class="btn btn-sm btn-dark" type="button" (click)="move(order, 'confirmed')">
                  Confirm Order
                </button>
              }
              @if (order.status === 'confirmed') {
                <button class="btn btn-sm btn-dark" type="button" (click)="move(order, 'packed')">
                  Mark Packed
                </button>
              }
              @if (order.status === 'placed' || order.status === 'confirmed' || order.status === 'packed') {
                <button class="btn btn-sm btn-outline-danger" type="button" (click)="move(order, 'cancelled')">
                  Cancel
                </button>
              }
              <select class="form-select form-select-sm w-auto" (change)="assign(order, $event)">
                <option value="">Assign delivery partner</option>
                @for (partner of partners(); track partner.id) {
                  <option [value]="partner.id" [selected]="isAssigned(order, partner.id)">{{ partner.name }}</option>
                }
              </select>
            </div>
          </article>
        }
      }
    </div>

    <!-- ADMIN RECEIPT REVIEW MODAL -->
    @if (selectedOrder(); as ord) {
      <div class="review-modal-backdrop" (click)="closeReceiptReview()">
        <div class="review-modal-content" (click)="$event.stopPropagation()">
          <div class="p-3 border-bottom d-flex justify-content-between align-items-center">
            <h5 class="h6 fw-bold mb-0">
              <i class="bi bi-search me-1 text-primary"></i>
              Payment Receipt Review: Order #{{ ord.orderNumber }}
            </h5>
            <button type="button" class="btn-close" (click)="closeReceiptReview()"></button>
          </div>

          <div class="p-3" style="max-height: 75vh; overflow-y: auto;">
            <div class="row g-3">
              <!-- RECEIPT IMAGE (LEFT) -->
              <div class="col-md-5">
                <div class="p-2 border rounded-3 bg-light text-center">
                  @if (ord.receiptVerification?.receiptImageUrl) {
                    <img
                      [src]="ord.receiptVerification!.receiptImageUrl"
                      alt="Receipt image"
                      class="img-fluid rounded border shadow-sm mb-2"
                      style="max-height: 320px; object-fit: contain; width: 100%; cursor: pointer;"
                      (click)="toggleZoom()"
                    />
                    <div class="text-muted" style="font-size: 0.72rem;">Click image to toggle zoom</div>
                  } @else {
                    <div class="p-4 text-muted">
                      <i class="bi bi-image fs-1 d-block mb-1"></i>
                      No screenshot uploaded. Customer submitted manual UTR.
                    </div>
                  }
                </div>
              </div>

              <!-- EXTRACTED TELEMETRY & MATCH VERIFICATION (RIGHT) -->
              <div class="col-md-7">
                <div class="border rounded-3 p-3 bg-white mb-3">
                  <h6 class="fw-bold small mb-2 text-uppercase text-muted" style="letter-spacing: 0.04em;">
                    Field Matching Comparison
                  </h6>

                  <table class="table table-sm table-borderless small mb-0">
                    <tbody>
                      <tr>
                        <td class="text-muted ps-0">Order Total:</td>
                        <td class="fw-bold">{{ ord.total | inr }}</td>
                        <td class="text-end pe-0">
                          @if (ord.receiptVerification?.matchDetails?.amountMatched) {
                            <span class="badge bg-success-subtle text-success border border-success-subtle">
                              <i class="bi bi-check-lg me-1"></i> Amount Matched
                            </span>
                          } @else if (ord.receiptVerification?.extractedAmount !== null && ord.receiptVerification?.extractedAmount !== undefined) {
                            <span class="badge bg-danger-subtle text-danger border border-danger-subtle">
                              Mismatch (₹{{ ord.receiptVerification!.extractedAmount }})
                            </span>
                          } @else {
                            <span class="badge bg-secondary-subtle text-muted">Not detected</span>
                          }
                        </td>
                      </tr>
                      <tr>
                        <td class="text-muted ps-0">Order Reference:</td>
                        <td class="font-monospace">#{{ ord.orderNumber }}</td>
                        <td class="text-end pe-0">
                          @if (ord.receiptVerification?.matchDetails?.orderIdMatched) {
                            <span class="badge bg-success-subtle text-success border border-success-subtle">
                              <i class="bi bi-check-lg me-1"></i> Matched
                            </span>
                          } @else {
                            <span class="badge bg-secondary-subtle text-muted">Unverified</span>
                          }
                        </td>
                      </tr>
                      <tr>
                        <td class="text-muted ps-0">Bank UTR / Ref:</td>
                        <td class="font-monospace fw-bold">
                          {{ ord.receiptVerification?.extractedUtr || ord.receiptVerification?.manualUtr || ord.upiTransactionId || 'None' }}
                        </td>
                        <td class="text-end pe-0">
                          @if (ord.receiptVerification?.extractedUtr || ord.receiptVerification?.manualUtr) {
                            <span class="badge bg-info-subtle text-info-emphasis border border-info-subtle">Captured</span>
                          }
                        </td>
                      </tr>
                      <tr>
                        <td class="text-muted ps-0">Payee VPA:</td>
                        <td class="font-monospace text-success">{{ ord.receiptVerification?.extractedPayeeVpa || ord.upiId || '9101516662@ybl' }}</td>
                        <td class="text-end pe-0">
                          @if (ord.receiptVerification?.matchDetails?.vpaMatched) {
                            <span class="badge bg-success-subtle text-success border border-success-subtle">ZapBasket VPA</span>
                          }
                        </td>
                      </tr>
                      <tr>
                        <td class="text-muted ps-0">Detected App:</td>
                        <td colspan="2" class="fw-semibold">{{ ord.receiptVerification?.appName || 'UPI Application' }}</td>
                      </tr>
                      @if (ord.receiptVerification?.extractedTimestamp) {
                        <tr>
                          <td class="text-muted ps-0">Slip Timestamp:</td>
                          <td colspan="2" class="font-monospace text-dark">{{ ord.receiptVerification!.extractedTimestamp }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>

                @if (ord.receiptVerification?.matchReason) {
                  <div class="alert alert-light border small py-2 px-3 mb-3">
                    <strong>AI OCR Note:</strong> {{ ord.receiptVerification!.matchReason }}
                  </div>
                }

                <!-- DECISION NOTE INPUT -->
                <div class="mb-3">
                  <label class="form-label small fw-bold mb-1">Admin Review Note (Optional)</label>
                  <input
                    type="text"
                    class="form-control form-control-sm"
                    placeholder="e.g. Verified with merchant statement / Approved"
                    [(ngModel)]="reviewNote"
                  />
                </div>

                <!-- ADMIN ACTION BUTTONS -->
                <div class="d-flex gap-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-success flex-grow-1 py-2 fw-semibold"
                    [disabled]="reviewing()"
                    (click)="submitReview(ord, 'approve')"
                  >
                    @if (reviewing()) {
                      <span class="spinner-border spinner-border-sm me-1" role="status"></span>
                      <span>Approving…</span>
                    } @else {
                      <i class="bi bi-check2-circle me-1"></i> Approve & Confirm Order
                    }
                  </button>

                  <button
                    type="button"
                    class="btn btn-sm btn-outline-danger flex-grow-1 py-2"
                    [disabled]="reviewing()"
                    (click)="submitReview(ord, 'reject')"
                  >
                    <i class="bi bi-x-circle me-1"></i> Reject & Request New Slip
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .receipt-admin-badge-strip {
      border: 1px solid rgba(0,0,0,0.06);
    }
    .review-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(4px);
      z-index: 2100;
      display: grid;
      place-items: center;
      padding: 1rem;
    }
    .review-modal-content {
      background: #ffffff;
      border-radius: 18px;
      max-width: 780px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 24px 48px rgba(0, 0, 0, 0.28);
    }
  `],
})
export class AdminOrdersPage {
  private readonly admin = inject(AdminService);
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);

  readonly orders = signal<Order[]>([]);
  readonly partners = signal<User[]>([]);
  readonly loading = signal(false);
  readonly reviewing = signal(false);

  readonly selectedOrder = signal<Order | null>(null);
  readonly zoomed = signal(false);

  status = '';
  receiptFilter = '';
  search = '';
  reviewNote = '';

  readonly statuses: OrderStatus[] = ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered', 'cancelled'];

  constructor() {
    void this.load();
    void this.admin.users({ role: 'delivery' }).then((page) => this.partners.set(page.items));
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
      const updated = await this.admin.reviewReceipt(order.id, decision, this.reviewNote);
      this.toasts.show(decision === 'approve' ? 'Receipt approved and order confirmed!' : 'Receipt marked as rejected.');
      this.closeReceiptReview();
      await this.load();
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.reviewing.set(false);
    }
  }
}
