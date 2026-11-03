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
  templateUrl: './address-form.component.html',
  styleUrl: './address-form.component.scss',
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
