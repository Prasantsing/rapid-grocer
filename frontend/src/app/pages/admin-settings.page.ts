import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';
import { StoreConfig, MessageLog, PushSummaryResponse } from '../core/models';
import { RouterLink } from '@angular/router';
import { InrPipe } from '../shared/inr.pipe';
import { errorMessage } from '../core/http-error';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-admin-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './admin-settings.page.html',
})
export class AdminSettingsPage implements OnInit {
  private readonly shop = inject(ShopService);
  private readonly toasts = inject(ToastService);
  readonly themeService = inject(ThemeService);

  readonly config = signal<StoreConfig | null>(null);
  readonly isLoading = signal(true);
  readonly isSaving = signal(false);

  selectedThemePreset = 'emerald';
  themePrimaryColor = '#059669';
  themeAccentColor = '#ea580c';

  formData: any = {
    isOpen: true,
    closedReason: '',
    openingTime: '07:00',
    closingTime: '23:00',
    logoUrl: 'brand-logo-white.svg',
    deliveryRadiusKm: 8.0,
    minOrderAmount: 99,
    freeDeliveryThreshold: 299,
    deliveryFee: 25,
    allowCustomerCancellation: true,
    cancellationWindowMinutes: 3,
    allowDirectRiderContact: true,
    nonReturnableNotice: 'Perishable groceries (fresh produce, dairy, bakery) cannot be returned once delivered.',
    enableSmsAlerts: true,
    enableWhatsAppAlerts: true,
    smsProvider: 'fast2sms',
    smsSenderId: 'ZAPBKT',
    smsApiKey: '',
    whatsAppProvider: 'meta',
    whatsAppApiKey: '',
    whatsAppPhoneNumberId: '',
    whatsAppFromNumber: '+91 9101516662',
    upiVpa: '9101516662@ybl',
    payeeName: 'ZapBasket',
    webhookSecret: 'zb_webhook_secret_live',
    supportPhone: '+91 9101516662',
    supportEmail: 'support@zapbasket.store',
    fssaiLicense: '11224333000542',
    showDemoAccountsOnLogin: true,
    storeLocation: {
      lat: 12.9352,
      lng: 77.6245,
      address: 'Koramangala 4th Block, Bengaluru, Karnataka 560034',
    },
  };

  choosePreset(presetId: string) {
    this.selectedThemePreset = presetId;
    const preset = this.themeService.presets.find((p) => p.id === presetId);
    if (preset) {
      this.themePrimaryColor = preset.primary;
      this.themeAccentColor = preset.accent;
      this.themeService.applyPaletteToDom(preset.primary, preset.accent);
    }
  }

  onPrimaryColorChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.selectedThemePreset = 'custom';
    this.themePrimaryColor = val;
    this.themeService.applyPaletteToDom(val, this.themeAccentColor);
  }

  onPrimaryHexChange(event: Event) {
    const val = (event.target as HTMLInputElement).value.trim();
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(val)) {
      this.selectedThemePreset = 'custom';
      this.themePrimaryColor = val;
      this.themeService.applyPaletteToDom(val, this.themeAccentColor);
    }
  }

  onAccentColorChange(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.selectedThemePreset = 'custom';
    this.themeAccentColor = val;
    this.themeService.applyPaletteToDom(this.themePrimaryColor, val);
  }

  onAccentHexChange(event: Event) {
    const val = (event.target as HTMLInputElement).value.trim();
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(val)) {
      this.selectedThemePreset = 'custom';
      this.themeAccentColor = val;
      this.themeService.applyPaletteToDom(this.themePrimaryColor, val);
    }
  }

  resetDefaultTheme() {
    this.choosePreset('emerald');
    this.toasts.show('Reset to default Emerald Velocity theme.');
  }

  testCoords = '12.9352, 77.6245';
  readonly testResult = signal<{ distanceKm: number; eligible: boolean } | null>(null);

  // Auto-detect store location state
  readonly isDetectingLocation = signal(false);
  readonly detectedLocationInfo = signal<{
    lat: number;
    lng: number;
    accuracy: number;
    timestamp: string;
    addressResolved?: string;
  } | null>(null);
  readonly locationDetectionError = signal<string | null>(null);

  readonly logoInputMode = signal<'upload' | 'url'>('upload');
  readonly logoPreview = signal<string>('brand-logo-white.svg');
  readonly isUploadingLogo = signal<boolean>(false);

  onLogoFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toasts.error('Please select an image file (PNG, JPG, SVG, WebP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toasts.error('File size must be under 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      this.logoPreview.set(result);
      this.formData.logoUrl = result;
      this.toasts.show('Logo loaded! Click "Save Changes" to apply across the store.');
    };
    reader.readAsDataURL(file);
    input.value = '';
  }

  onLogoUrlChange(url: string) {
    if (url && url.trim()) {
      this.logoPreview.set(url.trim());
    } else {
      this.logoPreview.set('brand-logo-white.svg');
    }
  }

  setLogoPreset(url: string) {
    this.formData.logoUrl = url;
    this.logoPreview.set(url);
    this.toasts.show(`Selected preset: ${url}`);
  }

  resetDefaultLogo() {
    this.formData.logoUrl = 'brand-logo-white.svg';
    this.logoPreview.set('brand-logo-white.svg');
    this.toasts.show('Reset to official minimalist emerald ZapBasket logo.');
  }

  onLogoImgError(event: Event) {
    const img = event.target as HTMLImageElement;
    if (img && !img.src.includes('brand-logo-white.svg')) {
      img.src = 'brand-logo-white.svg';
    }
  }

  testPhone = '+91 9101516662';
  testChannel: 'sms' | 'whatsapp' | 'push' = 'push';
  readonly isTestingAlert = signal(false);
  readonly testAlertResult = signal<string | null>(null);

  readonly pushSummary = signal<PushSummaryResponse | null>(null);
  readonly isLoadingPushSummary = signal(false);
  readonly isBroadcastingPromo = signal(false);
  readonly promoBroadcastResult = signal<string | null>(null);

  promoForm = {
    title: '⚡ Flash Offer: 25% Off Fresh Fruits',
    body: 'Stock up your basket with farm-fresh apples, bananas & berries before 8 PM!',
    couponCode: 'FRUIT25',
    link: '/categories',
  };

  readonly showLogs = signal(false);
  readonly messageLogs = signal<MessageLog[]>([]);
  readonly isLoadingLogs = signal(false);

  ngOnInit() {
    void this.loadConfig();
    void this.loadPushSummary();
  }

  async loadPushSummary() {
    this.isLoadingPushSummary.set(true);
    try {
      const summary = await this.shop.getPushSummary();
      this.pushSummary.set(summary);
    } catch (err) {
      console.warn('Could not load push summary:', err);
    } finally {
      this.isLoadingPushSummary.set(false);
    }
  }

  async broadcastPromoPush() {
    if (!this.promoForm.title || !this.promoForm.body) {
      this.toasts.error('Please enter a title and message body for the push broadcast');
      return;
    }
    this.isBroadcastingPromo.set(true);
    this.promoBroadcastResult.set(null);
    try {
      const res = await this.shop.broadcastPromo({
        title: this.promoForm.title,
        body: this.promoForm.body,
        couponCode: this.promoForm.couponCode || undefined,
        link: this.promoForm.link || undefined,
      });
      this.promoBroadcastResult.set(
        `Dispatched successfully: ${res.recipientsCount} opted-in customers targeted (${res.deliveredCount} device tokens sent, ${res.failedCount} failures).`
      );
      this.toasts.show('Promotional push broadcast dispatched!');
      void this.loadPushSummary();
      if (this.showLogs()) {
        void this.loadMessageLogs();
      }
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Failed to broadcast promotional push notification'));
    } finally {
      this.isBroadcastingPromo.set(false);
    }
  }

  toggleLogs() {
    this.showLogs.update((v) => !v);
    if (this.showLogs() && this.messageLogs().length === 0) {
      void this.loadMessageLogs();
    }
  }

  async loadMessageLogs() {
    this.isLoadingLogs.set(true);
    try {
      const logs = await this.shop.getMessageLogs(30);
      this.messageLogs.set(logs);
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Could not fetch message dispatch logs'));
    } finally {
      this.isLoadingLogs.set(false);
    }
  }

  async sendTestAlert() {
    const phone = this.testPhone || (this.testChannel === 'push' ? 'Push-Device' : '');
    if (!phone) {
      this.toasts.error('Please enter a recipient phone number');
      return;
    }
    this.isTestingAlert.set(true);
    this.testAlertResult.set(null);
    try {
      const res = await this.shop.sendTestMessage(this.testChannel, phone);
      this.testAlertResult.set(
        `${this.testChannel.toUpperCase()} alert triggered (${res.log?.status || 'simulated'}). Log ID: #${res.log?._id || 'ok'}`
      );
      this.toasts.show(`Test ${this.testChannel.toUpperCase()} dispatched successfully!`);
      if (this.showLogs()) {
        void this.loadMessageLogs();
      }
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Failed to dispatch test alert'));
    } finally {
      this.isTestingAlert.set(false);
    }
  }

  async loadConfig() {
    this.isLoading.set(true);
    try {
      const data = await this.shop.getAdminStoreConfig();
      this.config.set(data);
      this.formData = {
        isOpen: data.isOpen,
        closedReason: data.closedReason || '',
        openingTime: data.openingTime || '07:00',
        closingTime: data.closingTime || '23:00',
        deliveryRadiusKm: data.deliveryRadiusKm || 8.0,
        minOrderAmount: data.minOrderAmount ?? 99,
        freeDeliveryThreshold: data.freeDeliveryThreshold ?? 299,
        deliveryFee: data.deliveryFee ?? 25,
        allowCustomerCancellation: data.allowCustomerCancellation ?? true,
        cancellationWindowMinutes: data.cancellationWindowMinutes ?? 3,
        allowDirectRiderContact: data.allowDirectRiderContact ?? true,
        nonReturnableNotice:
          data.nonReturnableNotice ||
          'Perishable groceries (fresh produce, dairy, bakery) cannot be returned once delivered.',
        enableSmsAlerts: data.enableSmsAlerts ?? true,
        enableWhatsAppAlerts: data.enableWhatsAppAlerts ?? true,
        smsProvider: data.smsProvider || 'fast2sms',
        smsSenderId: data.smsSenderId || 'ZAPBKT',
        smsApiKey: data.smsApiKey || '',
        whatsAppProvider: data.whatsAppProvider || 'meta',
        whatsAppApiKey: data.whatsAppApiKey || '',
        whatsAppPhoneNumberId: data.whatsAppPhoneNumberId || '',
        whatsAppFromNumber: data.whatsAppFromNumber || '+91 9101516662',
        upiVpa: data.upiVpa || '9101516662@ybl',
        payeeName: data.payeeName || 'ZapBasket',
        webhookSecret: data.webhookSecret || 'zb_webhook_secret_live',
        supportPhone: data.supportPhone || '+91 9101516662',
        supportEmail: data.supportEmail || 'support@zapbasket.store',
        logoUrl: data.logoUrl || 'brand-logo-white.svg',
        fssaiLicense: data.fssaiLicense || '11224333000542',
        showDemoAccountsOnLogin: data.showDemoAccountsOnLogin !== false,
        storeLocation: {
          lat: data.storeLocation?.lat ?? 12.9352,
          lng: data.storeLocation?.lng ?? 77.6245,
          address: data.storeLocation?.address || 'Koramangala 4th Block, Bengaluru',
          city: data.storeLocation?.city || '',
          state: data.storeLocation?.state || '',
          pincode: data.storeLocation?.pincode || '',
        },
      };
      this.logoPreview.set(this.formData.logoUrl);

      if (data.theme) {
        this.selectedThemePreset = data.theme.preset || 'emerald';
        this.themePrimaryColor = data.theme.primaryColor || '#059669';
        this.themeAccentColor = data.theme.accentColor || '#ea580c';
        this.themeService.applyPaletteToDom(this.themePrimaryColor, this.themeAccentColor);
      }
    } catch (error) {
      this.toasts.error(errorMessage(error, 'Could not load store configuration'));
    } finally {
      this.isLoading.set(false);
    }
  }

  isValidVpa(vpa: string): boolean {
    return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test((vpa || '').trim());
  }

  isValidFssai(lic: string): boolean {
    return /^\d{14}$/.test((lic || '').trim());
  }

  async saveConfig() {
    if (this.formData.upiVpa && !this.isValidVpa(this.formData.upiVpa)) {
      this.toasts.error('Please enter a valid Merchant UPI VPA (e.g. yourname@bank)');
      return;
    }
    if (this.formData.fssaiLicense && !this.isValidFssai(this.formData.fssaiLicense)) {
      this.toasts.error('FSSAI Food Safety License must be exactly 14 numeric digits');
      return;
    }

    this.formData.theme = {
      preset: this.selectedThemePreset,
      primaryColor: this.themePrimaryColor,
      accentColor: this.themeAccentColor,
      surfaceMode: 'slate-contrast',
    };

    this.isSaving.set(true);
    try {
      const updated = await this.shop.updateStoreConfig(this.formData);
      this.config.set(updated);
      this.toasts.show('Store operational settings & theme saved successfully!');
    } catch (error) {
      this.toasts.error(errorMessage(error, 'Failed to save settings'));
    } finally {
      this.isSaving.set(false);
    }
  }

  async testDistance() {
    const parts = this.testCoords.split(',').map((p) => Number(p.trim()));
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      this.toasts.error('Please enter valid coordinates as lat, lng');
      return;
    }

    try {
      const result = await this.shop.checkCoverage(parts[0], parts[1]);
      this.testResult.set({
        distanceKm: result.distanceKm ?? 0,
        eligible: result.eligible,
      });
    } catch (err) {
      this.toasts.error(errorMessage(err, 'Could not check distance'));
    }
  }

  async detectStoreLocation() {
    this.locationDetectionError.set(null);

    if (typeof window === 'undefined' || !navigator.geolocation) {
      const err = 'Geolocation is not supported by your current browser.';
      this.locationDetectionError.set(err);
      this.toasts.error(err);
      return;
    }

    this.isDetectingLocation.set(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          const accuracy = Math.round(pos.coords.accuracy);
          const timeStr = new Date().toLocaleTimeString();

          this.formData.storeLocation = {
            ...this.formData.storeLocation,
            lat,
            lng,
          };
          this.testCoords = `${lat}, ${lng}`;

          this.detectedLocationInfo.set({
            lat,
            lng,
            accuracy,
            timestamp: timeStr,
          });

          // Attempt reverse geocoding to resolve street address, city, state, pincode
          try {
            const resp = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
              {
                headers: {
                  Accept: 'application/json',
                },
              }
            );
            if (resp.ok) {
              const geoData = await resp.json();
              if (geoData) {
                const addr = geoData.address || {};
                const road = addr.road || addr.street || addr.pedestrian || addr.suburb || '';
                const neighborhood = addr.neighbourhood || addr.suburb || addr.city_district || '';
                const city = addr.city || addr.town || addr.village || addr.county || '';
                const state = addr.state || '';
                const postcode = addr.postcode || '';

                const formatted =
                  [road, neighborhood, city, state, postcode].filter(Boolean).join(', ') ||
                  geoData.display_name;

                if (formatted) {
                  this.formData.storeLocation.address = formatted;
                  if (city) this.formData.storeLocation.city = city;
                  if (state) this.formData.storeLocation.state = state;
                  if (postcode) this.formData.storeLocation.pincode = postcode;

                  this.detectedLocationInfo.update((curr) =>
                    curr ? { ...curr, addressResolved: formatted } : null
                  );
                }
              }
            }
          } catch (fetchErr) {
            console.warn('Reverse geocode lookup warning:', fetchErr);
          }

          this.toasts.show(`GPS coordinates detected: ${lat}, ${lng} (±${accuracy}m)`);
        } finally {
          this.isDetectingLocation.set(false);
        }
      },
      (err) => {
        let msg = 'Failed to detect location coordinates.';
        if (err.code === 1) {
          msg = 'Location permission was denied. Please allow location access in your browser address bar permissions and retry.';
        } else if (err.code === 2) {
          msg = 'Location position is unavailable. Please verify device GPS or network connection.';
        } else if (err.code === 3) {
          msg = 'Location acquisition timed out. Please try again.';
        }
        this.locationDetectionError.set(msg);
        this.toasts.error(msg);
        this.isDetectingLocation.set(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  copyCoordinates() {
    if (this.formData.storeLocation?.lat && this.formData.storeLocation?.lng) {
      const coordStr = `${this.formData.storeLocation.lat}, ${this.formData.storeLocation.lng}`;
      if (navigator.clipboard) {
        void navigator.clipboard.writeText(coordStr);
        this.toasts.show(`Copied coordinates: ${coordStr}`);
      }
    }
  }
}
