import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule],
  template: `
    <div class="section-head">
      <h2>People</h2>
      <button class="btn btn-dark" type="button" (click)="creating.set(true)">Add person</button>
    </div>
    <div class="d-flex gap-2 mb-3">
      <select class="form-select w-auto" (change)="filter($event)">
        <option value="">All roles</option>
        <option value="customer">Customers</option>
        <option value="delivery">Delivery</option>
        <option value="admin">Admins</option>
      </select>
    </div>
    <div class="panel table-wrap">
      <table class="plain">
        <thead><tr><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
        <tbody>
          @for (user of users(); track user.id) {
            <tr>
              <td>{{ user.name }}<div class="muted">{{ user.email }}</div></td>
              <td>{{ user.role }}</td>
              <td>{{ user.isActive ? 'Active' : 'Disabled' }}</td>
              <td class="text-end"><button class="btn btn-sm btn-outline-dark" type="button" (click)="edit(user)">Access</button></td>
            </tr>
          }
        </tbody>
      </table>
    </div>
    @if (creating()) {
      <div class="modal-sheet" (click)="creating.set(false)">
        <form class="sheet" [formGroup]="createForm" (click)="$event.stopPropagation()" (ngSubmit)="create()">
          <h3>New account</h3>
          <input class="form-control mb-2" placeholder="Name" formControlName="name" />
          <input class="form-control mb-2" placeholder="Email" formControlName="email" />
          <input class="form-control mb-2" placeholder="Mobile" formControlName="phone" />
          <input class="form-control mb-2" placeholder="Password" formControlName="password" />
          <select class="form-select mb-3" formControlName="role">
            <option value="delivery">Delivery partner</option>
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
          </select>
          <button class="btn btn-dark" type="submit" [disabled]="createForm.invalid">Create</button>
        </form>
      </div>
    }
    @if (selected(); as user) {
      <div class="modal-sheet" (click)="selected.set(null)">
        <form class="sheet" [formGroup]="editForm" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <h3>{{ user.name }}</h3>
          <p class="muted">Effective now: {{ user.permissions.join(', ') }}</p>
          <select class="form-select mb-2" formControlName="role">
            <option value="customer">Customer</option>
            <option value="delivery">Delivery</option>
            <option value="admin">Admin</option>
          </select>
          <div class="form-check mb-3">
            <input class="form-check-input" type="checkbox" id="userActive" formControlName="isActive" />
            <label class="form-check-label" for="userActive">Active</label>
          </div>
          <p class="eyebrow">Extra permissions</p>
          <div class="d-flex flex-wrap gap-2 mb-3">
            @for (permission of catalog(); track permission) {
              <button class="btn btn-sm" type="button" [class.btn-dark]="has('permissionGrants', permission)" [class.btn-outline-dark]="!has('permissionGrants', permission)" (click)="toggle('permissionGrants', permission)">{{ permission }}</button>
            }
          </div>
          <p class="eyebrow">Revoke</p>
          <div class="d-flex flex-wrap gap-2 mb-3">
            @for (permission of catalog(); track permission) {
              <button class="btn btn-sm" type="button" [class.btn-danger]="has('permissionRevokes', permission)" [class.btn-outline-dark]="!has('permissionRevokes', permission)" (click)="toggle('permissionRevokes', permission)">{{ permission }}</button>
            }
          </div>
          <button class="btn btn-dark" type="submit">Save access</button>
        </form>
      </div>
    }
  `,
})
export class AdminUsersPage {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly users = signal<User[]>([]);
  readonly catalog = signal<string[]>([]);
  readonly selected = signal<User | null>(null);
  readonly creating = signal(false);
  private role = '';
  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: 'delivery' as 'admin' | 'customer' | 'delivery',
  });
  readonly editForm = this.fb.nonNullable.group({
    role: 'customer' as 'admin' | 'customer' | 'delivery',
    isActive: true,
    permissionGrants: [[] as string[]],
    permissionRevokes: [[] as string[]],
  });

  constructor() {
    void this.load();
    void this.admin.permissions().then((data) => this.catalog.set(data.permissions));
  }

  filter(event: Event) {
    this.role = (event.target as HTMLSelectElement).value;
    void this.load();
  }

  edit(user: User) {
    this.selected.set(user);
    this.editForm.reset({
      role: user.role,
      isActive: user.isActive,
      permissionGrants: [...user.permissionGrants],
      permissionRevokes: [...user.permissionRevokes],
    });
  }

  has(field: 'permissionGrants' | 'permissionRevokes', permission: string) {
    return this.editForm.controls[field].value.includes(permission);
  }

  toggle(field: 'permissionGrants' | 'permissionRevokes', permission: string) {
    const current = new Set(this.editForm.controls[field].value);
    if (current.has(permission)) current.delete(permission);
    else current.add(permission);
    this.editForm.controls[field].setValue([...current]);
  }

  async create() {
    try {
      await this.admin.createUser(this.createForm.getRawValue());
      this.creating.set(false);
      this.createForm.reset({ role: 'delivery' });
      await this.load();
      this.toasts.show('Account created');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  async save() {
    const user = this.selected();
    if (!user) return;
    try {
      await this.admin.updateUser(user.id, this.editForm.getRawValue());
      this.selected.set(null);
      await this.load();
      this.toasts.show('Access updated');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async load() {
    this.users.set((await this.admin.users({ role: this.role })).items);
  }
}
