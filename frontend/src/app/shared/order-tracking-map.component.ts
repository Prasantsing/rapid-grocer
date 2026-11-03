import {
  Component,
  Input,
  OnInit,
  AfterViewInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
  signal,
  ElementRef,
  ViewChild,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, StoreConfig } from '../core/models';

declare const L: any;

@Component({
  selector: 'app-order-tracking-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-tracking-map.component.html',
  styleUrl: './order-tracking-map.component.scss',
})
export class OrderTrackingMapComponent implements OnInit, AfterViewInit, OnDestroy, OnChanges {
  @Input({ required: true }) order!: Order;
  @Input() storeConfig?: StoreConfig | null;

  @ViewChild('mapContainer') mapContainerRef!: ElementRef<HTMLDivElement>;

  readonly routeLoading = signal<boolean>(true);
  readonly distanceKm = signal<string>('1.8');
  readonly baseEtaMinutes = signal<number>(12);
  readonly currentEtaMinutes = signal<number>(12);
  readonly routePoints = signal<[number, number][]>([]);

  private mapInstance: any = null;
  private routeLayer: any = null;
  private storeMarker: any = null;
  private homeMarker: any = null;
  private scooterMarker: any = null;

  private animationTimer: any = null;
  private progressIndex = 0;

  readonly partnerName = computed(() => {
    if (!this.order.deliveryPartner) return '';
    if (typeof this.order.deliveryPartner === 'object' && this.order.deliveryPartner.name) {
      return this.order.deliveryPartner.name;
    }
    return 'Assigned Delivery Partner';
  });

  readonly partnerPhone = computed(() => {
    if (!this.order.deliveryPartner) return '';
    if (typeof this.order.deliveryPartner === 'object' && this.order.deliveryPartner.phone) {
      return this.order.deliveryPartner.phone;
    }
    return '';
  });

  readonly statusHeadline = computed(() => {
    switch (this.order.status) {
      case 'placed':
        return 'Order Placed at Dark Store';
      case 'confirmed':
        return 'Order Confirmed · Picking Items';
      case 'packed':
        return 'Order Packed · Partner Assigned';
      case 'out_for_delivery':
        return `${this.partnerName() || 'Rider'} is on the way!`;
      case 'delivered':
        return 'Order Delivered at Doorstep';
      case 'cancelled':
        return 'Order Cancelled';
      default:
        return 'Order in Progress';
    }
  });

  readonly statusSubline = computed(() => {
    switch (this.order.status) {
      case 'out_for_delivery':
        return 'Two-wheeler transit in progress with live GPS route';
      case 'packed':
        return 'Bag sealed with tamper-proof tag, awaiting rider pickup';
      case 'confirmed':
        return 'Fresh produce and items being gathered by store pickers';
      case 'delivered':
        return 'Handed over securely with doorstep verification';
      default:
        return 'ZapBasket Koramangala 12-Minute Express';
    }
  });

  readonly dynamicEta = computed(() => {
    if (this.order.status === 'delivered') return 'Delivered';
    if (this.order.status === 'cancelled') return 'Cancelled';
    const mins = this.currentEtaMinutes();
    if (mins <= 2) return 'Arriving now';
    return `~${mins} mins`;
  });

  ngOnInit() {
    this.currentEtaMinutes.set(this.baseEtaMinutes());
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.initMap();
    }, 150);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['order'] && !changes['order'].firstChange) {
      this.updateOrderStatusOnMap();
    }
  }

  ngOnDestroy() {
    this.stopAnimation();
    if (this.mapInstance) {
      try {
        this.mapInstance.remove();
      } catch (_) {}
      this.mapInstance = null;
    }
  }

  whatsappUrl(): string {
    const phone = (this.partnerPhone() || '').replace(/\D/g, '');
    const cleanPhone = phone.length === 10 ? `91${phone}` : phone;
    const text = encodeURIComponent(
      `Hi ${this.partnerName() || 'Delivery Partner'}, I am checking on my ZapBasket Order #${this.order.orderNumber}.`
    );
    return `https://wa.me/${cleanPhone}?text=${text}`;
  }

  private initMap() {
    if (typeof L === 'undefined' || !this.mapContainerRef) return;

    try {
      if (this.mapInstance) {
        this.mapInstance.remove();
      }

      const hubLat = this.storeConfig?.storeLocation?.lat || 12.9352;
      const hubLng = this.storeConfig?.storeLocation?.lng || 77.6245;

      const map = L.map(this.mapContainerRef.nativeElement, {
        zoomControl: true,
        attributionControl: false,
      }).setView([hubLat, hubLng], 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map);

      this.mapInstance = map;
      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      this.loadRouteAndMarkers();
    } catch (err) {
      console.warn('Map initialization failed:', err);
    }
  }

  private loadRouteAndMarkers() {
    if (!this.mapInstance || typeof L === 'undefined') return;

    const hubLat = this.storeConfig?.storeLocation?.lat || 12.9352;
    const hubLng = this.storeConfig?.storeLocation?.lng || 77.6245;

    // Calculate realistic customer destination offset within Bengaluru delivery area
    const hash = this.simpleHash(this.order.id + (this.order.address?.line1 || ''));
    const angle = (hash % 360) * (Math.PI / 180);
    const radiusDeg = 0.008 + ((hash % 80) / 100) * 0.018; // ~1-2.5km away
    const destLat = Number((hubLat + Math.sin(angle) * radiusDeg).toFixed(5));
    const destLng = Number((hubLng + Math.cos(angle) * radiusDeg).toFixed(5));

    // 1. Dark Store Hub Marker
    const storeIconHtml = `
      <div style="background: #0e6b4f; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
        🏬
      </div>
    `;
    const storeIcon = L.divIcon({
      html: storeIconHtml,
      className: 'store-hub-icon',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    this.storeMarker = L.marker([hubLat, hubLng], { icon: storeIcon })
      .bindPopup(`<b>ZapBasket Dark Store Hub</b><br>${this.storeConfig?.storeLocation?.address || 'Koramangala 4th Block'}`)
      .addTo(this.mapInstance);

    // 2. Customer Destination Marker
    const homeIconHtml = `
      <div style="background: #dc3545; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; box-shadow: 0 4px 10px rgba(0,0,0,0.3); border: 2px solid #ffffff;">
        🏠
      </div>
    `;
    const homeIcon = L.divIcon({
      html: homeIconHtml,
      className: 'dest-home-icon',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    this.homeMarker = L.marker([destLat, destLng], { icon: homeIcon })
      .bindPopup(`<b>Delivery Address</b><br>${this.order.address.line1}<br>${this.order.address.city} ${this.order.address.pincode}`)
      .addTo(this.mapInstance);

    // 3. Scooter Rider Marker (Animated)
    const scooterIconHtml = `
      <div style="background: #2563eb; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 0 0 6px rgba(37,99,235,0.25); border: 2px solid #ffffff;">
        🛵
      </div>
    `;
    const scooterIcon = L.divIcon({
      html: scooterIconHtml,
      className: 'scooter-rider-icon',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
    this.scooterMarker = L.marker([hubLat, hubLng], { icon: scooterIcon })
      .bindPopup(`<b>${this.partnerName() || 'Delivery Rider'}</b><br>${this.statusHeadline()}`)
      .addTo(this.mapInstance);

    // 4. Fetch Free Road Polyline via OSRM
    this.routeLoading.set(true);
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${hubLng},${hubLat};${destLng},${destLat}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then((res) => res.json())
      .then((data) => {
        this.routeLoading.set(false);
        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const distKm = (route.distance / 1000).toFixed(1);
          this.distanceKm.set(distKm);

          const estimatedMins = Math.max(4, Math.round((route.distance / 1000 / 22) * 60) + 3);
          this.baseEtaMinutes.set(estimatedMins);
          this.currentEtaMinutes.set(estimatedMins);

          const rawCoords: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
          this.routePoints.set(rawCoords);

          if (this.routeLayer) {
            this.mapInstance.removeLayer(this.routeLayer);
          }
          this.routeLayer = L.polyline(rawCoords, {
            color: '#0e6b4f',
            weight: 5,
            opacity: 0.85,
            lineJoin: 'round',
          }).addTo(this.mapInstance);

          this.recenterMap();
          this.startScooterAnimation();
        } else {
          this.drawStraightFallback(hubLat, hubLng, destLat, destLng);
        }
      })
      .catch(() => {
        this.routeLoading.set(false);
        this.drawStraightFallback(hubLat, hubLng, destLat, destLng);
      });
  }

  private drawStraightFallback(hubLat: number, hubLng: number, destLat: number, destLng: number) {
    if (!this.mapInstance) return;
    const points: [number, number][] = [
      [hubLat, hubLng],
      [destLat, destLng],
    ];
    this.routePoints.set(points);
    if (this.routeLayer) {
      this.mapInstance.removeLayer(this.routeLayer);
    }
    this.routeLayer = L.polyline(points, {
      color: '#0e6b4f',
      weight: 4,
      dashArray: '6, 8',
    }).addTo(this.mapInstance);

    this.recenterMap();
    this.startScooterAnimation();
  }

  private startScooterAnimation() {
    this.stopAnimation();

    const points = this.routePoints();
    if (!points.length || !this.scooterMarker) return;

    if (this.order.status === 'out_for_delivery') {
      // Advance scooter along polyline to simulate active road movement
      this.progressIndex = Math.floor(points.length * 0.25);
      const updateMotion = () => {
        if (!this.scooterMarker || !points.length) return;
        this.progressIndex = (this.progressIndex + 1) % points.length;
        const currentCoord = points[this.progressIndex];
        this.scooterMarker.setLatLng(currentCoord);

        // Dynamically reduce remaining ETA based on route completion
        const progressFraction = this.progressIndex / points.length;
        const remaining = Math.max(2, Math.round(this.baseEtaMinutes() * (1 - progressFraction * 0.85)));
        this.currentEtaMinutes.set(remaining);
      };

      this.animationTimer = setInterval(updateMotion, 2200);
    } else if (this.order.status === 'delivered') {
      const destPoint = points[points.length - 1];
      this.scooterMarker.setLatLng(destPoint);
      this.currentEtaMinutes.set(0);
    } else {
      // Order placed / confirmed / packed: stay at store hub
      this.scooterMarker.setLatLng(points[0]);
      this.currentEtaMinutes.set(this.baseEtaMinutes());
    }
  }

  private stopAnimation() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  private updateOrderStatusOnMap() {
    this.startScooterAnimation();
  }

  recenterMap() {
    if (!this.mapInstance) return;
    if (this.routeLayer) {
      this.mapInstance.fitBounds(this.routeLayer.getBounds(), { padding: [40, 40] });
    } else {
      const hubLat = this.storeConfig?.storeLocation?.lat || 12.9352;
      const hubLng = this.storeConfig?.storeLocation?.lng || 77.6245;
      this.mapInstance.setView([hubLat, hubLng], 14);
    }
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
