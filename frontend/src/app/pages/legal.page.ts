import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';

type LegalTab = 'terms' | 'privacy' | 'refunds' | 'contact' | 'fssai';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="legal-wrap py-4 py-md-5">
      <!-- Breadcrumb Header -->
      <div class="mb-4">
        <div class="d-flex align-items-center gap-2 text-muted small mb-2">
          <a routerLink="/" class="text-decoration-none text-muted">Home</a>
          <span aria-hidden="true">·</span>
          <span>Legal & Compliance</span>
          <span aria-hidden="true">·</span>
          <span class="text-dark fw-semibold text-capitalize">{{ activeTab() }}</span>
        </div>
        <h1 class="h2 fw-bold text-dark mb-1">Legal Policies & Customer Rights</h1>
        <p class="text-muted small mb-0">
          Transparent terms, privacy protection, food safety licensing, and refund guarantees for ZapBasket shoppers.
        </p>
      </div>

      <!-- Navigation Tabs (Segmented Control) -->
      <div class="legal-nav-bar mb-4 p-1 bg-light rounded-3 border d-flex flex-wrap gap-1">
        <button
          type="button"
          class="btn btn-sm legal-tab-btn"
          [class.active]="activeTab() === 'terms'"
          (click)="setTab('terms')"
        >
          <i class="bi bi-file-text me-1"></i> Terms of Service
        </button>
        <button
          type="button"
          class="btn btn-sm legal-tab-btn"
          [class.active]="activeTab() === 'privacy'"
          (click)="setTab('privacy')"
        >
          <i class="bi bi-shield-check me-1"></i> Privacy Policy
        </button>
        <button
          type="button"
          class="btn btn-sm legal-tab-btn"
          [class.active]="activeTab() === 'refunds'"
          (click)="setTab('refunds')"
        >
          <i class="bi bi-arrow-counterclockwise me-1"></i> Refund & Cancellation
        </button>
        <button
          type="button"
          class="btn btn-sm legal-tab-btn"
          [class.active]="activeTab() === 'contact'"
          (click)="setTab('contact')"
        >
          <i class="bi bi-headset me-1"></i> Contact & Grievance
        </button>
        <button
          type="button"
          class="btn btn-sm legal-tab-btn"
          [class.active]="activeTab() === 'fssai'"
          (click)="setTab('fssai')"
        >
          <i class="bi bi-award me-1"></i> FSSAI & GST Compliance
        </button>
      </div>

      <!-- Content Grid -->
      <div class="row g-4">
        <!-- Main Document Area -->
        <div class="col-lg-8">
          <div class="card border-0 shadow-sm rounded-4 p-4 p-md-5 bg-white">
            <!-- TAB 1: TERMS OF SERVICE -->
            @if (activeTab() === 'terms') {
              <article class="legal-doc">
                <div class="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
                  <div>
                    <h2 class="h4 fw-bold mb-1">Terms of Service</h2>
                    <div class="text-muted small">Effective Date: October 2026 · Version 2.4</div>
                  </div>
                  <span class="badge bg-light text-dark border">India Jurisdiction</span>
                </div>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">01. Acceptance of Terms</h3>
                  <p class="small text-secondary leading-relaxed">
                    By downloading, installing, accessing, or placing an order on ZapBasket (operated by ZapBasket Rapid Retail LLP), you agree to be bound by these Terms of Service and all related policies. If you do not agree, you must discontinue using our mobile app and website immediately.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">02. 12-Minute Rapid Delivery SLA</h3>
                  <p class="small text-secondary leading-relaxed">
                    ZapBasket utilizes hyperlocal fulfillment micro-warehouses (dark stores) within designated delivery radii. While our goal is rapid 12-minute fulfillment, delivery times are estimates subject to heavy rains, traffic gridlock, peak festival demand, and rider safety. ZapBasket does not penalize riders for traffic delays.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">03. Pricing, GST & Billing</h3>
                  <p class="small text-secondary leading-relaxed">
                    All prices displayed in the app are in Indian Rupees (₹ INR) and inclusive of applicable Goods and Services Tax (GST). Delivery partner fees, packaging charges, and order minimums (if applicable) are itemized transparently before you confirm payment.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">04. Fresh Groceries & Perishable Goods</h3>
                  <p class="small text-secondary leading-relaxed">
                    We source fresh farm produce, dairy, bakery, and meats daily under stringent cold-chain protocols. Weights of fresh fruits and vegetables may vary marginally by ±5% due to natural moisture evaporation during handling.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">05. User Account & Conduct</h3>
                  <p class="small text-secondary leading-relaxed">
                    You are responsible for maintaining the confidentiality of your registered mobile number and OTP credentials. Creating duplicate accounts to abuse promotional coupon codes or submitting fraudulent payment receipts constitutes a breach of contract and will lead to permanent account suspension.
                  </p>
                </section>
              </article>
            }

            <!-- TAB 2: PRIVACY POLICY -->
            @if (activeTab() === 'privacy') {
              <article class="legal-doc">
                <div class="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
                  <div>
                    <h2 class="h4 fw-bold mb-1">Privacy Policy</h2>
                    <div class="text-muted small">Digital Personal Data Protection (DPDP) Act 2023 Compliant</div>
                  </div>
                  <span class="badge bg-success-subtle text-success border border-success-subtle">Data Protected</span>
                </div>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">01. What Information We Collect</h3>
                  <p class="small text-secondary leading-relaxed">
                    To deliver groceries within 12 minutes, we collect:
                  </p>
                  <ul class="small text-secondary">
                    <li><b>Delivery Location:</b> Device GPS coordinates, delivery address, house/flat numbers, and landmarks to guide delivery riders.</li>
                    <li><b>Contact Credentials:</b> Mobile phone number, name, and email address for order OTPs, tracking SMS, and invoices.</li>
                    <li><b>Transaction Records:</b> UPI transaction IDs (UTR), payment method, and billing timestamps. <i>We never store your credit/debit card CVV or UPI PIN.</i></li>
                  </ul>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">02. How We Use Your Data</h3>
                  <p class="small text-secondary leading-relaxed">
                    Your data is strictly used for order dispatch, rider navigation, automated receipt verification, customer support, and mandatory tax compliance. We never sell or rent your personal information to third-party telemarketers.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">03. Location Permission Usage</h3>
                  <p class="small text-secondary leading-relaxed">
                    When you allow location access, ZapBasket pinpoints your nearest active micro-fulfillment store and calculates route distance. Location access is active only while browsing or checking out on our storefront.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">04. Data Rights & Erasure</h3>
                  <p class="small text-secondary leading-relaxed">
                    Under Indian privacy laws, you have the right to request a copy of your stored data or request complete account erasure by contacting <b>privacy&#64;zapbasket.store</b>.
                  </p>
                </section>
              </article>
            }

            <!-- TAB 3: REFUND & CANCELLATION -->
            @if (activeTab() === 'refunds') {
              <article class="legal-doc">
                <div class="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
                  <div>
                    <h2 class="h4 fw-bold mb-1">Refund & Cancellation SLA</h2>
                    <div class="text-muted small">No-Questions-Asked Freshness Guarantee</div>
                  </div>
                  <span class="badge bg-warning-subtle text-dark border border-warning-subtle">Instant Refunds</span>
                </div>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">01. 100% Freshness Guarantee</h3>
                  <p class="small text-secondary leading-relaxed">
                    If any fresh vegetable, fruit, milk packet, or bread delivered to you is damaged, spoiled, or past its expiration date, we will refund your money immediately. No return of the spoiled perishable item is necessary.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">02. How to Report Damaged or Missing Items</h3>
                  <p class="small text-secondary leading-relaxed">
                    Report the issue within <b>2 hours of delivery</b> via:
                  </p>
                  <ol class="small text-secondary">
                    <li>Go to <b>My Orders</b> $\to$ select the delivered order.</li>
                    <li>Tap <b>Report Issue / Upload Photo</b>.</li>
                    <li>Our automated AI verification immediately credits your account or issues an instant refund.</li>
                  </ol>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">03. Order Cancellation Window</h3>
                  <p class="small text-secondary leading-relaxed">
                    You can cancel an order free of charge before the fulfillment center packs your order. Once a rider has been dispatched with fresh products, cancellations cannot be accepted to prevent perishable food wastage.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">04. Refund Timelines</h3>
                  <div class="table-responsive">
                    <table class="table table-bordered table-sm small">
                      <thead class="table-light">
                        <tr>
                          <th>Payment Method</th>
                          <th>Refund Mode</th>
                          <th>Settlement TAT</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>UPI (GPay, PhonePe, Paytm)</td>
                          <td>Original Bank Account (VPA)</td>
                          <td>Instant to 2 Hours (Max 24h)</td>
                        </tr>
                        <tr>
                          <td>Debit / Credit Card</td>
                          <td>Issuing Bank</td>
                          <td>3–5 Business Days</td>
                        </tr>
                        <tr>
                          <td>NetBanking</td>
                          <td>Source Bank Account</td>
                          <td>3–5 Business Days</td>
                        </tr>
                        <tr>
                          <td>Cash on Delivery (COD)</td>
                          <td>UPI Transfer or Store Credit</td>
                          <td>Instant Upon Verification</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </article>
            }

            <!-- TAB 4: CONTACT & GRIEVANCE REDRESSAL -->
            @if (activeTab() === 'contact') {
              <article class="legal-doc">
                <div class="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
                  <div>
                    <h2 class="h4 fw-bold mb-1">Contact Us & Grievance Redressal</h2>
                    <div class="text-muted small">Mandatory Disclosure under Consumer Protection (E-Commerce) Rules, 2020</div>
                  </div>
                  <span class="badge bg-primary-subtle text-primary border border-primary-subtle">Live Support</span>
                </div>

                <div class="row g-3 mb-4">
                  <div class="col-sm-6">
                    <div class="p-3 rounded-3 bg-light border h-100">
                      <div class="d-flex align-items-center gap-2 mb-2">
                        <i class="bi bi-telephone-fill text-primary"></i>
                        <strong class="small text-dark">Customer Helpline</strong>
                      </div>
                      <p class="small text-muted mb-2">Daily 07:00 AM to 11:00 PM IST</p>
                      <a href="tel:+919101516662" class="btn btn-sm btn-outline-dark fw-bold">
                        <i class="bi bi-telephone me-1"></i> +91 9101516662
                      </a>
                    </div>
                  </div>

                  <div class="col-sm-6">
                    <div class="p-3 rounded-3 bg-light border h-100">
                      <div class="d-flex align-items-center gap-2 mb-2">
                        <i class="bi bi-whatsapp text-success"></i>
                        <strong class="small text-dark">WhatsApp Quick Desk</strong>
                      </div>
                      <p class="small text-muted mb-2">Instant rider & order coordination</p>
                      <a href="https://wa.me/919101516662?text=Hello%20ZapBasket%20Support" target="_blank" rel="noopener" class="btn btn-sm btn-success fw-bold">
                        <i class="bi bi-whatsapp me-1"></i> Chat on WhatsApp
                      </a>
                    </div>
                  </div>
                </div>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">Statutory Grievance Officer</h3>
                  <p class="small text-secondary leading-relaxed">
                    In accordance with Information Technology Act, 2000 and rules made thereunder, the name and contact details of the Grievance Officer are:
                  </p>
                  <div class="p-3 rounded-3 border bg-light small">
                    <div><b>Name:</b> Prasant Singh</div>
                    <div><b>Designation:</b> Head of Customer Experience & Grievance Officer</div>
                    <div><b>Entity:</b> ZapBasket Rapid Retail LLP</div>
                    <div><b>Address:</b> Koramangala 4th Block, Bengaluru, Karnataka 560034, India</div>
                    <div><b>Direct Grievance Email:</b> <a href="mailto:grievance@zapbasket.store" class="text-decoration-none">grievance&#64;zapbasket.store</a></div>
                    <div><b>Response TAT:</b> Acknowledgment within 48 hours; resolution within 1 month.</div>
                  </div>
                </section>
              </article>
            }

            <!-- TAB 5: FSSAI & GST LICENSING -->
            @if (activeTab() === 'fssai') {
              <article class="legal-doc">
                <div class="d-flex align-items-center justify-content-between border-bottom pb-3 mb-4">
                  <div>
                    <h2 class="h4 fw-bold mb-1">Food Safety & Statutory Licensing</h2>
                    <div class="text-muted small">Registered Food Business Operator (FBO)</div>
                  </div>
                  <span class="badge bg-success-subtle text-success border border-success-subtle">FSSAI Certified</span>
                </div>

                <div class="p-3 rounded-3 border bg-light mb-4 text-center">
                  <div class="display-6 fw-bold text-dark mb-1">fssai</div>
                  <div class="small fw-bold text-secondary">License No. 11224333000542</div>
                  <div class="text-muted small mt-1">Food Safety and Standards Authority of India · Category: E-Commerce Food Operator</div>
                </div>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">Quality & Hygiene Standards</h3>
                  <p class="small text-secondary leading-relaxed">
                    All storage facilities and rider thermal delivery bags comply with temperature-controlled hygiene standards mandated by the Food Safety and Standards (Licensing and Registration of Food Businesses) Regulations, 2011.
                  </p>
                </section>

                <section class="mb-4">
                  <h3 class="h6 fw-bold text-dark">Taxation (GST) Registration</h3>
                  <div class="p-3 rounded-3 border bg-light small">
                    <div><b>Legal Name:</b> ZapBasket Rapid Retail LLP</div>
                    <div><b>GSTIN:</b> 29AABCZ9101F1Z8</div>
                    <div><b>State of Registration:</b> Karnataka (State Code: 29)</div>
                    <div><b>HSN/SAC Codes:</b> 0709 (Vegetables), 0804 (Fruits), 0401 (Dairy), 9968 (Courier & Local Delivery Services)</div>
                  </div>
                </section>
              </article>
            }
          </div>
        </div>

        <!-- Right Column: Trust Card & Support Actions -->
        <div class="col-lg-4">
          <!-- Trust Badge Card -->
          <div class="card border-0 shadow-sm rounded-4 p-4 bg-white mb-4">
            <h5 class="fw-bold mb-3 text-dark">Customer Protection</h5>
            <div class="d-flex align-items-start gap-3 mb-3">
              <i class="bi bi-shield-lock-fill text-success fs-4"></i>
              <div>
                <strong class="small text-dark d-block">100% Secure Payments</strong>
                <span class="text-muted small">256-bit encrypted bank gateway & NPCI UPI verified.</span>
              </div>
            </div>
            <div class="d-flex align-items-start gap-3 mb-3">
              <i class="bi bi-box-seam-fill text-primary fs-4"></i>
              <div>
                <strong class="small text-dark d-block">Tamper-Proof Packaging</strong>
                <span class="text-muted small">Bio-degradable sealed grocery packets with safety tags.</span>
              </div>
            </div>
            <div class="d-flex align-items-start gap-3">
              <i class="bi bi-arrow-repeat text-warning fs-4"></i>
              <div>
                <strong class="small text-dark d-block">No-Hassle Instant Refunds</strong>
                <span class="text-muted small">Auto-settled to source UPI ID within hours.</span>
              </div>
            </div>
          </div>

          <!-- Quick Contact Box -->
          <div class="card border-0 shadow-sm rounded-4 p-4 bg-light">
            <h6 class="fw-bold mb-2">Need Help With an Order?</h6>
            <p class="small text-muted mb-3">
              Our Bengaluru operations desk is online daily from 07:00 AM to 11:00 PM.
            </p>
            <div class="d-grid gap-2">
              <a href="https://wa.me/919101516662?text=Hi%20ZapBasket%2C%20I%20need%20help%20with%20my%20order" target="_blank" rel="noopener" class="btn btn-success btn-sm fw-bold py-2">
                <i class="bi bi-whatsapp me-1"></i> WhatsApp Support
              </a>
              <a href="mailto:support@zapbasket.store" class="btn btn-outline-dark btn-sm py-2">
                <i class="bi bi-envelope me-1"></i> Email Support
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .legal-wrap {
      max-width: 1200px;
      margin: 0 auto;
    }
    .legal-tab-btn {
      color: #495057;
      font-weight: 600;
      padding: 0.4rem 0.85rem;
      border-radius: 8px;
      border: none;
      background: transparent;
      transition: all 0.15s ease;
    }
    .legal-tab-btn:hover {
      background: #e9ecef;
      color: #212529;
    }
    .legal-tab-btn.active {
      background: #212529;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
    }
    .legal-doc {
      line-height: 1.65;
    }
  `],
})
export class LegalPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeTab = signal<LegalTab>('terms');

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const tab = params.get('tab') as LegalTab;
      if (tab && ['terms', 'privacy', 'refunds', 'contact', 'fssai'].includes(tab)) {
        this.activeTab.set(tab);
      }
    });

    // Check query params if any
    this.route.queryParamMap.subscribe((query) => {
      const tab = query.get('tab') as LegalTab;
      if (tab && ['terms', 'privacy', 'refunds', 'contact', 'fssai'].includes(tab)) {
        this.activeTab.set(tab);
      }
    });
  }

  setTab(tab: LegalTab) {
    this.activeTab.set(tab);
    void this.router.navigate(['/legal', tab]);
  }
}
