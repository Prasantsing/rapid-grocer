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
  imports: [CommonModule, InrPipe],
  template: `
    <div class="rider-modal-backdrop" (click)="closeModal()">
      <div class="rider-modal-dialog" (click)="$event.stopPropagation()">
        <!-- MODAL HEADER -->
        <div class="rider-modal-header bg-dark text-white px-3 py-2 d-flex justify-content-between align-items-center">
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-success text-white px-2 py-1 fs-6">
              <i class="bi bi-compass me-1"></i> Rider Navigation
            </span>
            <span class="text-white-50 font-monospace small">#{{ order.orderNumber }}</span>
          </div>
          <button type="button" class="btn-close btn-close-white" (click)="closeModal()" aria-label="Close"></button>
        </div>

        <div class="rider-modal-body p-0">
          <!-- METRIC STRIP: ETA, DISTANCE, GPS SOURCE -->
          <div class="bg-light border-bottom p-2 px-3 d-flex flex-wrap gap-2 justify-content-between align-items-center">
            <div class="d-flex align-items-center gap-3">
              <div class="d-flex align-items-center gap-1">
                <span class="text-muted small">ETA:</span>
                <span class="badge bg-primary fs-6 px-2 py-1">
                  <i class="bi bi-stopwatch me-1"></i>{{ etaMinutes() }} mins
                </span>
              </div>
              <div class="d-flex align-items-center gap-1">
                <span class="text-muted small">Distance:</span>
                <strong class="text-dark">{{ distanceKm() }} km</strong>
              </div>
            </div>

            <!-- GPS Origin Status & Refresh -->
            <div class="d-flex align-items-center gap-2">
              @if (isUsingLiveGps()) {
                <span class="badge bg-success-subtle text-success border border-success-subtle d-inline-flex align-items-center gap-1">
                  <span class="gps-pulse-dot"></span> Live GPS Active
                </span>
              } @else {
                <span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
                  <i class="bi bi-shop me-1"></i> Hub Origin (Fallback)
                </span>
              }
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm py-0 px-2"
                style="font-size: 0.75rem;"
                title="Re-query device GPS"
                [disabled]="gpsLoading()"
                (click)="requestLiveGps()">
                <i class="bi bi-arrow-clockwise" [class.spin]="gpsLoading()"></i> Refresh GPS
              </button>
            </div>
          </div>

          <!-- LANDMARK & CUSTOMER SPOTLIGHT (CRITICAL FOR RIDERS) -->
          <div class="p-3 bg-warning-subtle border-bottom">
            <div class="d-flex align-items-start gap-2">
              <div class="fs-4 text-warning-emphasis lh-1 mt-1">
                <i class="bi bi-signpost-2-fill"></i>
              </div>
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-1">
                  <strong class="text-warning-emphasis">
                    {{ order.address.landmark ? 'Landmark: ' + order.address.landmark : 'Customer Location Guide' }}
                  </strong>
                  <span class="badge bg-dark text-white font-monospace" style="font-size: 0.72rem;">
                    PIN: {{ order.address.pincode }}
                  </span>
                </div>

                <div class="text-dark small mt-1">
                  <strong>{{ order.address.fullName }}</strong> ·
                  <a [href]="'tel:' + order.address.phone" class="text-dark fw-bold text-decoration-none">
                    <i class="bi bi-telephone-fill text-success me-1"></i>{{ order.address.phone }}
                  </a>
                </div>

                <div class="text-secondary small mt-1">
                  <i class="bi bi-geo-alt me-1"></i>
                  {{ order.address.line1 }}@if (order.address.line2) {, {{ order.address.line2 }}}, {{ order.address.city }}
                </div>

                @if (order.notes) {
                  <div class="mt-2 py-1 px-2 rounded bg-white border border-warning-subtle small text-dark">
                    <i class="bi bi-card-text text-warning me-1"></i>
                    <strong>Delivery Note:</strong> {{ order.notes }}
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- ONE-TAP ACTION BAR -->
          <div class="p-2 px-3 bg-white border-bottom d-flex flex-wrap gap-2 align-items-center justify-content-between">
            <div class="d-flex flex-wrap gap-2">
              <!-- Universal Google Maps Launch Button -->
              <a
                [href]="googleMapsNavUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-primary btn-sm fw-bold d-inline-flex align-items-center gap-1 shadow-sm">
                <i class="bi bi-cursor-fill"></i> Open in Google Maps
                <span class="badge bg-white text-primary ms-1" style="font-size: 0.65rem;">Two-Wheeler</span>
              </a>

              <!-- Call Customer -->
              <a
                [href]="'tel:' + order.address.phone"
                class="btn btn-outline-success btn-sm fw-semibold d-inline-flex align-items-center gap-1">
                <i class="bi bi-telephone-outbound-fill"></i> Call Customer
              </a>

              <!-- WhatsApp Quick Ping -->
              <a
                [href]="whatsappUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="btn btn-outline-success btn-sm fw-semibold d-inline-flex align-items-center gap-1">
                <i class="bi bi-whatsapp"></i> WhatsApp Ping
              </a>
            </div>

            <!-- Quick Run Status Toggle -->
            <div class="d-flex gap-2">
              @if (order.status === 'packed') {
                <button type="button" class="btn btn-warning btn-sm fw-bold" (click)="updateStatus('out_for_delivery')">
                  <i class="bi bi-bicycle me-1"></i> I'm On The Way
                </button>
              }
              @if (order.status === 'out_for_delivery') {
                <button type="button" class="btn btn-success btn-sm fw-bold" (click)="updateStatus('delivered')">
                  <i class="bi bi-check2-circle me-1"></i> Mark Delivered
                </button>
              }
            </div>
          </div>

          <!-- INTERACTIVE OPENSTREETMAP DISPLAY -->
          <div class="map-wrapper position-relative">
            <div #mapContainer id="rider-osm-map" class="w-100" style="height: 320px; background-color: #f1f5f9;"></div>

            <!-- Map Floating Controls & Info -->
            <div class="position-absolute top-0 end-0 p-2 z-3" style="pointer-events: none;">
              <span class="badge bg-white text-dark shadow-sm border" style="pointer-events: auto; opacity: 0.95;">
                <i class="bi bi-layers me-1 text-primary"></i> Free OpenStreetMap & OSRM
              </span>
            </div>

            <div class="position-absolute bottom-0 start-0 p-2 z-3" style="pointer-events: none;">
              <button
                type="button"
                class="btn btn-light btn-sm shadow-sm border py-1 px-2"
                style="pointer-events: auto; font-size: 0.75rem;"
                (click)="recenterMap()">
                <i class="bi bi-arrows-angle-expand me-1"></i> Fit Route
              </button>
            </div>

            @if (routeLoading()) {
              <div class="position-absolute top-50 start-50 translate-middle bg-white px-3 py-2 rounded-3 shadow border text-center z-3">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                <span class="small fw-semibold">Calculating best free route…</span>
              </div>
            }
          </div>

          <!-- STEP-BY-STEP ROAD GUIDANCE (EXPANDABLE) -->
          <div class="p-3 bg-white border-top">
            <button
              type="button"
              class="btn btn-link p-0 text-decoration-none text-dark w-100 d-flex justify-content-between align-items-center"
              (click)="showSteps.set(!showSteps())">
              <span class="fw-bold small d-inline-flex align-items-center gap-1">
                <i class="bi bi-turn-right text-primary"></i>
                Turn-by-turn Road Directions ({{ steps().length }} maneuvers)
              </span>
              <i class="bi" [class.bi-chevron-down]="!showSteps()" [class.bi-chevron-up]="showSteps()"></i>
            </button>

            @if (showSteps()) {
              <div class="mt-2 border rounded p-2 bg-light-subtle" style="max-height: 180px; overflow-y: auto;">
                @if (!steps().length) {
                  <p class="text-muted small mb-0">Direct route plotted. Follow the green route line on the map above.</p>
                } @else {
                  <ul class="list-unstyled mb-0 small">
                    @for (step of steps(); track $index; let i = $index) {
                      <li class="py-1 d-flex gap-2 border-bottom border-light">
                        <span class="badge bg-secondary-subtle text-secondary font-monospace" style="font-size: 0.68rem; height: fit-content;">
                          {{ i + 1 }}
                        </span>
                        <div class="flex-grow-1">
                          <span class="text-dark fw-medium">{{ step.instruction }}</span>
                          @if (step.distanceMeters > 0) {
                            <div class="text-muted font-monospace" style="font-size: 0.7rem;">
                              for {{ formatMeters(step.distanceMeters) }}
                            </div>
                          }
                        </div>
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          </div>
        </div>

        <!-- MODAL FOOTER -->
        <div class="modal-footer bg-light px-3 py-2 border-top d-flex justify-content-between">
          <small class="text-muted" style="font-size: 0.72rem;">
            <i class="bi bi-shield-check text-success me-1"></i> Zero-cost routing via OpenStreetMap & Project-OSRM
          </small>
          <button type="button" class="btn btn-secondary btn-sm" (click)="closeModal()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .rider-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.75);
        backdrop-filter: blur(4px);
        z-index: 1050;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        animation: fadeIn 0.15s ease-out;
      }
      .rider-modal-dialog {
        background: #fff;
        border-radius: 12px;
        overflow: hidden;
        width: 100%;
        max-width: 680px;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
      .rider-modal-body {
        overflow-y: auto;
        flex: 1 1 auto;
      }
      .gps-pulse-dot {
        width: 8px;
        height: 8px;
        background: #198754;
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 0 rgba(25, 135, 84, 0.7);
        animation: pulse 1.6s infinite;
      }
      @keyframes pulse {
        0% {
          box-shadow: 0 0 0 0 rgba(25, 135, 84, 0.7);
        }
        70% {
          box-shadow: 0 0 0 8px rgba(25, 135, 84, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(25, 135, 84, 0);
        }
      }
      .spin {
        animation: spin 1s linear infinite;
        display: inline-block;
      }
      @keyframes spin {
        100% {
          transform: rotate(360deg);
        }
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
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
