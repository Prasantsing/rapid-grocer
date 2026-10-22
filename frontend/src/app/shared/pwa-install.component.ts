import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PwaService } from '../core/pwa.service';

@Component({
  selector: 'app-pwa-install',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (!pwa.isInstalled() && (pwa.canInstall() || pwa.isIOS())) {
      <button
        type="button"
        class="install-app-btn"
        (click)="pwa.promptInstall()"
        aria-label="Install ZapBasket App"
      >
        <i class="bi bi-download"></i>
        <span>Install App</span>
      </button>
    }

    @if (pwa.showIOSGuide()) {
      <div class="ios-install-backdrop" (click)="pwa.dismissIOSGuide()">
        <div class="ios-install-modal" (click)="$event.stopPropagation()">
          <div class="ios-modal-header">
            <span class="ios-icon">📲</span>
            <h5>Install ZapBasket on iOS</h5>
            <button type="button" class="close-btn" (click)="pwa.dismissIOSGuide()">×</button>
          </div>
          <div class="ios-modal-body">
            <p>Enjoy the fastest full-screen experience right from your home screen:</p>
            <ol>
              <li>Tap the <strong>Share</strong> button <i class="bi bi-box-arrow-up text-primary"></i> in Safari's toolbar.</li>
              <li>Scroll down and select <strong>Add to Home Screen</strong> <i class="bi bi-plus-square"></i>.</li>
              <li>Tap <strong>Add</strong> in the top-right corner.</li>
            </ol>
          </div>
          <div class="ios-modal-footer">
            <button type="button" class="btn btn-primary w-100" (click)="pwa.dismissIOSGuide()">Got it!</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .install-app-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: linear-gradient(135deg, #0e6b4f 0%, #16a34a 100%);
      color: #ffffff;
      border: none;
      border-radius: 999px;
      padding: 0.45rem 0.85rem;
      font-size: 0.82rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(14, 107, 79, 0.25);
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .install-app-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(14, 107, 79, 0.35);
    }
    .install-app-btn i {
      font-size: 0.95rem;
    }
    .ios-install-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(14, 25, 20, 0.6);
      backdrop-filter: blur(4px);
      display: grid;
      place-items: center;
      z-index: 9999;
      padding: 1rem;
    }
    .ios-install-modal {
      background: #ffffff;
      color: #1c1915;
      border-radius: 20px;
      padding: 1.5rem;
      max-width: 380px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.25);
      animation: popIn 0.25s ease-out;
    }
    .ios-modal-header {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      position: relative;
    }
    .ios-icon {
      font-size: 1.8rem;
    }
    .ios-modal-header h5 {
      margin: 0;
      font-weight: 700;
      font-size: 1.15rem;
    }
    .close-btn {
      position: absolute;
      right: -0.5rem;
      top: -0.5rem;
      background: none;
      border: none;
      font-size: 1.6rem;
      cursor: pointer;
      color: #6b7280;
    }
    .ios-modal-body {
      margin: 1rem 0;
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .ios-modal-body ol {
      padding-left: 1.25rem;
      margin-bottom: 0;
      display: grid;
      gap: 0.5rem;
    }
    @keyframes popIn {
      from { transform: scale(0.92); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `]
})
export class PwaInstallComponent {
  readonly pwa = inject(PwaService);
}
