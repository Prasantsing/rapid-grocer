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
            <label class="form-label">Name</label>
            <input class="form-control mb-2" formControlName="name" />
            <label class="form-label">Mobile</label>
            <input class="form-control mb-2" formControlName="phone" placeholder="10-digit mobile" />
          }
          <label class="form-label">Email</label>
          <input class="form-control mb-2" type="email" formControlName="email" />
          <label class="form-label">Password</label>
          <input class="form-control mb-2" type="password" formControlName="password" />
          @if (mode() === 'register') { <p class="muted">At least 8 characters, with a letter and a number.</p> }
          @if (error()) { <p class="text-danger">{{ error() }}</p> }
          <button class="btn btn-dark w-100" type="submit" [disabled]="busy()">{{ mode() === 'register' ? 'Register' : 'Log in' }}</button>
          @if (mode() === 'login') {
            <p class="mt-3 mb-2">New here? <a routerLink="/register">Create an account</a></p>
            <p class="eyebrow">Demo desks</p>
            <div class="demo-grid">
              <button class="choice" type="button" (click)="demo('aisha@zapbasket.dev', 'Customer@123')">Aisha · customer</button>
              <button class="choice" type="button" (click)="demo('admin@zapbasket.dev', 'Admin@12345')">Meera · admin</button>
              <button class="choice" type="button" (click)="demo('ravi@zapbasket.dev', 'Delivery@123')">Ravi · delivery</button>
            </div>
          } @else {
            <p class="mt-3">Already shopping? <a routerLink="/login">Log in</a></p>
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
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async submit() {
    this.error.set('');
    this.busy.set(true);
    try {
      const value = this.form.getRawValue();
      const user = this.mode() === 'register'
        ? await this.auth.register(value)
        : await this.auth.login(value.email, value.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      const target = user.role === 'customer' && returnUrl ? returnUrl : this.auth.homeFor(user.role);
      await this.router.navigateByUrl(target);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  demo(email: string, password: string) {
    this.form.patchValue({ email, password });
    void this.submit();
  }
}
