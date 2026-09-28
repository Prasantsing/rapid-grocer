import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    @if (auth.user(); as user) {
      <div class="section-head"><h2>Hello, {{ user.name.split(' ')[0] }}</h2></div>
      <div class="split">
        <form class="panel" [formGroup]="form" (ngSubmit)="save()">
          <label class="form-label">Name</label>
          <input class="form-control mb-2" formControlName="name" />
          <label class="form-label">Mobile</label>
          <input class="form-control mb-2" formControlName="phone" />
          <p class="muted">{{ user.email }} · {{ user.role }}</p>
          <button class="btn btn-dark" type="submit" [disabled]="form.invalid || busy()">Save</button>
        </form>
        <div class="panel">
          <a class="d-block py-2" routerLink="/orders">Order history</a>
          <a class="d-block py-2" routerLink="/addresses">Addresses</a>
          <a class="d-block py-2" routerLink="/wishlist">Wishlist</a>
          <a class="d-block py-2" routerLink="/notifications">Notifications</a>
          @if (user.role === 'admin') { <a class="d-block py-2" routerLink="/admin">Store desk</a> }
          @if (user.role === 'delivery') { <a class="d-block py-2" routerLink="/delivery">Delivery runs</a> }
          <button class="btn btn-outline-dark mt-3" type="button" (click)="logout()">Log out</button>
        </div>
      </div>
    } @else {
      <div class="empty panel">
        <h2>Sign in to see your basket</h2>
        <a class="btn btn-dark" routerLink="/login">Log in</a>
      </div>
    }
  `,
})
export class AccountPage {
  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);
  readonly busy = signal(false);
  readonly form = this.fb.nonNullable.group({
    name: [this.auth.user()?.name || '', [Validators.required, Validators.minLength(2)]],
    phone: [this.auth.user()?.phone || ''],
  });

  async save() {
    this.busy.set(true);
    try {
      await this.auth.updateProfile(this.form.getRawValue());
      this.toasts.show('Profile updated');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
    await this.router.navigate(['/']);
  }
}
