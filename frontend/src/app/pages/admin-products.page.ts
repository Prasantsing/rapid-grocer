import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Category, Product } from '../core/models';
import { AdminService } from '../core/admin.service';
import { ToastService } from '../core/toast.service';
import { errorMessage } from '../core/http-error';
import { InrPipe } from '../shared/inr.pipe';

@Component({
  selector: 'app-admin-products',
  imports: [ReactiveFormsModule, InrPipe],
  template: `
    <div class="section-head mb-3">
      <div>
        <h2>Products</h2>
        <p class="muted mb-0">Manage dark-store catalog, inventory stock, and high-fidelity studio photos</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button
          class="btn btn-outline-dark d-inline-flex align-items-center gap-1"
          type="button"
          (click)="openCameraCapture()"
          title="Snap product packaging with live camera to auto-fill details"
        >
          <i class="bi bi-camera"></i> Live Camera Snap
        </button>
        <label
          class="btn btn-dark d-inline-flex align-items-center gap-1 mb-0 cursor-pointer"
          style="background: #0e6b4f; border-color: #0e6b4f;"
          title="Upload packaging photo to auto-fill details with Gemini AI"
        >
          <i class="bi bi-magic"></i> ⚡ AI Auto-Fill from Photo
          <input type="file" accept="image/*" class="d-none" (change)="onAutoFillFileSelected($event)" />
        </label>
        <button class="btn btn-dark" type="button" (click)="open()">+ New product</button>
      </div>
    </div>

    <form class="mb-3" (submit)="search($event)">
      <div class="input-group">
        <input class="form-control" name="q" placeholder="Search product catalog by name, brand, or tag..." />
        <button class="btn btn-outline-dark" type="submit">Search</button>
      </div>
    </form>

    <div class="panel table-wrap">
      <table class="plain">
        <thead>
          <tr>
            <th style="width: 56px">Photo</th>
            <th>Name</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Status</th>
            <th class="text-end">Actions</th>
          </tr>
        </thead>
        <tbody>
          @for (product of products(); track product.id) {
            <tr>
              <td>
                @if (product.imageUrl) {
                  <img [src]="product.imageUrl" [alt]="product.name" class="admin-table-thumb" />
                } @else {
                  <span class="fs-4">{{ product.emoji }}</span>
                }
              </td>
              <td>
                <strong>{{ product.name }}</strong>
                <div class="muted small">{{ product.brand || 'No brand' }} · {{ product.unit }}</div>
              </td>
              <td>
                <span class="badge bg-light text-dark border">{{ categoryName(product) }}</span>
              </td>
              <td>{{ product.price | inr }}</td>
              <td>
                <span [class.text-danger]="product.stock < 5" [class.fw-bold]="product.stock < 5">
                  {{ product.stock }} units
                </span>
              </td>
              <td>
                <span class="status-pill" [class.cancelled]="!product.isActive">
                  {{ product.isActive ? 'Live' : 'Archived' }}
                </span>
              </td>
              <td class="text-end">
                <button class="btn btn-sm btn-outline-dark" type="button" (click)="open(product)">Edit</button>
                @if (product.isActive) {
                  <button class="btn btn-sm btn-outline-danger ms-1" type="button" (click)="archive(product)">Archive</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Product Drawer Form -->
    @if (openForm()) {
      <div class="modal-sheet" (click)="openForm.set(false)">
        <form class="sheet" [formGroup]="form" (click)="$event.stopPropagation()" (ngSubmit)="save()">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h3>{{ editing() ? 'Edit product' : 'New product' }}</h3>
            <button type="button" class="btn-close" aria-label="Close" (click)="openForm.set(false)"></button>
          </div>

          <!-- AI Packaging Scanner & Auto-Fill Module -->
          <div class="ai-autofill-hero-card mb-3 p-3 rounded-3">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div class="d-flex align-items-center gap-2">
                <span class="fs-4">✨</span>
                <div>
                  <strong class="d-block text-dark small">AI Auto-Fill from Packaging Photo</strong>
                  <span class="text-muted" style="font-size: 0.74rem;">
                    Snap with your camera or upload photo to auto-fill title, brand, description, category, unit, MRP & price with Gemini 3.8 Flash.
                  </span>
                </div>
              </div>
              @if (hasAiAutoFilled()) {
                <span class="badge bg-success-subtle text-success border border-success-subtle small flex-shrink-0">
                  <i class="bi bi-check-circle-fill me-1"></i> Auto-Filled
                </span>
              }
            </div>

            <div class="d-flex gap-2 flex-wrap align-items-center">
              <button
                type="button"
                class="btn btn-sm btn-dark d-inline-flex align-items-center gap-1"
                (click)="openCameraCapture()"
              >
                <i class="bi bi-camera-fill"></i> Snap with Camera
              </button>
              <label class="btn btn-sm btn-outline-dark d-inline-flex align-items-center gap-1 mb-0" style="cursor: pointer;">
                <i class="bi bi-upload"></i> Upload Packaging Photo
                <input type="file" accept="image/*" class="d-none" (change)="onAutoFillFileSelected($event)" />
              </label>
              @if (hasAiAutoFilled()) {
                <button
                  type="button"
                  class="btn btn-sm btn-link text-muted p-0 ms-auto text-decoration-none small"
                  (click)="hasAiAutoFilled.set(false)"
                >
                  Clear AI highlight
                </button>
              }
            </div>
          </div>

          <div class="row g-2">
            <div class="col-md-8">
              <label class="form-label small fw-semibold mb-1">
                Product Title
                @if (hasAiAutoFilled()) {
                  <span class="ai-extracted-badge ms-1"><i class="bi bi-stars me-1"></i> AI Extracted</span>
                }
              </label>
              <input class="form-control" placeholder="e.g. Alphonso Mangoes" formControlName="name" />
            </div>
            <div class="col-md-4">
              <label class="form-label small fw-semibold mb-1">
                Brand / Company
                @if (hasAiAutoFilled()) {
                  <span class="ai-extracted-badge ms-1"><i class="bi bi-stars me-1"></i> AI Extracted</span>
                }
              </label>
              <input class="form-control" placeholder="e.g. Ratnagiri Fresh" formControlName="brand" />
            </div>

            <!-- Product Visual & AI Studio Showcase -->
            <div class="col-12">
              <div class="image-manager-card">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <label class="form-label fw-bold mb-0">
                    <i class="bi bi-image me-1"></i> Product Photo & AI Studio Enhancement
                  </label>
                  @if (previewImage()) {
                    <button class="btn btn-sm btn-link text-danger p-0 text-decoration-none" type="button" (click)="clearImage()">
                      <i class="bi bi-trash"></i> Remove photo
                    </button>
                  }
                </div>

                <!-- Input Method Toggle -->
                <div class="image-tab-group">
                  <button type="button" [class.active]="inputMode() === 'upload'" (click)="inputMode.set('upload')">
                    📁 Upload from Device
                  </button>
                  <button type="button" [class.active]="inputMode() === 'url'" (click)="inputMode.set('url')">
                    🔗 Paste Image URL
                  </button>
                </div>

                @if (inputMode() === 'upload') {
                  <div
                    class="image-preview-stage"
                    [class.has-image]="!!previewImage()"
                    [class.dragover]="isDragging()"
                    (dragover)="onDragOver($event)"
                    (dragleave)="isDragging.set(false)"
                    (drop)="onDrop($event)"
                  >
                    @if (previewImage()) {
                      <img [src]="previewImage()" alt="Product preview" class="preview-img" />
                      <div class="position-absolute bottom-0 start-0 m-2 badge bg-dark opacity-75">
                        {{ isAiEnhanced() ? '✨ AI Studio Photo' : 'Device Upload' }}
                      </div>
                    } @else {
                      <div class="text-center p-3">
                        <div class="fs-1 text-muted mb-1">📷</div>
                        <p class="mb-1 fw-semibold small">Drag & drop photo here or choose file</p>
                        <p class="text-muted small mb-2">JPG, PNG, WebP up to 10MB</p>
                        <label class="btn btn-sm btn-outline-dark">
                          Choose Photo
                          <input type="file" accept="image/*" class="d-none" (change)="onFileSelected($event)" />
                        </label>
                      </div>
                    }
                  </div>
                  @if (previewImage()) {
                    <div class="mt-2 d-flex flex-wrap gap-2 justify-content-center">
                      <button
                        type="button"
                        class="btn btn-sm btn-success d-inline-flex align-items-center gap-1 shadow-sm"
                        [disabled]="isExtractingDetails()"
                        (click)="runAiAutoFill(previewImage())"
                      >
                        <i class="bi bi-stars"></i>
                        {{ isExtractingDetails() ? 'Extracting details…' : 'AI Auto-Fill Form from Photo' }}
                      </button>
                      <label class="btn btn-sm btn-outline-secondary">
                        Change Photo
                        <input type="file" accept="image/*" class="d-none" (change)="onFileSelected($event)" />
                      </label>
                    </div>
                  }
                } @else {
                  <div class="mb-2">
                    <div class="input-group">
                      <span class="input-group-text">🔗</span>
                      <input
                        class="form-control"
                        placeholder="https://images.unsplash.com/photo-... or web link"
                        formControlName="imageUrl"
                        (input)="onUrlInput($event)"
                      />
                    </div>
                  </div>
                  @if (previewImage()) {
                    <div class="image-preview-stage has-image">
                      <img [src]="previewImage()" alt="URL preview" class="preview-img" (error)="onUrlError()" />
                      <div class="position-absolute bottom-0 start-0 m-2 badge bg-dark opacity-75">
                        {{ isAiEnhanced() ? '✨ AI Studio Photo' : 'Web Image' }}
                      </div>
                    </div>
                    <div class="mt-2 d-flex flex-wrap gap-2 justify-content-center">
                      <button
                        type="button"
                        class="btn btn-sm btn-success d-inline-flex align-items-center gap-1 shadow-sm"
                        [disabled]="isExtractingDetails()"
                        (click)="runAiAutoFill(previewImage())"
                      >
                        <i class="bi bi-stars"></i>
                        {{ isExtractingDetails() ? 'Extracting details…' : 'AI Auto-Fill Form from Photo' }}
                      </button>
                    </div>
                  }
                }

                <!-- AI Enhancement Trigger Bar -->
                @if (previewImage()) {
                  <div class="ai-enhance-strip">
                    <div class="ai-enhance-info">
                      <b>✨ AI Studio Lighting & Cleanup</b>
                      <span>Studio light balancing, clean backdrop, and soft drop shadow</span>
                    </div>
                    <button
                      type="button"
                      class="btn-ai-enhance"
                      [disabled]="isEnhancing()"
                      (click)="enhanceWithAi()"
                    >
                      @if (isEnhancing()) {
                        <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                        Enhancing...
                      } @else {
                        <span>✨ Enhance with AI</span>
                      }
                    </button>
                  </div>
                }
              </div>
            </div>

            <div class="col-12">
              <label class="form-label small fw-semibold mb-1">
                Description
                @if (hasAiAutoFilled()) {
                  <span class="ai-extracted-badge ms-1"><i class="bi bi-stars me-1"></i> AI Generated</span>
                }
              </label>
              <textarea class="form-control" rows="2" placeholder="Rich tasting description..." formControlName="description"></textarea>
            </div>

            <div class="col-md-6">
              <label class="form-label small fw-semibold mb-1">
                Category
                @if (hasAiAutoFilled()) {
                  <span class="ai-extracted-badge ms-1"><i class="bi bi-stars me-1"></i> AI Matched</span>
                }
              </label>
              <select class="form-select" formControlName="categoryId">
                @for (category of categories(); track category.id) {
                  <option [value]="category.id">{{ category.emoji }} {{ category.name }}</option>
                }
              </select>
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-semibold mb-1">
                Unit
                @if (hasAiAutoFilled()) {
                  <span class="ai-extracted-badge ms-1"><i class="bi bi-stars me-1"></i> AI Extracted</span>
                }
              </label>
              <input class="form-control" placeholder="1 kg, 500g, 1 pc" formControlName="unit" />
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-semibold mb-1">Stock</label>
              <input class="form-control" type="number" placeholder="Stock" formControlName="stock" />
            </div>

            <div class="col-md-3">
              <label class="form-label small fw-semibold mb-1">
                Price (₹)
                @if (hasAiAutoFilled()) {
                  <span class="ai-extracted-badge ms-1"><i class="bi bi-stars me-1"></i> AI Estimated</span>
                }
              </label>
              <input class="form-control" type="number" placeholder="Selling Price" formControlName="price" />
            </div>
            <div class="col-md-3">
              <label class="form-label small fw-semibold mb-1">
                MRP (₹)
                @if (hasAiAutoFilled()) {
                  <span class="ai-extracted-badge ms-1"><i class="bi bi-stars me-1"></i> AI Extracted</span>
                }
              </label>
              <input class="form-control" type="number" placeholder="MRP" formControlName="mrp" />
            </div>
            <div class="col-md-2">
              <label class="form-label small fw-semibold mb-1">Emoji Icon</label>
              <input class="form-control" placeholder="🛍️" formControlName="emoji" />
            </div>
            <div class="col-md-4">
              <label class="form-label small fw-semibold mb-1">Card Tint Color</label>
              <input class="form-control" placeholder="#F4F1E8" formControlName="tint" />
            </div>

            <div class="col-12">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="form-label small fw-semibold mb-0">
                  Search Tags
                  @if (hasAiAutoFilled()) {
                    <span class="ai-extracted-badge ms-1"><i class="bi bi-stars me-1"></i> AI Keywords</span>
                  }
                </label>
              </div>
              <input class="form-control" placeholder="e.g. milk, dairy, toned, breakfast, calcium" formControlName="tags" />
              <div class="form-text" style="font-size: 0.72rem;">Comma-separated keywords for customer search</div>
            </div>

            <div class="col-12 form-check mt-2">
              <input class="form-check-input" type="checkbox" formControlName="isActive" id="productLive" />
              <label class="form-check-label" for="productLive">Live on the storefront shelf</label>
            </div>
          </div>

          <div class="d-flex gap-2 mt-3 pt-2 border-top">
            <button class="btn btn-dark" type="submit" [disabled]="form.invalid || saving()">
              {{ saving() ? 'Saving...' : 'Save Product' }}
            </button>
            <button class="btn btn-outline-dark" type="button" (click)="openForm.set(false)">Close</button>
          </div>
        </form>
      </div>
    }

    <!-- Before & After Comparison Modal -->
    @if (showComparison()) {
      <div class="modal-sheet" (click)="keepOriginal()">
        <div class="comparison-dialog" (click)="$event.stopPropagation()">
          <div class="d-flex justify-content-between align-items-center pb-2 border-bottom">
            <div>
              <h4 class="mb-1 d-flex align-items-center gap-2">
                <span>✨ AI Studio Photo Comparison</span>
                <span class="badge bg-success-subtle text-success border border-success-subtle small">Studio Ready</span>
              </h4>
              <p class="text-muted small mb-0">Compare the raw photo with the AI studio-enhanced catalog shot</p>
            </div>
            <button type="button" class="btn-close" aria-label="Close" (click)="keepOriginal()"></button>
          </div>

          <div class="comparison-grid">
            <!-- Before -->
            <div class="comparison-card">
              <div class="card-header-badge before-badge">
                <span>Before (Original Shot)</span>
                <span class="text-muted small">Raw upload</span>
              </div>
              <div class="comparison-stage">
                <img [src]="originalImage()" alt="Before enhancement" />
              </div>
              <div class="card-features">
                Original lighting & raw surface
              </div>
            </div>

            <!-- After -->
            <div class="comparison-card border-success">
              <div class="card-header-badge after-badge">
                <span>After (AI Studio Enhanced)</span>
                <span class="badge bg-success text-white small">Studio Lighting</span>
              </div>
              <div class="comparison-stage studio-stage">
                <img [src]="enhancedImage()" alt="After enhancement" />
              </div>
              <div class="card-features text-success">
                ✓ Balanced softbox exposure, clean backdrop & soft shadow
              </div>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-2 justify-content-end pt-2 border-top">
            <button type="button" class="btn btn-outline-secondary" (click)="keepOriginal()">
              Keep Original
            </button>
            <button
              type="button"
              class="btn btn-outline-dark d-inline-flex align-items-center gap-1"
              [disabled]="isEnhancing()"
              (click)="enhanceWithAi()"
            >
              🔄 Re-enhance
            </button>
            <button
              type="button"
              class="btn btn-dark d-inline-flex align-items-center gap-1"
              style="background: #0e6b4f; border-color: #0e6b4f"
              (click)="applyAiEnhanced()"
            >
              ✓ Apply AI Enhanced Photo
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Live Camera Viewfinder Modal -->
    @if (showCameraModal()) {
      <div class="camera-modal-backdrop" (click)="closeCamera()">
        <div class="camera-viewfinder-card" (click)="$event.stopPropagation()">
          <div class="d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
            <div>
              <h5 class="h6 fw-bold mb-0 text-white">
                <i class="bi bi-camera me-1 text-success"></i>
                Snap Product Packaging
              </h5>
              <span class="text-secondary small" style="font-size: 0.72rem;">Align product label or barcode in center</span>
            </div>
            <button type="button" class="btn-close btn-close-white" (click)="closeCamera()"></button>
          </div>

          <div class="camera-stage">
            <video #videoElement autoplay playsinline muted class="camera-video-feed"></video>
            <div class="camera-target-reticle"></div>
          </div>

          <div class="p-3 d-flex justify-content-between align-items-center bg-dark">
            <button
              type="button"
              class="btn btn-outline-light btn-sm d-inline-flex align-items-center gap-1"
              (click)="flipCamera()"
              title="Flip between front and rear cameras"
            >
              <i class="bi bi-arrow-repeat"></i> Flip Camera
            </button>

            <button
              type="button"
              class="camera-shutter-btn"
              (click)="captureCameraSnapshot()"
              title="Capture photo and auto-fill product details"
            >
              <i class="bi bi-camera-fill"></i>
            </button>

            <button
              type="button"
              class="btn btn-outline-secondary btn-sm"
              (click)="closeCamera()"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    }

    <!-- AI Packaging Extraction Scanning Overlay -->
    @if (isExtractingDetails()) {
      <div class="modal-sheet" style="z-index: 1060;">
        <div class="panel p-4 text-center scanning-laser-box" style="max-width: 440px; width: 100%; border-radius: 16px; background: white; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
          <div class="laser-sweep-line"></div>
          @if (extractingPreview()) {
            <div class="mb-3 position-relative d-inline-block rounded-3 border overflow-hidden bg-light" style="max-height: 180px;">
              <img [src]="extractingPreview()" alt="Packaging scan" style="max-height: 180px; width: auto; object-fit: contain;" />
            </div>
          } @else {
            <div class="fs-1 text-success mb-2">📸</div>
          }
          <h5 class="h6 fw-bold mb-1">Scanning Product with Gemini 3.8 Flash…</h5>
          <p class="text-muted small mb-3">{{ extractionStepText() }}</p>
          <div class="progress" style="height: 6px; max-width: 280px; margin: 0 auto;">
            <div class="progress-bar progress-bar-striped progress-bar-animated bg-success w-100"></div>
          </div>
        </div>
      </div>
    }
  `,
})
export class AdminProductsPage {
  private readonly admin = inject(AdminService);
  private readonly toasts = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly openForm = signal(false);
  readonly editing = signal<string | null>(null);
  readonly saving = signal(false);

  // Image & AI state
  readonly inputMode = signal<'upload' | 'url'>('upload');
  readonly previewImage = signal<string>('');
  readonly isAiEnhanced = signal<boolean>(false);
  readonly isDragging = signal<boolean>(false);
  readonly isEnhancing = signal<boolean>(false);
  readonly showComparison = signal<boolean>(false);
  readonly originalImage = signal<string>('');
  readonly enhancedImage = signal<string>('');
  readonly enhancedStyle = signal<string>('');

  // AI Auto-Fill & Camera state
  readonly isExtractingDetails = signal<boolean>(false);
  readonly extractionStepText = signal<string>('Reading packaging text with Gemini 3.8 Flash…');
  readonly extractingPreview = signal<string>('');
  readonly hasAiAutoFilled = signal<boolean>(false);
  readonly showCameraModal = signal<boolean>(false);
  readonly cameraFacingMode = signal<'environment' | 'user'>('environment');

  @ViewChild('videoElement') videoElementRef?: ElementRef<HTMLVideoElement>;
  private mediaStream: MediaStream | null = null;

  readonly form = this.fb.nonNullable.group({
    name: ['', Validators.required],
    brand: [''],
    description: [''],
    categoryId: ['', Validators.required],
    unit: ['1 pc', Validators.required],
    stock: [10, Validators.required],
    price: [1, Validators.required],
    mrp: [1, Validators.required],
    emoji: ['🛍️'],
    tint: ['#F4F1E8'],
    imageUrl: [''],
    tags: [''],
    isActive: true,
  });

  constructor() {
    void this.reload();
    void this.admin.categories().then((items) => this.categories.set(items));
  }

  categoryName(product: Product): string {
    if (!product.category) return 'General';
    if (typeof product.category === 'object') return product.category.name;
    const cat = this.categories().find((c) => c.id === product.category);
    return cat ? cat.name : 'General';
  }

  async search(event: Event) {
    event.preventDefault();
    const search = String(new FormData(event.target as HTMLFormElement).get('q') || '');
    this.products.set((await this.admin.products(search)).items);
  }

  open(product?: Product) {
    this.editing.set(product?.id ?? null);
    const categoryId = product && typeof product.category === 'object' ? product.category.id : this.categories()[0]?.id || '';
    const img = product?.imageUrl || '';
    this.previewImage.set(img);
    this.isAiEnhanced.set(img.includes('studio') || img.includes('data:image/svg+xml') || img.includes('gemini'));
    this.inputMode.set(img.startsWith('http') ? 'url' : 'upload');
    this.hasAiAutoFilled.set(false);

    const tagsStr = Array.isArray(product?.tags) ? product.tags.join(', ') : (product?.tags || '');

    this.form.reset({
      name: product?.name || '',
      brand: product?.brand || '',
      description: product?.description || '',
      categoryId,
      unit: product?.unit || '1 pc',
      stock: product?.stock ?? 10,
      price: product?.price ?? 1,
      mrp: product?.mrp ?? 1,
      emoji: product?.emoji || '🛍️',
      tint: product?.tint || '#F4F1E8',
      imageUrl: img,
      tags: tagsStr,
      isActive: product?.isActive ?? true,
    });
    this.openForm.set(true);
  }

  // Camera handling
  async openCameraCapture() {
    this.showCameraModal.set(true);
    setTimeout(() => {
      void this.startCameraStream();
    }, 150);
  }

  async startCameraStream() {
    this.stopCameraStream();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access not supported on this device');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.cameraFacingMode(),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      this.mediaStream = stream;
      if (this.videoElementRef?.nativeElement) {
        this.videoElementRef.nativeElement.srcObject = stream;
        await this.videoElementRef.nativeElement.play();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      this.toasts.error('Camera unavailable or permission denied. Please upload a photo instead.');
      this.closeCamera();
    }
  }

  flipCamera() {
    this.cameraFacingMode.set(this.cameraFacingMode() === 'environment' ? 'user' : 'environment');
    void this.startCameraStream();
  }

  captureCameraSnapshot() {
    const video = this.videoElementRef?.nativeElement;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

    this.closeCamera();

    if (!this.openForm()) {
      this.open();
    }

    void this.runAiAutoFill(dataUrl);
  }

  closeCamera() {
    this.stopCameraStream();
    this.showCameraModal.set(false);
  }

  stopCameraStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  // AI Auto-Fill via file upload
  async onAutoFillFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      try {
        const dataUrl = await this.compressImage(file);
        if (!this.openForm()) {
          this.open();
        }
        await this.runAiAutoFill(dataUrl);
      } catch (err) {
        this.toasts.error('Failed to read image file');
      }
    }
    input.value = '';
  }

  async runAiAutoFill(base64Image: string) {
    this.isExtractingDetails.set(true);
    this.extractingPreview.set(base64Image);
    this.extractionStepText.set('Reading packaging with Gemini 3.8 Flash…');

    const step1 = setTimeout(() => {
      this.extractionStepText.set('Extracting brand, product title & net quantity…');
    }, 800);

    const step2 = setTimeout(() => {
      this.extractionStepText.set('Estimating retail pricing & matching category…');
    }, 1800);

    try {
      const response = await this.admin.extractProductDetails(base64Image);
      clearTimeout(step1);
      clearTimeout(step2);

      const d = response.details;
      this.previewImage.set(base64Image);
      this.form.controls.imageUrl.setValue(base64Image);

      if (d.name) this.form.controls.name.setValue(d.name);
      if (d.brand) this.form.controls.brand.setValue(d.brand);
      if (d.description) this.form.controls.description.setValue(d.description);
      if (d.unit) this.form.controls.unit.setValue(d.unit);
      if (d.price) this.form.controls.price.setValue(d.price);
      if (d.mrp) this.form.controls.mrp.setValue(d.mrp);
      if (d.emoji) this.form.controls.emoji.setValue(d.emoji);

      if (d.tags && Array.isArray(d.tags)) {
        this.form.controls.tags.setValue(d.tags.join(', '));
      }

      if (d.categoryId) {
        const found = this.categories().find((c) => c.id === d.categoryId);
        if (found) {
          this.form.controls.categoryId.setValue(found.id);
        } else if (this.categories().length > 0) {
          this.form.controls.categoryId.setValue(this.categories()[0].id);
        }
      }

      this.hasAiAutoFilled.set(true);
      this.toasts.show('✨ Product details auto-filled by Gemini AI! Please review before saving.');
    } catch (err) {
      clearTimeout(step1);
      clearTimeout(step2);
      this.toasts.error(errorMessage(err) || 'Failed to auto-fill product details');
    } finally {
      this.isExtractingDetails.set(false);
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      void this.processImageFile(file);
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      void this.processImageFile(file);
    }
    input.value = '';
  }

  onUrlInput(event: Event) {
    const url = (event.target as HTMLInputElement).value.trim();
    this.previewImage.set(url);
    this.isAiEnhanced.set(false);
  }

  onUrlError() {
    this.toasts.error('Could not load image from the provided URL. Please verify link.');
  }

  clearImage() {
    this.previewImage.set('');
    this.isAiEnhanced.set(false);
    this.form.controls.imageUrl.setValue('');
  }

  private async processImageFile(file: File) {
    try {
      const dataUrl = await this.compressImage(file);
      this.previewImage.set(dataUrl);
      this.isAiEnhanced.set(false);
      this.form.controls.imageUrl.setValue(dataUrl);

      // If creating a new product and name is empty or default, automatically run AI auto-fill
      const currentName = this.form.controls.name.value?.trim() || '';
      if (!this.editing() && (!currentName || currentName === 'Fresh Grocery Item')) {
        await this.runAiAutoFill(dataUrl);
      }
    } catch (err) {
      this.toasts.error('Failed to process image file.');
    }
  }

  private compressImage(file: File, maxDimension = 1024, quality = 0.88): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async enhanceWithAi() {
    const image = this.previewImage();
    if (!image) {
      this.toasts.error('Please upload or enter an image URL first');
      return;
    }
    const name = this.form.controls.name.value || 'Product';
    const catId = this.form.controls.categoryId.value;
    const cat = this.categories().find((c) => c.id === catId)?.name || 'Grocery';

    this.isEnhancing.set(true);
    try {
      const result = await this.admin.aiEnhanceProductImage({ image, name, category: cat });
      this.originalImage.set(image);
      this.enhancedImage.set(result.enhancedImage);
      this.enhancedStyle.set(result.style);
      this.showComparison.set(true);
    } catch (err) {
      this.toasts.error(errorMessage(err) || 'AI enhancement failed. Please try again.');
    } finally {
      this.isEnhancing.set(false);
    }
  }

  applyAiEnhanced() {
    const enhanced = this.enhancedImage();
    if (enhanced) {
      this.form.controls.imageUrl.setValue(enhanced);
      this.previewImage.set(enhanced);
      this.isAiEnhanced.set(true);
      this.showComparison.set(false);
      this.toasts.show('✨ Applied AI Studio photo to product!');
    }
  }

  keepOriginal() {
    this.showComparison.set(false);
  }

  async save() {
    this.saving.set(true);
    const raw = this.form.getRawValue();
    const tagsArray = typeof raw.tags === 'string'
      ? raw.tags.split(',').map((t) => t.trim()).filter(Boolean)
      : (raw.tags || []);

    const payload = {
      ...raw,
      price: Number(raw.price),
      mrp: Number(raw.mrp),
      stock: Number(raw.stock),
      imageUrl: this.previewImage() || raw.imageUrl || '',
      tags: tagsArray,
    };
    try {
      await this.admin.saveProduct(payload, this.editing() || undefined);
      this.openForm.set(false);
      await this.reload();
      this.toasts.show('Product saved successfully');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    } finally {
      this.saving.set(false);
    }
  }

  async archive(product: Product) {
    try {
      await this.admin.archiveProduct(product.id);
      await this.reload();
      this.toasts.show('Product archived');
    } catch (error) {
      this.toasts.error(errorMessage(error));
    }
  }

  private async reload() {
    this.products.set((await this.admin.products()).items);
  }
}

