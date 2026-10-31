import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { ShopService } from '../core/shop.service';
import { errorMessage } from '../core/http-error';

interface DemoPersona {
  role: 'customer' | 'admin' | 'delivery';
  name: string;
  email: string;
  pass: string;
  label: string;
  badge: string;
  avatarEmoji: string;
}

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-page-container">
      <div class="auth-grid">
        <!-- Left Side: Brand Showcase & Trust Credentials -->
        <aside class="auth-showcase">
          <div class="showcase-content">
            <!-- Brand Badge -->
            <a routerLink="/" class="showcase-brand">
              <span class="brand-bolt">⚡</span>
              <span class="brand-title">ZapBasket</span>
            </a>

            <div class="showcase-hero">
              <div class="eyebrow-pill">
                <i class="bi bi-clock-history me-1"></i> 12-Minute Hyperlocal Delivery
              </div>
              <h1 class="showcase-heading">The fastest grocery run in Bengaluru.</h1>
              <p class="showcase-subhead">
                Handpicked farm-fresh produce, morning dairy, artisan bakery, and pantry staples delivered straight from our dark store network in minutes.
              </p>
            </div>

            <!-- Operational Proof Metric Cards -->
            <div class="metric-cards-grid">
              <div class="metric-card">
                <div class="metric-val text-accent">12m</div>
                <div class="metric-label">Average fulfillment</div>
                <div class="metric-detail">From click to your doorstep</div>
              </div>
              <div class="metric-card">
                <div class="metric-val text-accent">15k+</div>
                <div class="metric-label">Daily fresh orders</div>
                <div class="metric-detail">Dispatched across 25 nodes</div>
              </div>
              <div class="metric-card">
                <div class="metric-val text-accent">4.9 ★</div>
                <div class="metric-label">Customer score</div>
                <div class="metric-detail">Over 42,000+ happy homes</div>
              </div>
            </div>

            <!-- Freshness & Quality Pillars -->
            <div class="trust-pillars">
              <div class="pillar-item">
                <div class="pillar-icon"><i class="bi bi-shield-check"></i></div>
                <div>
                  <strong>100% Freshness Guarantee</strong>
                  <p>Not fresh? Instant no-questions-asked refund directly to your UPI.</p>
                </div>
              </div>
              <div class="pillar-item">
                <div class="pillar-icon"><i class="bi bi-thermometer-snow"></i></div>
                <div>
                  <strong>Cold-Chain Protected</strong>
                  <p>Insulated carrier bags keep milk, butter, and berries chilled en route.</p>
                </div>
              </div>
              <div class="pillar-item">
                <div class="pillar-icon"><i class="bi bi-box-seam"></i></div>
                <div>
                  <strong>Eco-Friendly Paper Bags</strong>
                  <p>Food-grade, biodegradable packaging with sealed tamper-evident tags.</p>
                </div>
              </div>
            </div>

            <!-- Customer Testimonial Social Proof -->
            <div class="customer-quote-box">
              <div class="quote-stars">
                <i class="bi bi-star-fill text-warning"></i>
                <i class="bi bi-star-fill text-warning"></i>
                <i class="bi bi-star-fill text-warning"></i>
                <i class="bi bi-star-fill text-warning"></i>
                <i class="bi bi-star-fill text-warning"></i>
              </div>
              <p class="quote-text">
                "ZapBasket delivers fresh coriander, bread, and milk before my chai even comes to a boil in the morning. Truly unmatched speed in Indiranagar."
              </p>
              <div class="quote-author">
                <span class="author-avatar">👩🏽</span>
                <div>
                  <div class="author-name">Priya N.</div>
                  <div class="author-meta">Verified Customer · Indiranagar</div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- Right Side: Professional Authentication Portal -->
        <main class="auth-form-card">
          <div class="form-wrapper">
            <!-- Header Top Bar -->
            <div class="form-top-nav">
              <a routerLink="/" class="back-link">
                <i class="bi bi-arrow-left"></i>
                <span>Back to Store</span>
              </a>
              <span class="ssl-chip">
                <i class="bi bi-shield-lock-fill text-success"></i> 256-Bit Encrypted
              </span>
            </div>

            <!-- Mode Segmented Control -->
            <div class="mode-segmented-control mb-4">
              <button
                type="button"
                class="segment-btn"
                [class.active]="mode() === 'login'"
                (click)="switchMode('login')"
              >
                <i class="bi bi-box-arrow-in-right me-1"></i> Sign In
              </button>
              <button
                type="button"
                class="segment-btn"
                [class.active]="mode() === 'register'"
                (click)="switchMode('register')"
              >
                <i class="bi bi-person-plus me-1"></i> Create Account
              </button>
            </div>

            <div class="form-header mb-4">
              <h2 class="form-title">
                {{ mode() === 'register' ? 'Join ZapBasket' : 'Welcome back' }}
              </h2>
              <p class="form-subtext">
                {{ mode() === 'register'
                  ? 'Sign up in seconds for rapid grocery drops & exclusive member savings.'
                  : 'Enter your credentials to access your basket, active deliveries, and saved items.' }}
              </p>
            </div>

            <!-- Error Banner -->
            @if (error()) {
              <div class="alert alert-danger d-flex align-items-center gap-2 mb-3 py-2 px-3 rounded-3" role="alert">
                <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
                <div class="small flex-grow-1">{{ error() }}</div>
                <button type="button" class="btn-close btn-close-sm" (click)="error.set('')" aria-label="Dismiss"></button>
              </div>
            }

            <!-- Form -->
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              @if (mode() === 'register') {
                <!-- Full Name Field -->
                <div class="form-field-group mb-3">
                  <label class="form-label fw-semibold text-dark" for="regName">Full Name</label>
                  <div class="input-icon-wrap">
                    <i class="bi bi-person field-icon"></i>
                    <input
                      id="regName"
                      class="form-control form-control-lg input-with-icon"
                      formControlName="name"
                      placeholder="e.g. Rahul Sharma"
                      autocomplete="name"
                    />
                  </div>
                </div>

                <!-- Mobile Number Field -->
                <div class="form-field-group mb-3">
                  <label class="form-label fw-semibold text-dark" for="regPhone">Mobile Number</label>
                  <div class="input-icon-wrap">
                    <span class="country-prefix">+91</span>
                    <input
                      id="regPhone"
                      class="form-control form-control-lg input-with-prefix"
                      formControlName="phone"
                      placeholder="98765 43210"
                      autocomplete="tel"
                      maxlength="10"
                    />
                  </div>
                  <span class="field-hint">Used for live SMS & WhatsApp delivery alerts.</span>
                </div>

                <!-- Email Address Field -->
                <div class="form-field-group mb-3">
                  <label class="form-label fw-semibold text-dark" for="regEmail">Email Address</label>
                  <div class="input-icon-wrap">
                    <i class="bi bi-envelope field-icon"></i>
                    <input
                      id="regEmail"
                      type="email"
                      class="form-control form-control-lg input-with-icon"
                      formControlName="email"
                      placeholder="rahul@example.com"
                      autocomplete="email"
                    />
                  </div>
                </div>
              } @else {
                <!-- Login Identifier Field -->
                <div class="form-field-group mb-3">
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="form-label fw-semibold text-dark mb-0" for="loginIdentifier">
                      Email or Mobile Number
                    </label>
                    <span class="text-muted small">Auto-detected</span>
                  </div>
                  <div class="input-icon-wrap">
                    <i class="bi bi-person-badge field-icon"></i>
                    <input
                      id="loginIdentifier"
                      class="form-control form-control-lg input-with-icon"
                      formControlName="identifier"
                      placeholder="e.g. 9876543210 or aisha@zapbasket.dev"
                      autocomplete="username"
                    />
                  </div>
                </div>
              }

              <!-- Password Field with Visibility Toggle -->
              <div class="form-field-group mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label fw-semibold text-dark mb-0" for="authPassword">Password</label>
                  @if (mode() === 'login') {
                    <span class="text-muted small">Forgot password? Use demo credentials</span>
                  }
                </div>
                <div class="input-icon-wrap">
                  <i class="bi bi-lock field-icon"></i>
                  <input
                    id="authPassword"
                    [type]="showPassword() ? 'text' : 'password'"
                    class="form-control form-control-lg input-with-icon input-with-eye"
                    formControlName="password"
                    placeholder="Enter your account password"
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="eye-toggle-btn"
                    (click)="togglePassword()"
                    [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                  >
                    <i [class]="showPassword() ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'"></i>
                  </button>
                </div>
                @if (mode() === 'register') {
                  <span class="field-hint">Must contain at least 8 characters with a letter and number.</span>
                }
              </div>

              <!-- Primary Submit CTA -->
              <button
                class="btn btn-primary btn-lg w-100 py-3 fw-bold submit-btn mt-2"
                type="submit"
                [disabled]="busy()"
              >
                @if (busy()) {
                  <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                  <span>Verifying credentials…</span>
                } @else {
                  <span>
                    {{ mode() === 'register' ? 'Create Free Account' : 'Sign In to ZapBasket' }}
                    <i class="bi bi-arrow-right ms-1"></i>
                  </span>
                }
              </button>
            </form>

            <!-- Mode Switch Prompt -->
            <div class="text-center mt-3 pt-2">
              @if (mode() === 'login') {
                <span class="text-muted small">New to ZapBasket?</span>
                <a class="fw-bold text-decoration-none text-primary ms-1 small" (click)="switchMode('register')" href="javascript:void(0)">
                  Create an account
                </a>
              } @else {
                <span class="text-muted small">Already have an account?</span>
                <a class="fw-bold text-decoration-none text-primary ms-1 small" (click)="switchMode('login')" href="javascript:void(0)">
                  Sign In instead
                </a>
              }
            </div>

            <!-- Quick Demo Desk Roles Switcher (Toggleable for Public Customers) -->
            @if (mode() === 'login' && isDemoAllowed()) {
              <div class="demo-personas-section mt-4 pt-3 border-top">
                <div class="d-flex align-items-center justify-content-between mb-2">
                  <button
                    type="button"
                    class="btn btn-sm btn-link text-decoration-none text-muted p-0 d-flex align-items-center gap-1"
                    (click)="toggleDemoAccounts()"
                  >
                    <i class="bi bi-shield-lock text-warning"></i>
                    <span class="fw-semibold small text-dark">Testing roles? Tap to reveal demo accounts</span>
                    <i [class]="showDemoAccounts() ? 'bi bi-chevron-up ms-1' : 'bi bi-chevron-down ms-1'"></i>
                  </button>
                  <span class="badge bg-light text-muted border small">{{ showDemoAccounts() ? 'Active' : 'Hidden' }}</span>
                </div>

                @if (showDemoAccounts()) {
                  <p class="text-secondary small mb-3">
                    Click any demo persona to automatically populate verified credentials across customer, admin, or delivery portals:
                  </p>

                  <div class="demo-chips-grid">
                    @for (persona of demoPersonas; track persona.email) {
                      <button
                        type="button"
                        class="demo-persona-chip"
                        [class.active]="selectedDemo() === persona.email"
                        (click)="selectDemoPersona(persona)"
                      >
                        <div class="persona-avatar">{{ persona.avatarEmoji }}</div>
                        <div class="persona-info">
                          <div class="persona-name-row">
                            <span class="persona-name">{{ persona.name }}</span>
                            <span class="persona-badge" [class]="persona.role">{{ persona.badge }}</span>
                          </div>
                          <div class="persona-email">{{ persona.email }}</div>
                        </div>
                        <div class="persona-arrow">
                          <i class="bi bi-box-arrow-in-right"></i>
                        </div>
                      </button>
                    }
                  </div>
                }
              </div>
            }

            <!-- Trust Credentials & Security Guarantee Footer -->
            <div class="auth-footer mt-4 pt-3 border-top text-center text-muted">
              <div class="d-flex align-items-center justify-content-center gap-3 mb-2 small text-secondary">
                <span><i class="bi bi-shield-check text-success me-1"></i> PCI-DSS Compliant</span>
                <span>•</span>
                <span><i class="bi bi-lock-fill text-primary me-1"></i> 256-Bit SSL</span>
                <span>•</span>
                <span><i class="bi bi-lightning-charge-fill text-warning me-1"></i> Instant Sync</span>
              </div>
              <p class="legal-notice mb-0">
                By continuing, you agree to ZapBasket's
                <a routerLink="/terms" class="text-decoration-underline text-secondary">Terms of Service</a>
                and
                <a routerLink="/privacy" class="text-decoration-underline text-secondary">Privacy Policy</a>.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .auth-page-container {
      min-height: 100vh;
      background: #fbf9f4;
      display: flex;
      flex-direction: column;
    }

    .auth-grid {
      display: grid;
      grid-template-columns: 1fr;
      min-height: 100vh;
      width: 100%;
    }

    @media (min-width: 992px) {
      .auth-grid {
        grid-template-columns: 1.05fr 0.95fr;
      }
    }

    /* Left Showcase Styling */
    .auth-showcase {
      background: linear-gradient(160deg, #072a20 0%, #0d4a37 50%, #0a3728 100%);
      color: #f6f1e4;
      padding: 3rem 3.5rem;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .auth-showcase::before {
      content: '';
      position: absolute;
      top: -150px;
      right: -150px;
      width: 450px;
      height: 450px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(240, 180, 41, 0.12) 0%, transparent 70%);
      pointer-events: none;
    }

    .auth-showcase::after {
      content: '';
      position: absolute;
      bottom: -100px;
      left: -100px;
      width: 400px;
      height: 400px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(14, 107, 79, 0.4) 0%, transparent 70%);
      pointer-events: none;
    }

    .showcase-content {
      position: relative;
      z-index: 2;
      max-width: 580px;
      margin: 0 auto;
    }

    .showcase-brand {
      display: inline-flex;
      align-items: center;
      gap: 0.6rem;
      text-decoration: none;
      color: #ffffff;
      margin-bottom: 2.5rem;
    }

    .brand-bolt {
      width: 38px;
      height: 38px;
      background: #f0b429;
      color: #1c1915;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 1.25rem;
      box-shadow: 0 4px 12px rgba(240, 180, 41, 0.35);
    }

    .brand-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.6rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .eyebrow-pill {
      display: inline-flex;
      align-items: center;
      background: rgba(240, 180, 41, 0.15);
      border: 1px solid rgba(240, 180, 41, 0.3);
      color: #f0b429;
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      margin-bottom: 1.25rem;
    }

    .showcase-heading {
      font-family: 'Fraunces', Georgia, serif;
      font-size: clamp(2rem, 3.4vw, 3rem);
      line-height: 1.15;
      letter-spacing: -0.03em;
      margin-bottom: 1rem;
      color: #ffffff;
    }

    .showcase-subhead {
      font-size: 1.05rem;
      line-height: 1.6;
      color: rgba(246, 241, 228, 0.82);
      margin-bottom: 2.25rem;
    }

    .metric-cards-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
      margin-bottom: 2.25rem;
    }

    .metric-card {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(8px);
      border-radius: 16px;
      padding: 1rem 1.1rem;
    }

    .metric-val {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.7rem;
      font-weight: 700;
      color: #f0b429;
      line-height: 1;
      margin-bottom: 0.3rem;
    }

    .metric-label {
      font-weight: 600;
      font-size: 0.82rem;
      color: #ffffff;
      margin-bottom: 0.15rem;
    }

    .metric-detail {
      font-size: 0.7rem;
      color: rgba(246, 241, 228, 0.65);
    }

    .trust-pillars {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
      padding-top: 1.5rem;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .pillar-item {
      display: flex;
      align-items: flex-start;
      gap: 0.85rem;
    }

    .pillar-icon {
      width: 32px;
      height: 32px;
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.1);
      display: grid;
      place-items: center;
      color: #f0b429;
      font-size: 1rem;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .pillar-item strong {
      display: block;
      font-size: 0.92rem;
      color: #ffffff;
      margin-bottom: 0.15rem;
    }

    .pillar-item p {
      font-size: 0.8rem;
      color: rgba(246, 241, 228, 0.7);
      margin: 0;
      line-height: 1.4;
    }

    .customer-quote-box {
      background: rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      padding: 1.25rem;
    }

    .quote-stars {
      display: flex;
      gap: 3px;
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
    }

    .quote-text {
      font-style: italic;
      font-size: 0.86rem;
      line-height: 1.5;
      color: rgba(246, 241, 228, 0.9);
      margin-bottom: 0.85rem;
    }

    .quote-author {
      display: flex;
      align-items: center;
      gap: 0.65rem;
    }

    .author-avatar {
      font-size: 1.4rem;
    }

    .author-name {
      font-weight: 600;
      font-size: 0.82rem;
      color: #ffffff;
    }

    .author-meta {
      font-size: 0.72rem;
      color: rgba(246, 241, 228, 0.6);
    }

    /* Right Form Side */
    .auth-form-card {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2.5rem 1.5rem;
      background: #fbf9f4;
    }

    .form-wrapper {
      width: 100%;
      max-width: 460px;
      background: #ffffff;
      border: 1px solid #e8e3d6;
      border-radius: 24px;
      box-shadow: 0 10px 30px rgba(28, 25, 21, 0.05);
      padding: 2.25rem 2rem;
    }

    @media (max-width: 576px) {
      .auth-form-card {
        padding: 1.25rem 0.85rem;
      }
      .form-wrapper {
        padding: 1.75rem 1.25rem;
        border-radius: 20px;
      }
      .auth-showcase {
        padding: 2rem 1.25rem;
      }
      .metric-cards-grid {
        grid-template-columns: 1fr;
        gap: 0.65rem;
      }
    }

    .form-top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.5rem;
    }

    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      color: #555047;
      text-decoration: none;
      font-size: 0.84rem;
      font-weight: 600;
      transition: color 0.15s ease;
    }

    .back-link:hover {
      color: #0e6b4f;
    }

    .ssl-chip {
      font-size: 0.75rem;
      color: #555047;
      background: #f3efe4;
      padding: 0.25rem 0.65rem;
      border-radius: 999px;
      font-weight: 500;
    }

    .mode-segmented-control {
      display: flex;
      background: #f3efe4;
      padding: 4px;
      border-radius: 14px;
      gap: 4px;
    }

    .segment-btn {
      flex: 1;
      border: 0;
      background: transparent;
      color: #6a6458;
      font-weight: 600;
      font-size: 0.88rem;
      padding: 0.65rem 0.5rem;
      border-radius: 11px;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .segment-btn.active {
      background: #ffffff;
      color: #1c1915;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .form-title {
      font-family: 'Fraunces', Georgia, serif;
      font-size: 1.85rem;
      font-weight: 700;
      color: #1c1915;
      letter-spacing: -0.02em;
      margin-bottom: 0.35rem;
    }

    .form-subtext {
      color: #6a6458;
      font-size: 0.88rem;
      line-height: 1.5;
      margin: 0;
    }

    .input-icon-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }

    .field-icon {
      position: absolute;
      left: 1rem;
      color: #8c8577;
      font-size: 1.1rem;
      pointer-events: none;
    }

    .country-prefix {
      position: absolute;
      left: 1rem;
      font-weight: 700;
      color: #1c1915;
      font-size: 0.95rem;
      pointer-events: none;
    }

    .input-with-icon {
      padding-left: 2.75rem !important;
      font-size: 1rem !important;
      border-radius: 12px;
      border: 1px solid #d9d2c2;
      background: #faf8f5;
    }

    .input-with-prefix {
      padding-left: 3.5rem !important;
      font-size: 1rem !important;
      border-radius: 12px;
      border: 1px solid #d9d2c2;
      background: #faf8f5;
      font-weight: 600;
    }

    .input-with-eye {
      padding-right: 3rem !important;
    }

    .input-with-icon:focus,
    .input-with-prefix:focus {
      background: #ffffff;
      border-color: #0e6b4f;
      box-shadow: 0 0 0 3px rgba(14, 107, 79, 0.14);
    }

    .eye-toggle-btn {
      position: absolute;
      right: 0.75rem;
      background: transparent;
      border: 0;
      color: #6a6458;
      font-size: 1.15rem;
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      cursor: pointer;
      transition: color 0.15s ease;
    }

    .eye-toggle-btn:hover {
      color: #0e6b4f;
      background: rgba(14, 107, 79, 0.06);
    }

    .field-hint {
      display: block;
      font-size: 0.75rem;
      color: #7b7466;
      margin-top: 0.35rem;
    }

    .submit-btn {
      background: #0e6b4f;
      border-color: #0e6b4f;
      border-radius: 14px;
      font-size: 1rem;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .submit-btn:hover:not(:disabled) {
      background: #0b543d;
      border-color: #0b543d;
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(14, 107, 79, 0.28);
    }

    /* Demo Personas */
    .demo-chips-grid {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .demo-persona-chip {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.7rem 0.9rem;
      border-radius: 14px;
      border: 1px solid #e3decb;
      background: #fdfcf9;
      text-align: left;
      cursor: pointer;
      transition: all 0.15s ease;
      width: 100%;
    }

    .demo-persona-chip:hover {
      background: #f4efe1;
      border-color: #0e6b4f;
      transform: translateX(2px);
    }

    .demo-persona-chip.active {
      background: #e8f6ef;
      border-color: #0e6b4f;
      box-shadow: 0 2px 8px rgba(14, 107, 79, 0.1);
    }

    .persona-avatar {
      font-size: 1.4rem;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: #ffffff;
      display: grid;
      place-items: center;
      border: 1px solid #e8e3d6;
      flex-shrink: 0;
    }

    .persona-info {
      flex: 1;
      min-width: 0;
    }

    .persona-name-row {
      display: flex;
      align-items: center;
      gap: 0.45rem;
      margin-bottom: 2px;
    }

    .persona-name {
      font-weight: 700;
      font-size: 0.88rem;
      color: #1c1915;
    }

    .persona-badge {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      padding: 2px 6px;
      border-radius: 999px;
    }

    .persona-badge.customer {
      background: #e3f2fd;
      color: #0d47a1;
    }

    .persona-badge.admin {
      background: #fce4ec;
      color: #880e4f;
    }

    .persona-badge.delivery {
      background: #fff3e0;
      color: #e65100;
    }

    .persona-email {
      font-size: 0.76rem;
      color: #7b7466;
      font-family: monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .persona-arrow {
      color: #8c8577;
      font-size: 1rem;
      transition: transform 0.15s ease;
    }

    .demo-persona-chip:hover .persona-arrow {
      color: #0e6b4f;
      transform: translateX(2px);
    }

    .legal-notice {
      font-size: 0.73rem;
      line-height: 1.4;
    }
  `]
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  readonly mode = toSignal(
    this.route.data.pipe(map((data) => (data['mode'] as 'login' | 'register') || 'login')),
    { initialValue: 'login' as const }
  );

  readonly busy = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly selectedDemo = signal<string | null>(null);
  readonly showDemoAccounts = signal(false);

  constructor() {
    void this.shop.loadStoreConfig();
  }

  isDemoAllowed(): boolean {
    return this.shop.storeConfig()?.showDemoAccountsOnLogin !== false;
  }

  readonly demoPersonas: DemoPersona[] = [
    {
      role: 'customer',
      name: 'Aisha Sharma',
      email: 'aisha@zapbasket.dev',
      pass: 'Customer@123',
      label: 'Verified Shopper',
      badge: 'Customer',
      avatarEmoji: '🛒',
    },
    {
      role: 'admin',
      name: 'Meera Rao',
      email: 'admin@zapbasket.dev',
      pass: 'Admin@12345',
      label: 'Store Operations Lead',
      badge: 'Store Admin',
      avatarEmoji: '⚡',
    },
    {
      role: 'delivery',
      name: 'Ravi Kumar',
      email: 'ravi@zapbasket.dev',
      pass: 'Delivery@123',
      label: 'Express Rider Partner',
      badge: 'Delivery Rider',
      avatarEmoji: '🛵',
    },
  ];

  readonly form = this.fb.nonNullable.group({
    name: [''],
    phone: [''],
    email: [''],
    identifier: [''],
    password: [''],
  });

  togglePassword() {
    this.showPassword.update((val) => !val);
  }

  toggleDemoAccounts() {
    this.showDemoAccounts.update((val) => !val);
  }

  switchMode(target: 'login' | 'register') {
    this.error.set('');
    void this.router.navigate([target], {
      queryParamsHandling: 'preserve',
    });
  }

  selectDemoPersona(persona: DemoPersona) {
    this.selectedDemo.set(persona.email);
    this.form.patchValue({
      identifier: persona.email,
      email: persona.email,
      password: persona.pass,
    });
    this.error.set('');
  }

  async submit() {
    this.error.set('');
    this.busy.set(true);
    try {
      const val = this.form.getRawValue();
      const isRegister = this.mode() === 'register';

      if (isRegister) {
        const name = val.name.trim();
        const email = val.email.trim();
        const phone = val.phone.trim();
        const password = val.password;

        if (!name || name.length < 2) {
          this.error.set('Please enter your full name (at least 2 characters).');
          this.busy.set(false);
          return;
        }
        if (!email || !email.includes('@')) {
          this.error.set('Please enter a valid email address.');
          this.busy.set(false);
          return;
        }
        if (!password || password.length < 8) {
          this.error.set('Password must be at least 8 characters with letters & numbers.');
          this.busy.set(false);
          return;
        }

        const user = await this.auth.register({ name, email, phone, password });
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const target = user.role === 'customer' && returnUrl ? returnUrl : this.auth.homeFor(user.role);
        await this.router.navigateByUrl(target);
      } else {
        const identifier = (val.identifier || val.email).trim();
        const password = val.password;

        if (!identifier) {
          this.error.set('Please enter your registered email or 10-digit mobile number.');
          this.busy.set(false);
          return;
        }
        if (!password) {
          this.error.set('Please enter your password.');
          this.busy.set(false);
          return;
        }

        const user = await this.auth.login(identifier, password);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        const target = user.role === 'customer' && returnUrl ? returnUrl : this.auth.homeFor(user.role);
        await this.router.navigateByUrl(target);
      }
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
