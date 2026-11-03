import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  AfterViewInit,
  OnDestroy,
  signal,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, StoreConfig } from '../core/models';
import { InrPipe } from './inr.pipe';

declare const L: any;

interface RouteStep {
  instruction: string;
  distanceMeters: number;
  modifier?: string;
  type?: string;
}

@Component({
  selector: 'app-rider-navigation-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rider-navigation-modal.component.html',
  styleUrl: './rider-navigation-modal.component.scss',
})
export class RiderNavigationModalComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) order!: Order;
  @Input() storeConfig?: StoreConfig | null;

  @Output() close = new EventEmitter<void>();
  @Output() statusChange = new EventEmitter<{ order: Order; status: string }>();

  @ViewChild('mapContainer') mapContainerRef!: ElementRef<HTMLDivElement>;

  readonly isUsingLiveGps = signal<boolean>(false);
  readonly gpsLoading = signal<boolean>(false);
  readonly routeLoading = signal<boolean>(true);
  readonly showSteps = signal<boolean>(false);

  readonly originLat = signal<number>(12.9352);
  readonly originLng = signal<number>(77.6245);
  readonly destLat = signal<number>(12.9385);
  readonly destLng = signal<number>(77.6312);

  readonly distanceKm = signal<string>('0.0');
  readonly etaMinutes = signal<number>(10);
  readonly steps = signal<RouteStep[]>([]);

  private mapInstance: any = null;
  private routeLayer: any = null;
  private originMarker: any = null;
  private destMarker: any = null;

  ngOnInit() {
    // Seed default origin from store config if available
    if (this.storeConfig?.storeLocation?.lat && this.storeConfig?.storeLocation?.lng) {
      this.originLat.set(this.storeConfig.storeLocation.lat);
      this.originLng.set(this.storeConfig.storeLocation.lng);
    }

    // Geocode destination from order address
    this.resolveDestinationCoords();

    // Attempt live GPS detection
    this.requestLiveGps();
  }

  ngAfterViewInit() {
    // Wait for DOM to finish laying out modal before initializing Leaflet
    setTimeout(() => {
      this.initLeafletMap();
    }, 150);
  }

  ngOnDestroy() {
    if (this.mapInstance) {
      try {
        this.mapInstance.remove();
      } catch (_) {}
      this.mapInstance = null;
    }
  }

  closeModal() {
    this.close.emit();
  }

  updateStatus(newStatus: string) {
    this.statusChange.emit({ order: this.order, status: newStatus });
  }

  requestLiveGps() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.isUsingLiveGps.set(false);
      return;
    }

    this.gpsLoading.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.gpsLoading.set(false);
        this.isUsingLiveGps.set(true);
        this.originLat.set(pos.coords.latitude);
        this.originLng.set(pos.coords.longitude);
        this.updateMapRoute();
      },
      (err) => {
        console.warn('Live GPS lookup declined or failed, falling back to Dark Store Hub:', err.message);
        this.gpsLoading.set(false);
        this.isUsingLiveGps.set(false);
        if (this.storeConfig?.storeLocation) {
          this.originLat.set(this.storeConfig.storeLocation.lat);
          this.originLng.set(this.storeConfig.storeLocation.lng);
        }
        this.updateMapRoute();
      },
      { timeout: 8000, enableHighAccuracy: true, maximumAge: 30000 }
    );
  }

  private resolveDestinationCoords() {
    // Deterministic offset within Bengaluru delivery radius based on address & pincode
    // This guarantees immediate map responsiveness even before Nominatim responds
    const hubLat = this.originLat();
    const hubLng = this.originLng();
    const hash = this.simpleHash(this.order.id + (this.order.address?.line1 || ''));
    
    // Spread 0.8km to 3.5km from store hub
    const angle = (hash % 360) * (Math.PI / 180);
    const radiusDeg = 0.008 + ((hash % 100) / 100) * 0.022; // ~1-3km in degrees
    const fallbackLat = Number((hubLat + Math.sin(angle) * radiusDeg).toFixed(5));
    const fallbackLng = Number((hubLng + Math.cos(angle) * radiusDeg).toFixed(5));

    this.destLat.set(fallbackLat);
    this.destLng.set(fallbackLng);

    // Try free Nominatim OpenStreetMap forward geocoding in background
    const qParts = [
      this.order.address?.line1,
      this.order.address?.landmark,
      this.order.address?.city || 'Bengaluru',
      this.order.address?.pincode,
    ].filter(Boolean);

    const query = qParts.join(', ');
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;

    fetch(nominatimUrl, {
      headers: {
        'Accept-Language': 'en-IN,en;q=0.9',
      },
    })
      .then((res) => res.json())
      .then((results) => {
        if (Array.isArray(results) && results.length > 0 && results[0].lat && results[0].lon) {
          const lat = parseFloat(results[0].lat);
          const lng = parseFloat(results[0].lon);
          // Only accept if within Karnataka / Bengaluru area to avoid misplaced matches
          if (lat >= 12.0 && lat <= 13.5 && lng >= 77.0 && lng <= 78.0) {
            this.destLat.set(lat);
            this.destLng.set(lng);
            this.updateMapRoute();
          }
        }
      })
      .catch(() => {
        // Fallback already assigned
      });
  }

  private initLeafletMap() {
    if (typeof L === 'undefined' || !this.mapContainerRef) {
      console.warn('Leaflet script not yet ready on window');
      return;
    }

    try {
      if (this.mapInstance) {
        this.mapInstance.remove();
      }

      const map = L.map(this.mapContainerRef.nativeElement, {
        zoomControl: true,
        attributionControl: true,
      }).setView([this.originLat(), this.originLng()], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      this.mapInstance = map;
      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      this.updateMapRoute();
    } catch (err) {
      console.error('Error initializing Leaflet map:', err);
    }
  }

  private updateMapRoute() {
    if (!this.mapInstance || typeof L === 'undefined') return;

    const oLat = this.originLat();
    const oLng = this.originLng();
    const dLat = this.destLat();
    const dLng = this.destLng();

    // 1. Update Origin Marker (Rider / Hub)
    if (this.originMarker) {
      this.mapInstance.removeLayer(this.originMarker);
    }
    const riderIconHtml = `
      <div style="background: #0e6b4f; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
        🛵
      </div>
    `;
    const riderIcon = L.divIcon({
      html: riderIconHtml,
      className: 'rider-custom-icon',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    this.originMarker = L.marker([oLat, oLng], { icon: riderIcon })
      .bindPopup(`<b>${this.isUsingLiveGps() ? 'Your Live GPS Location' : 'Dark Store Hub (Koramangala)'}</b>`)
      .addTo(this.mapInstance);

    // 2. Update Destination Marker (Customer / Landmark)
    if (this.destMarker) {
      this.mapInstance.removeLayer(this.destMarker);
    }
    const destIconHtml = `
      <div style="background: #dc3545; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
        🏠
      </div>
    `;
    const destIcon = L.divIcon({
      html: destIconHtml,
      className: 'dest-custom-icon',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    this.destMarker = L.marker([dLat, dLng], { icon: destIcon })
      .bindPopup(
        `<b>${this.order.address.fullName}</b><br>${this.order.address.line1}<br><i>${this.order.address.landmark || 'No landmark specified'}</i>`
      )
      .addTo(this.mapInstance);

    // 3. Fetch Free Driving Route from OSRM (Open Source Routing Machine)
    this.routeLoading.set(true);
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=geojson&steps=true`;

    fetch(osrmUrl)
      .then((res) => res.json())
      .then((data) => {
        this.routeLoading.set(false);
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distMeters = route.distance || 0;
          const durationSeconds = route.duration || 0;

          const km = (distMeters / 1000).toFixed(1);
          this.distanceKm.set(km);

          // Realistic two-wheeler urban speed in Indian metro traffic (~20 km/h avg)
          const bikeEta = Math.max(3, Math.round((distMeters / 1000 / 22) * 60) + 2);
          this.etaMinutes.set(bikeEta);

          // Parse turn-by-turn maneuvers
          const parsedSteps: RouteStep[] = [];
          if (route.legs && route.legs.length > 0) {
            const legs = route.legs[0];
            for (const step of legs.steps || []) {
              const name = step.name ? ` onto ${step.name}` : '';
              let instr = '';
              const maneuver = step.maneuver || {};
              switch (maneuver.type) {
                case 'depart':
                  instr = `Head ${maneuver.modifier || 'forward'}${name}`;
                  break;
                case 'turn':
                  instr = `Turn ${maneuver.modifier || 'right'}${name}`;
                  break;
                case 'new name':
                  instr = `Continue${name}`;
                  break;
                case 'arrive':
                  instr = `Arrive at customer delivery location`;
                  break;
                case 'roundabout':
                  instr = `At roundabout take exit ${maneuver.exit || 1}${name}`;
                  break;
                default:
                  instr = `${maneuver.type || 'Proceed'} ${maneuver.modifier || ''}${name}`.trim();
              }
              parsedSteps.push({
                instruction: instr || 'Continue straight',
                distanceMeters: Math.round(step.distance || 0),
                modifier: maneuver.modifier,
                type: maneuver.type,
              });
            }
          }
          this.steps.set(parsedSteps);

          // Draw polyline from GeoJSON
          const coordinates = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          if (this.routeLayer) {
            this.mapInstance.removeLayer(this.routeLayer);
          }
          this.routeLayer = L.polyline(coordinates, {
            color: '#0e6b4f',
            weight: 6,
            opacity: 0.85,
            lineJoin: 'round',
          }).addTo(this.mapInstance);

          // Fit bounds so entire route is neatly centered
          this.recenterMap();
        } else {
          this.plotStraightLineFallback(oLat, oLng, dLat, dLng);
        }
      })
      .catch((err) => {
        console.warn('OSRM routing failed, drawing straight direct line:', err);
        this.routeLoading.set(false);
        this.plotStraightLineFallback(oLat, oLng, dLat, dLng);
      });
  }

  private plotStraightLineFallback(oLat: number, oLng: number, dLat: number, dLng: number) {
    if (!this.mapInstance) return;
    const estDistance = this.calculateHaversineKm(oLat, oLng, dLat, dLng);
    this.distanceKm.set(estDistance.toFixed(1));
    this.etaMinutes.set(Math.max(4, Math.round((estDistance / 20) * 60)));
    this.steps.set([
      { instruction: 'Proceed towards destination route', distanceMeters: Math.round(estDistance * 1000) },
      { instruction: 'Arrive at customer delivery address', distanceMeters: 0 },
    ]);

    if (this.routeLayer) {
      this.mapInstance.removeLayer(this.routeLayer);
    }
    this.routeLayer = L.polyline(
      [
        [oLat, oLng],
        [dLat, dLng],
      ],
      {
        color: '#2563eb',
        weight: 4,
        dashArray: '6, 8',
      }
    ).addTo(this.mapInstance);

    this.recenterMap();
  }

  recenterMap() {
    if (!this.mapInstance || !this.routeLayer) {
      if (this.mapInstance) {
        const bounds = L.latLngBounds([
          [this.originLat(), this.originLng()],
          [this.destLat(), this.destLng()],
        ]);
        this.mapInstance.fitBounds(bounds, { padding: [40, 40] });
      }
      return;
    }
    this.mapInstance.fitBounds(this.routeLayer.getBounds(), { padding: [40, 40] });
  }

  googleMapsNavUrl(): string {
    const o = `${this.originLat()},${this.originLng()}`;
    const d = `${this.destLat()},${this.destLng()}`;
    // travelmode=two_wheeler opens Indian two-wheeler bike navigation in Google Maps
    return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=two_wheeler`;
  }

  whatsappUrl(): string {
    const rawPhone = this.order.address?.phone || '';
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const customer = this.order.address?.fullName || 'Customer';
    const landmark = this.order.address?.landmark ? ` near ${this.order.address.landmark}` : '';
    const text = encodeURIComponent(
      `Hello ${customer}, I am Ravi your ZapBasket delivery rider for Order #${this.order.orderNumber}. I am on my way to ${this.order.address.line1}${landmark}. If there are any gate codes or entry landmarks, please reply!`
    );
    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  }

  formatMeters(meters: number): string {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${meters} m`;
  }

  private calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
