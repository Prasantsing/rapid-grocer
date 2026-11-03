import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-admin-users',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-users.page.html',
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
