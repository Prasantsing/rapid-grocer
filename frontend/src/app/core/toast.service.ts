import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'bad';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<Toast[]>([]);
  private nextId = 1;

  show(text: string, kind: 'ok' | 'bad' = 'ok') {
    const id = this.nextId++;
    this.messages.update((items) => [...items, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), 3800);
  }

  error(text: string) {
    this.show(text, 'bad');
  }

  dismiss(id: number) {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
}
