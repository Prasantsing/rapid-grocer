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
  templateUrl: './auth.page.html',
  styleUrl: './auth.page.scss'
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
