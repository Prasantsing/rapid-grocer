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
  templateUrl: './admin-products.page.html',
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

  // 3-Angle Commercial Product Photo Studio State
  readonly photoSlots = signal<{ front: string; back: string; detail: string }>({
    front: '',
    back: '',
    detail: '',
  });
  readonly rawSlots = signal<{ front: string; back: string; detail: string }>({
    front: '',
    back: '',
    detail: '',
  });
  readonly isSlotRefined = signal<{ front: boolean; back: boolean; detail: boolean }>({
    front: false,
    back: false,
    detail: false,
  });
  readonly activeTargetSlot = signal<'front' | 'back' | 'detail'>('front');
  readonly refiningSlot = signal<'front' | 'back' | 'detail' | null>(null);

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
    
    const frontImg = product?.imageSlots?.front || product?.imageUrl || (product?.images && product?.images[0]) || '';
    const backImg = product?.imageSlots?.back || (product?.images && product?.images[1]) || '';
    const detailImg = product?.imageSlots?.detail || (product?.images && product?.images[2]) || '';

    this.photoSlots.set({ front: frontImg, back: backImg, detail: detailImg });
    this.rawSlots.set({ front: frontImg, back: backImg, detail: detailImg });
    this.isSlotRefined.set({
      front: frontImg.includes('studio') || frontImg.includes('data:image/svg+xml'),
      back: backImg.includes('studio') || backImg.includes('data:image/svg+xml'),
      detail: detailImg.includes('studio') || detailImg.includes('data:image/svg+xml'),
    });

    this.previewImage.set(frontImg);
    this.isAiEnhanced.set(frontImg.includes('studio') || frontImg.includes('data:image/svg+xml') || frontImg.includes('gemini'));
    this.inputMode.set(frontImg.startsWith('http') ? 'url' : 'upload');
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
      imageUrl: frontImg,
      tags: tagsStr,
      isActive: product?.isActive ?? true,
    });
    this.openForm.set(true);
  }

  hasAnyPhotos(): boolean {
    const s = this.photoSlots();
    return !!(s.front || s.back || s.detail);
  }

  isRefiningAny(): boolean {
    return this.refiningSlot() !== null;
  }

  openCameraForSlot(slot: 'front' | 'back' | 'detail') {
    this.activeTargetSlot.set(slot);
    void this.openCameraCapture();
  }

  async onSlotFileSelected(event: Event, slot: 'front' | 'back' | 'detail') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      try {
        const dataUrl = await this.compressImage(file);
        this.photoSlots.update((s) => ({ ...s, [slot]: dataUrl }));
        this.rawSlots.update((s) => ({ ...s, [slot]: dataUrl }));
        this.isSlotRefined.update((s) => ({ ...s, [slot]: false }));
        if (slot === 'front') {
          this.previewImage.set(dataUrl);
          this.form.controls.imageUrl.setValue(dataUrl);
          if (!this.form.value.name) {
            void this.runAiAutoFill(dataUrl);
          }
        }
        await this.refineSlot(slot, dataUrl);
      } catch {
        this.toasts.error('Failed to read image file');
      }
    }
    input.value = '';
  }

  async refineSlot(slot: 'front' | 'back' | 'detail', rawImg?: string) {
    const current = rawImg || this.photoSlots()[slot];
    if (!current) return;
    this.refiningSlot.set(slot);
    try {
      let refined = '';
      try {
        const res = await this.admin.aiEnhanceProductImage({
          image: current,
          name: this.form.value.name || 'Product',
          category: this.form.value.categoryId,
        });
        if (res && res.enhancedImage) {
          refined = res.enhancedImage;
        }
      } catch {
        refined = await this.createCanvasStudioEnhanced(current);
      }
      if (!refined) {
        refined = await this.createCanvasStudioEnhanced(current);
      }
      this.photoSlots.update((s) => ({ ...s, [slot]: refined }));
      this.isSlotRefined.update((s) => ({ ...s, [slot]: true }));
      if (slot === 'front') {
        this.previewImage.set(refined);
        this.form.controls.imageUrl.setValue(refined);
      }
      const label = slot === 'front' ? 'Front' : slot === 'back' ? 'Back' : 'Detail';
      this.toasts.show(`✨ ${label} view refined on clean studio white background!`);
    } catch {
      this.toasts.error(`Could not refine ${slot} view photo`);
    } finally {
      this.refiningSlot.set(null);
    }
  }

  async refineAllSlots() {
    const slots = (['front', 'back', 'detail'] as const).filter((slot) => !!this.photoSlots()[slot]);
    for (const slot of slots) {
      await this.refineSlot(slot);
    }
  }

  revertSlotToRaw(slot: 'front' | 'back' | 'detail') {
    const raw = this.rawSlots()[slot];
    if (raw) {
      this.photoSlots.update((s) => ({ ...s, [slot]: raw }));
      this.isSlotRefined.update((s) => ({ ...s, [slot]: false }));
      if (slot === 'front') {
        this.previewImage.set(raw);
        this.form.controls.imageUrl.setValue(raw);
      }
      this.toasts.show(`Reverted ${slot} view to raw photo.`);
    }
  }

  clearSlot(slot: 'front' | 'back' | 'detail') {
    this.photoSlots.update((s) => ({ ...s, [slot]: '' }));
    this.rawSlots.update((s) => ({ ...s, [slot]: '' }));
    this.isSlotRefined.update((s) => ({ ...s, [slot]: false }));
    if (slot === 'front') {
      const next = this.photoSlots().back || this.photoSlots().detail || '';
      this.previewImage.set(next);
      this.form.controls.imageUrl.setValue(next);
    }
  }

  createCanvasStudioEnhanced(rawImageSrc: string): Promise<string> {
    return this.renderStudioSquareCanvas(rawImageSrc, null, 0.12);
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

    const targetSlot = this.activeTargetSlot();
    this.photoSlots.update((s) => ({ ...s, [targetSlot]: dataUrl }));
    this.rawSlots.update((s) => ({ ...s, [targetSlot]: dataUrl }));
    this.isSlotRefined.update((s) => ({ ...s, [targetSlot]: false }));
    if (targetSlot === 'front') {
      this.previewImage.set(dataUrl);
      this.form.controls.imageUrl.setValue(dataUrl);
    }

    this.closeCamera();

    if (!this.openForm()) {
      this.open();
    }

    void this.refineSlot(targetSlot, dataUrl);

    if (targetSlot === 'front' && !this.form.value.name) {
      void this.runAiAutoFill(dataUrl);
    }
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

        // 1. Studio Clean White Seamless Background (#ffffff)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 1000, 1000);

        // 2. Calculate Centered 1:1 Dimensions inside 1000x1000
        const maxDim = Math.max(cropW, cropH);
        const scale = 780 / maxDim;
        const destW = Math.round(cropW * scale);
        const destH = Math.round(cropH * scale);
        const destX = Math.round((1000 - destW) / 2);
        const destY = Math.round(480 - destH / 2);

        // 3. Ground Softbox Contact Drop Shadows on Studio White
        const shadowY = Math.min(910, destY + destH - 6);
        const shadowRx = Math.min(360, destW * 0.44);

        ctx.save();
        ctx.filter = 'blur(16px)';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
        ctx.beginPath();
        ctx.ellipse(500, shadowY, shadowRx, 18, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.filter = 'blur(4px)';
        ctx.fillStyle = 'rgba(15, 23, 42, 0.20)';
        ctx.beginPath();
        ctx.ellipse(500, shadowY, shadowRx * 0.72, 7, 0, 0, Math.PI * 2);
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

    const slots = this.photoSlots();
    const imagesList = [slots.front, slots.back, slots.detail].filter(Boolean);
    const primaryImg = slots.front || slots.back || slots.detail || this.previewImage() || raw.imageUrl || '';

    const payload = {
      ...raw,
      price: Number(raw.price),
      mrp: Number(raw.mrp),
      stock: Number(raw.stock),
      imageUrl: primaryImg,
      images: imagesList,
      imageSlots: {
        front: slots.front || primaryImg || '',
        back: slots.back || '',
        detail: slots.detail || '',
      },
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

