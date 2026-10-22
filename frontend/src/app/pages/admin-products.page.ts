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
                <span>✨ AI Studio Photo Lab</span>
                <span class="badge bg-success-subtle text-success border border-success-subtle small">1:1 Catalog Standard</span>
              </h4>
              <p class="text-muted small mb-0">
                Primary item focused & isolated from background clutter with softbox studio lighting
              </p>
            </div>
            <button type="button" class="btn-close" aria-label="Close" (click)="keepOriginal()"></button>
          </div>

          <div class="comparison-grid">
            <!-- Before -->
            <div class="comparison-card">
              <div class="card-header-badge before-badge">
                <span>Before (Raw Capture)</span>
                <span class="text-muted small">Original Shot</span>
              </div>
              <div class="comparison-stage position-relative overflow-hidden">
                <div class="position-relative d-inline-block">
                  <img [src]="originalImage()" alt="Raw photo capture" class="img-fluid" />
                  @if (detectedBox()) {
                    <div
                      class="detected-box-overlay"
                      [style.top.%]="detectedBox()![0] / 10"
                      [style.left.%]="detectedBox()![1] / 10"
                      [style.height.%]="(detectedBox()![2] - detectedBox()![0]) / 10"
                      [style.width.%]="(detectedBox()![3] - detectedBox()![1]) / 10"
                    >
                      <span class="detected-box-tag">
                        <i class="bi bi-bullseye"></i> {{ detectedSubject() }}
                      </span>
                    </div>
                  }
                </div>
              </div>
              <div class="card-features d-flex justify-content-between align-items-center">
                <span>Raw background, uneven ambient light</span>
                @if (detectedSubject()) {
                  <span class="badge bg-light text-dark border small">🎯 {{ detectedSubject() }}</span>
                }
              </div>
            </div>

            <!-- After -->
            <div class="comparison-card border-success">
              <div class="card-header-badge after-badge">
                <span>After (AI Studio Catalog Shot)</span>
                <span class="badge bg-success text-white small">✨ 1:1 Studio</span>
              </div>
              <div class="comparison-stage studio-stage square-stage position-relative">
                <img [src]="enhancedImage()" alt="AI Studio Enhanced 1:1 catalog shot" class="studio-product-preview shadow-sm" />
                <span class="badge bg-dark bg-opacity-75 position-absolute bottom-0 end-0 m-2">1:1 Square</span>
              </div>
              <div class="card-features">
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
                  <span class="text-success small fw-semibold">
                    <i class="bi bi-check-circle-fill me-1"></i> Clean Cyclorama Backdrop & Soft Drop-Shadow
                  </span>
                  <div class="d-flex align-items-center gap-1">
                    <span class="small text-muted" style="font-size: 0.7rem;">Margin:</span>
                    <div class="crop-margin-btn-group">
                      <button type="button" [class.active]="cropMarginMode() === 'tight'" (click)="changeCropMargin('tight')" title="Tight framing with minimal margin">Tight</button>
                      <button type="button" [class.active]="cropMarginMode() === 'balanced'" (click)="changeCropMargin('balanced')" title="Standard e-commerce catalog padding">Balanced</button>
                      <button type="button" [class.active]="cropMarginMode() === 'wide'" (click)="changeCropMargin('wide')" title="Wider padding for large products">Wide</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center pt-2 border-top">
            <div class="small text-muted">
              @if (detectedSummary()) {
                <i class="bi bi-info-circle me-1 text-primary"></i> {{ detectedSummary() }}
              }
            </div>
            <div class="d-flex gap-2">
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
                ✓ Apply AI Studio Shot (1:1)
              </button>
            </div>
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
  readonly detectedSubject = signal<string>('Product');
  readonly detectedConfidence = signal<string>('High');
  readonly detectedBox = signal<number[] | null>(null);
  readonly detectedSummary = signal<string>('');
  readonly cropMarginMode = signal<'tight' | 'balanced' | 'wide'>('balanced');

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
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    this.closeCamera();

    if (!this.openForm()) {
      this.open();
    }

    void this.autoEnhanceAndReview(dataUrl);
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
        await this.autoEnhanceAndReview(dataUrl);
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

      await this.autoEnhanceAndReview(dataUrl);
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

  private getMarginPercent(): number {
    const mode = this.cropMarginMode();
    return mode === 'tight' ? 0.07 : mode === 'wide' ? 0.23 : 0.14;
  }

  async changeCropMargin(mode: 'tight' | 'balanced' | 'wide') {
    this.cropMarginMode.set(mode);
    const raw = this.originalImage();
    if (raw) {
      const margin = this.getMarginPercent();
      const reRendered = await this.renderStudioSquareCanvas(raw, this.detectedBox(), margin);
      this.enhancedImage.set(reRendered);
    }
  }

  async autoEnhanceAndReview(dataUrl: string) {
    this.originalImage.set(dataUrl);
    this.previewImage.set(dataUrl);
    this.isEnhancing.set(true);

    const currentName = this.form.controls.name.value?.trim() || 'Product';
    const catId = this.form.controls.categoryId.value;
    const cat = this.categories().find((c) => c.id === catId)?.name || 'General';

    try {
      // 1. Run AI Subject Focus & Studio Analysis
      const result = await this.admin.aiEnhanceProductImage({
        image: dataUrl,
        name: currentName,
        category: cat,
      });

      this.detectedSubject.set(result.detectedProduct || 'Product');
      this.detectedConfidence.set(result.confidence || 'High');
      this.detectedBox.set(result.box_2d || null);
      this.detectedSummary.set(result.summary || 'Product isolated and centered onto 1:1 studio backdrop');
      this.enhancedStyle.set(result.style || 'AI Studio Focus');

      // 2. Render crisp 1:1 square canvas
      const margin = this.getMarginPercent();
      const studio1x1 = await this.renderStudioSquareCanvas(dataUrl, result.box_2d, margin);
      this.enhancedImage.set(studio1x1 || result.enhancedImage);

      // Open side-by-side review
      this.showComparison.set(true);

      // 3. Auto-fill form details if new product or default title
      if (!this.editing() || !this.form.controls.name.value) {
        void this.runAiAutoFill(dataUrl);
      }
    } catch (err) {
      console.warn('Auto enhance notice:', err);
      // Fallback: render default 1:1 canvas
      const fallback1x1 = await this.renderStudioSquareCanvas(dataUrl, null, 0.14);
      this.enhancedImage.set(fallback1x1);
      this.showComparison.set(true);
    } finally {
      this.isEnhancing.set(false);
    }
  }

  renderStudioSquareCanvas(
    rawImageSrc: string,
    box_2d?: number[] | null,
    marginPercent = 0.14
  ): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const nw = img.naturalWidth || 800;
        const nh = img.naturalHeight || 800;

        let ymin = 100;
        let xmin = 100;
        let ymax = 900;
        let xmax = 900;
        if (Array.isArray(box_2d) && box_2d.length === 4) {
          ymin = Math.max(0, Math.min(1000, Number(box_2d[0]) || 100));
          xmin = Math.max(0, Math.min(1000, Number(box_2d[1]) || 100));
          ymax = Math.max(ymin + 40, Math.min(1000, Number(box_2d[2]) || 900));
          xmax = Math.max(xmin + 40, Math.min(1000, Number(box_2d[3]) || 900));
        }

        const rawX = (xmin / 1000) * nw;
        const rawY = (ymin / 1000) * nh;
        const rawW = Math.max(20, ((xmax - xmin) / 1000) * nw);
        const rawH = Math.max(20, ((ymax - ymin) / 1000) * nh);

        // Add breathing padding margin
        const pad = Math.max(rawW, rawH) * marginPercent;
        const cropX = Math.max(0, rawX - pad);
        const cropY = Math.max(0, rawY - pad);
        const cropW = Math.min(nw - cropX, rawW + 2 * pad);
        const cropH = Math.min(nh - cropY, rawH + 2 * pad);

        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = 1000;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawImageSrc);
          return;
        }

        // 1. Studio Seamless Cyclorama Background
        const grad = ctx.createRadialGradient(500, 420, 60, 500, 500, 750);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.58, '#f8fafc');
        grad.addColorStop(1, '#e9eef5');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1000, 1000);

        // 2. Calculate Centered 1:1 Dimensions inside 1000x1000
        const maxDim = Math.max(cropW, cropH);
        const scale = 780 / maxDim;
        const destW = Math.round(cropW * scale);
        const destH = Math.round(cropH * scale);
        const destX = Math.round((1000 - destW) / 2);
        const destY = Math.round(480 - destH / 2);

        // 3. Ground Softbox Contact Drop Shadows
        const shadowY = Math.min(910, destY + destH - 10);
        const shadowRx = Math.min(360, destW * 0.44);

        ctx.save();
        ctx.filter = 'blur(16px)';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.16)';
        ctx.beginPath();
        ctx.ellipse(500, shadowY, shadowRx, 22, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.filter = 'blur(5px)';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.24)';
        ctx.beginPath();
        ctx.ellipse(500, shadowY, shadowRx * 0.72, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 4. Draw Isolated Product with Soft Rounded Clip & Color Polish
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(destX, destY, destW, destH, 18);
        ctx.clip();
        ctx.filter = 'contrast(1.05) brightness(1.02) saturate(1.04)';
        ctx.drawImage(img, cropX, cropY, cropW, cropH, destX, destY, destW, destH);
        ctx.restore();

        // 5. Subtle crisp perimeter border
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.05)';
        ctx.lineWidth = 2;
        ctx.strokeRect(1, 1, 998, 998);

        resolve(canvas.toDataURL('image/jpeg', 0.94));
      };
      img.onerror = () => resolve(rawImageSrc);
      img.src = rawImageSrc;
    });
  }

  async enhanceWithAi() {
    const image = this.originalImage() || this.previewImage();
    if (!image) {
      this.toasts.error('Please upload or enter an image URL first');
      return;
    }
    await this.autoEnhanceAndReview(image);
  }

  applyAiEnhanced() {
    const enhanced = this.enhancedImage();
    if (enhanced) {
      this.form.controls.imageUrl.setValue(enhanced);
      this.previewImage.set(enhanced);
      this.isAiEnhanced.set(true);
      this.showComparison.set(false);
      this.toasts.show('✨ Applied 1:1 Studio Catalog photo to product!');
    }
  }

  keepOriginal() {
    const raw = this.originalImage();
    if (raw) {
      this.previewImage.set(raw);
      this.form.controls.imageUrl.setValue(raw);
      this.isAiEnhanced.set(false);
      this.toasts.show('Kept original raw photo.');
    }
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

