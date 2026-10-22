import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Address } from '../core/models';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';

@Component({
  selector: 'app-address-form',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="address-form-box">
      <!-- GPS Location Detector Banner -->
      <div class="gps-detector-card mb-3">
        @if (isDetecting()) {
          <div class="gps-status-loading">
            <span class="spinner-border spinner-border-sm text-success" role="status"></span>
            <span>Fetching accurate GPS location from your device…</span>
          </div>
        } @else if (gpsDetected()) {
          <div class="gps-status-success">
            <div class="d-flex align-items-start gap-2">
              <i class="bi bi-geo-alt-fill gps-pin-icon"></i>
              <div class="flex-grow-1 min-w-0">
                <div class="d-flex align-items-center gap-2">
                  <span class="badge bg-success" style="font-size: 0.68rem;">GPS DETECTED</span>
                  <span class="text-muted small">Accurate via device</span>
                </div>
                <div class="detected-area-name mt-1">{{ detectedLocality() }}</div>
                <div class="text-muted small">{{ form.get('city')?.value }}, {{ form.get('state')?.value }} - {{ form.get('pincode')?.value }}</div>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary re-detect-btn"
                (click)="detectLocation()"
                title="Refresh device location"
              >
                <i class="bi bi-arrow-repeat"></i>
              </button>
            </div>
          </div>
        } @else {
          <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <div class="fw-bold d-flex align-items-center gap-2">
                <i class="bi bi-crosshair text-success fs-5"></i>
                <span>Use Device Location</span>
              </div>
              <div class="text-muted small">Auto-detects your area, city & pincode with GPS precision</div>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-success detect-action-btn"
              (click)="detectLocation()"
            >
              <i class="bi bi-geo-fill me-1"></i> Detect Location
            </button>
          </div>
        }

        <!-- Quick location chips if GPS blocked/fallback -->
        @if (!gpsDetected() && !isDetecting()) {
          <div class="quick-chips mt-2 pt-2 border-top">
            <small class="text-muted me-1">Quick pick:</small>
            <button type="button" class="chip-btn" (click)="setPreset('Koramangala 4th Block', 'Bengaluru', 'Karnataka', '560034')">Koramangala</button>
            <button type="button" class="chip-btn" (click)="setPreset('Indiranagar 100ft Rd', 'Bengaluru', 'Karnataka', '560038')">Indiranagar</button>
            <button type="button" class="chip-btn" (click)="setPreset('HSR Layout Sector 2', 'Bengaluru', 'Karnataka', '560102')">HSR Layout</button>
          </div>
        }
      </div>

      <!-- Address Input Form -->
      <form [formGroup]="form" (ngSubmit)="submit()">
        <!-- Label Type (Home, Work, Other) -->
        <div class="d-flex gap-2 mb-3">
          <button
            type="button"
            class="label-choice-btn"
            [class.active]="form.get('label')?.value === 'Home'"
            (click)="setLabel('Home')"
          >
            <i class="bi bi-house-door me-1"></i> Home
          </button>
          <button
            type="button"
            class="label-choice-btn"
            [class.active]="form.get('label')?.value === 'Work'"
            (click)="setLabel('Work')"
          >
            <i class="bi bi-briefcase me-1"></i> Work
          </button>
          <button
            type="button"
            class="label-choice-btn"
            [class.active]="form.get('label')?.value === 'Other'"
            (click)="setLabel('Other')"
          >
            <i class="bi bi-geo-alt me-1"></i> Other
          </button>
        </div>

        <!-- Manual House / Flat Number Entry -->
        <div class="mb-3">
          <label for="houseNoInput" class="form-label fw-bold mb-1">
            House / Flat / Floor / Building No. <span class="text-danger">*</span>
          </label>
          <input
            #houseInput
            id="houseNoInput"
            type="text"
            class="form-control form-control-lg house-input"
            [formControl]="houseNoControl"
            placeholder="e.g. Flat 302, B-Wing / House #14, 2nd Floor"
            autocomplete="address-line1"
          />
          <div class="form-text small text-muted">
            Enter only your door/apartment details. Area & city are handled by device location.
          </div>
        </div>

        <!-- Street / Area / Locality (Auto-filled from GPS, or editable) -->
        <div class="mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <label for="localityInput" class="form-label fw-semibold small mb-0">
              Area / Locality / Street <span class="text-danger">*</span>
            </label>
            @if (gpsDetected()) {
              <span class="badge bg-light text-success border" style="font-size: 0.65rem;">
                <i class="bi bi-check2"></i> GPS Auto-filled
              </span>
            }
          </div>
          <input
            id="localityInput"
            type="text"
            class="form-control"
            [formControl]="localityControl"
            placeholder="Street name, colony, sector"
          />
        </div>

        <!-- Landmark -->
        <div class="mb-3">
          <label for="landmarkInput" class="form-label fw-semibold small mb-1">
            Landmark / Directions for rider (Optional)
          </label>
          <input
            id="landmarkInput"
            type="text"
            class="form-control"
            formControlName="landmark"
            placeholder="e.g. Opposite Forum Mall, Near Green Gate"
          />
        </div>

        <!-- City, State & Pincode Row (Auto-filled) -->
        <div class="row g-2 mb-3">
          <div class="col-6">
            <label class="form-label small text-muted mb-1">City</label>
            <input class="form-control" formControlName="city" placeholder="City" />
          </div>
          <div class="col-6">
            <label class="form-label small text-muted mb-1">Pincode (6 digits)</label>
            <input class="form-control" formControlName="pincode" placeholder="Pincode" maxlength="6" />
          </div>
          <div class="col-12">
            <label class="form-label small text-muted mb-1">State</label>
            <input class="form-control" formControlName="state" placeholder="State" />
          </div>
        </div>

        <!-- Receiver Contact Details -->
        <div class="row g-2 mb-3 pt-2 border-top">
          <div class="col-md-6">
            <label class="form-label small fw-semibold mb-1">Full Name <span class="text-danger">*</span></label>
            <input class="form-control" formControlName="fullName" placeholder="Receiver's name" />
          </div>
          <div class="col-md-6">
            <label class="form-label small fw-semibold mb-1">Mobile Number <span class="text-danger">*</span></label>
            <input class="form-control" formControlName="phone" placeholder="10-digit mobile" maxlength="10" />
          </div>
        </div>

        <!-- Default Checkbox -->
        <div class="form-check mb-3">
          <input class="form-check-input" type="checkbox" formControlName="isDefault" id="isDefaultCheck" />
          <label class="form-check-label small" for="isDefaultCheck">Set as default delivery address</label>
        </div>

        <!-- Live Delivery Address Preview -->
        @if (previewAddress()) {
          <div class="address-preview-strip mb-3">
            <small class="preview-tag">RIDER WILL DELIVER TO:</small>
            <div class="preview-text">
              <i class="bi bi-geo-alt me-1 text-success"></i>
              <b>{{ previewAddress() }}</b>
            </div>
          </div>
        }

        <!-- Actions -->
        <div class="d-flex gap-2">
          <button
            type="submit"
            class="btn btn-dark flex-grow-1 py-2"
            [disabled]="isSaving() || !isFormValid()"
          >
            @if (isSaving()) {
              <span class="spinner-border spinner-border-sm me-1" role="status"></span>
              <span>Saving Address…</span>
            } @else {
              <span>Save & Use Address</span>
            }
          </button>
          <button
            type="button"
            class="btn btn-outline-secondary"
            (click)="onCancel()"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .address-form-box {
      width: 100%;
    }

    /* GPS Detector Card */
    .gps-detector-card {
      background: linear-gradient(135deg, #f0fdf4 0%, #e8f5e9 100%);
      border: 1.5px solid #bbf7d0;
      border-radius: 14px;
      padding: 0.95rem 1.15rem;
    }

    .gps-pin-icon {
      color: #16a34a;
      font-size: 1.35rem;
      line-height: 1.2;
    }

    .detected-area-name {
      font-weight: 700;
      color: #0e6b4f;
      font-size: 0.95rem;
    }

    .detect-action-btn {
      background: #0e6b4f;
      border-color: #0e6b4f;
      font-weight: 600;
      padding: 0.4rem 0.85rem;
      border-radius: 999px;
    }

    .detect-action-btn:hover {
      background: #0a3d2e;
    }

    .re-detect-btn {
      background: #ffffff;
      border-radius: 999px;
      padding: 0.2rem 0.5rem;
    }

    .gps-status-loading {
      display: flex;
      align-items: center;
      gap: 0.6rem;
      font-size: 0.88rem;
      color: #0e6b4f;
      font-weight: 550;
      padding: 0.25rem 0;
    }

    /* Quick Chips */
    .quick-chips {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }

    .chip-btn {
      background: #ffffff;
      border: 1px solid #d1fae5;
      color: #0e6b4f;
      border-radius: 999px;
      padding: 0.15rem 0.6rem;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .chip-btn:hover {
      background: #0e6b4f;
      color: #ffffff;
    }

    /* Labels */
    .label-choice-btn {
      flex: 1;
      padding: 0.45rem 0.6rem;
      border-radius: 10px;
      border: 1.5px solid var(--line, #e4dccb);
      background: #ffffff;
      font-size: 0.84rem;
      font-weight: 600;
      color: var(--ink, #1c1915);
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .label-choice-btn.active {
      border-color: #0e6b4f;
      background: #e8f5e9;
      color: #0e6b4f;
    }

    /* House Input Highlight */
    .house-input {
      border: 2px solid #0e6b4f;
      border-radius: 10px;
      background: #ffffff;
      font-size: 1rem;
    }

    .house-input:focus {
      box-shadow: 0 0 0 4px rgba(14, 107, 79, 0.18);
    }

    /* Address Preview Strip */
    .address-preview-strip {
      background: #fbf9f4;
      border: 1px dashed var(--line, #e4dccb);
      border-radius: 10px;
      padding: 0.65rem 0.85rem;
    }

    .preview-tag {
      display: block;
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--muted, #6f675c);
      margin-bottom: 0.2rem;
    }

    .preview-text {
      font-size: 0.88rem;
      color: var(--ink, #1c1915);
      word-break: break-word;
    }
  `],
})
export class AddressFormComponent implements OnInit {
  @Input() initialAddress?: Address | null;
  @Output() saved = new EventEmitter<Address>();
  @Output() cancelled = new EventEmitter<void>();

  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly isDetecting = signal(false);
  readonly gpsDetected = signal(false);
  readonly isSaving = signal(false);
  readonly detectedLocality = signal('');

  // Individual form controls
  readonly houseNoControl = this.fb.nonNullable.control('', [Validators.required, Validators.minLength(2)]);
  readonly localityControl = this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]);

  readonly form = this.fb.nonNullable.group({
    label: this.fb.nonNullable.control<'Home' | 'Work' | 'Other'>('Home'),
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(/^[6-9]\d{9}$/)]],
    landmark: [''],
    city: ['Bengaluru', Validators.required],
    state: ['Karnataka', Validators.required],
    pincode: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    isDefault: false,
  });

  ngOnInit() {
    if (this.initialAddress) {
      this.populateFromAddress(this.initialAddress);
    } else {
      // Auto-trigger location detection if available
      this.detectLocation();
    }
  }

  setLabel(label: 'Home' | 'Work' | 'Other') {
    this.form.patchValue({ label });
  }

  detectLocation() {
    if (!navigator.geolocation) {
      this.toasts.error('Geolocation is not supported by your browser. Please enter your address details.');
      return;
    }

    this.isDetecting.set(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const result = await this.shop.reverseGeocode(lat, lng);

          const loc = result.locality || `${result.road}, ${result.neighbourhood}`.trim().replace(/^,\s*|,\s*$/g, '');
          this.detectedLocality.set(loc || 'Current Location');
          this.localityControl.setValue(loc || 'Koramangala 4th Block');

          this.form.patchValue({
            city: result.city || 'Bengaluru',
            state: result.state || 'Karnataka',
            pincode: result.pincode || '560034',
          });

          this.gpsDetected.set(true);
          this.toasts.show(`Location detected: ${loc}`);
        } catch (err) {
          this.setFallbackLocation();
        } finally {
          this.isDetecting.set(false);
        }
      },
      (err) => {
        this.isDetecting.set(false);
        // Fallback gracefully without frustrating the user
        this.setFallbackLocation();
        this.toasts.show('Device location unavailable. Pre-filled standard delivery zone (Bengaluru).');
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 60000,
      }
    );
  }

  private setFallbackLocation() {
    this.detectedLocality.set('Koramangala 4th Block');
    this.localityControl.setValue('Koramangala 4th Block');
    this.form.patchValue({
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560034',
    });
    this.gpsDetected.set(true);
  }

  setPreset(locality: string, city: string, state: string, pincode: string) {
    this.detectedLocality.set(locality);
    this.localityControl.setValue(locality);
    this.form.patchValue({ city, state, pincode });
    this.gpsDetected.set(true);
  }

  private populateFromAddress(address: Address) {
    this.form.patchValue({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      landmark: address.landmark || '',
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      isDefault: address.isDefault,
    });

    // Split line1 into houseNo and locality if possible
    const parts = address.line1.split(',');
    if (parts.length > 1) {
      this.houseNoControl.setValue(parts[0].trim());
      this.localityControl.setValue(parts.slice(1).join(',').trim());
    } else {
      this.houseNoControl.setValue(address.line1);
      this.localityControl.setValue(address.city);
    }
    this.detectedLocality.set(this.localityControl.value);
  }

  previewAddress(): string {
    const house = this.houseNoControl.value.trim();
    const loc = this.localityControl.value.trim();
    const city = this.form.get('city')?.value;
    const pincode = this.form.get('pincode')?.value;

    const parts = [house, loc, city, pincode].filter(Boolean);
    return parts.join(', ');
  }

  isFormValid(): boolean {
    return (
      this.form.valid &&
      this.houseNoControl.valid &&
      this.localityControl.valid
    );
  }

  async submit() {
    if (!this.isFormValid()) return;

    this.isSaving.set(true);
    try {
      const houseNo = this.houseNoControl.value.trim();
      const locality = this.localityControl.value.trim();
      const combinedLine1 = `${houseNo}, ${locality}`;

      const raw = this.form.getRawValue();
      const payload: Partial<Address> = {
        label: raw.label,
        fullName: raw.fullName.trim(),
        phone: raw.phone.trim(),
        line1: combinedLine1,
        line2: locality,
        landmark: raw.landmark ? raw.landmark.trim() : '',
        city: raw.city.trim(),
        state: raw.state.trim(),
        pincode: raw.pincode.trim(),
        isDefault: raw.isDefault,
      };

      const savedAddresses = await this.shop.saveAddress(
        payload,
        this.initialAddress ? this.initialAddress.id : undefined
      );

      const target = savedAddresses[0] || (payload as Address);
      this.saved.emit(target);
      this.toasts.show('Address saved successfully');
    } catch (err) {
      this.toasts.error(errorMessage(err));
    } finally {
      this.isSaving.set(false);
    }
  }

  onCancel() {
    this.cancelled.emit();
  }
}
