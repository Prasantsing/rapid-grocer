import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-auth-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrap">
      <section class="auth-story">
        <p class="eyebrow">ZapBasket</p>
        <h1>The 12-minute grocery run.</h1>
        <p>Bananas, milk, and a rider who already knows the yellow gate.</p>
      </section>
      <section class="auth-card">
        <form class="panel w-100" style="max-width: 440px" [formGroup]="form" (ngSubmit)="submit()">
          <h2>{{ mode() === 'register' ? 'Create an account' : 'Welcome back' }}</h2>
          @if (mode() === 'register') {
            <label class="form-label">Full Name</label>
            <input class="form-control mb-2" formControlName="name" placeholder="e.g. Rahul Sharma" autocomplete="name" />
            <label class="form-label">Mobile Number</label>
            <input class="form-control mb-2" formControlName="phone" placeholder="10-digit mobile (e.g. 9876543210)" autocomplete="tel" />
            <label class="form-label">Email Address</label>
            <input class="form-control mb-2" type="email" formControlName="email" placeholder="you@example.com" autocomplete="email" />
          } @else {
            <label class="form-label">Email or Mobile Number</label>
            <input class="form-control mb-2" formControlName="identifier" placeholder="e.g. 9876543210 or you@example.com" autocomplete="username" />
          }
          <label class="form-label">Password</label>
          <input class="form-control mb-2" type="password" formControlName="password" placeholder="••••••••" autocomplete="current-password" />
          @if (mode() === 'register') { <p class="muted">At least 8 characters, with a letter and a number.</p> }
          @if (error()) { <p class="text-danger my-2"><i class="bi bi-exclamation-circle me-1"></i>{{ error() }}</p> }
          <button class="btn btn-dark w-100 mt-2" type="submit" [disabled]="busy()">
            {{ busy() ? 'Please wait...' : (mode() === 'register' ? 'Create Account' : 'Log in') }}
          </button>
          @if (mode() === 'login') {
            <p class="mt-3 mb-2">New here? <a routerLink="/register">Create an account</a></p>
            <p class="eyebrow">Demo desks</p>
            <div class="demo-grid">
              <button class="choice" type="button" (click)="demo('aisha@zapbasket.dev', 'Customer@123')">Aisha · customer</button>
              <button class="choice" type="button" (click)="demo('admin@zapbasket.dev', 'Admin@12345')">Meera · admin</button>
              <button class="choice" type="button" (click)="demo('ravi@zapbasket.dev', 'Delivery@123')">Ravi · delivery</button>
            </div>
          } @else {
            <p class="mt-3">Already have an account? <a routerLink="/login">Log in</a></p>
          }
        </form>
      </section>
    </div>
  `,
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly mode = toSignal(this.route.data.pipe(map((data) => (data['mode'] as 'login' | 'register') || 'login')), { initialValue: 'login' as const });
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({
    name: [''],
    phone: [''],
    email: [''],
    identifier: [''],
    password: [''],
  });

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
          this.error.set('Password must be at least 8 characters.');
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
          this.error.set('Please enter your email or 10-digit mobile number.');
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

  demo(email: string, password: string) {
    this.form.patchValue({ identifier: email, email, password });
    void this.submit();
  }
}
