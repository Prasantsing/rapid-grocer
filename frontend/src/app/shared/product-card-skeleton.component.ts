import { Component } from '@angular/core';

@Component({
  selector: 'app-product-card-skeleton',
  standalone: true,
  template: `
    <article class="tile skeleton-card" aria-hidden="true">
      <div class="tile-media-wrap">
        <div class="tile-art skeleton-art skeleton-shimmer"></div>
        <div class="card-action-bar p-1">
          <div class="skeleton-btn skeleton-shimmer"></div>
        </div>
      </div>
      <div class="tile-body">
        <div class="skeleton-line unit-line skeleton-shimmer"></div>
        <div class="skeleton-line title-line-1 skeleton-shimmer"></div>
        <div class="skeleton-line title-line-2 skeleton-shimmer"></div>
        <div class="price-row mt-2">
          <div class="skeleton-line price-pill skeleton-shimmer"></div>
          <div class="skeleton-line mrp-pill skeleton-shimmer ms-2"></div>
        </div>
      </div>
    </article>
  `,
  styles: [`
    :host {
      display: block;
    }

    .skeleton-card {
      pointer-events: none;
      user-select: none;
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .tile-media-wrap {
      position: relative;
      display: flex;
      flex-direction: column;
    }

    .skeleton-art {
      width: 100%;
      aspect-ratio: 1;
      border-radius: var(--border-radius, 1rem) var(--border-radius, 1rem) 0 0;
    }

    .card-action-bar {
      padding: 0.35rem 0.6rem;
    }

    .skeleton-btn {
      width: 100%;
      height: 32px;
      border-radius: 999px;
    }

    .skeleton-line {
      height: 12px;
      margin-bottom: 0.45rem;
      border-radius: 6px;
    }

    .unit-line {
      width: 35%;
      height: 10px;
      margin-top: 0.25rem;
      margin-bottom: 0.45rem;
    }

    .title-line-1 {
      width: 88%;
      height: 14px;
      margin-bottom: 0.35rem;
    }

    .title-line-2 {
      width: 60%;
      height: 14px;
      margin-bottom: 0.65rem;
    }

    .price-pill {
      width: 58px;
      height: 18px;
      margin-bottom: 0;
    }

    .mrp-pill {
      width: 44px;
      height: 14px;
      margin-bottom: 0;
    }
  `],
})
export class ProductCardSkeletonComponent {}
