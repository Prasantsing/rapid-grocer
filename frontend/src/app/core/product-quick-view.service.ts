import { Injectable, signal } from '@angular/core';
import { Product } from './models';

export interface NutritionFacts {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  calcium?: string;
  servingSize: string;
}

@Injectable({ providedIn: 'root' })
export class ProductQuickViewService {
  readonly activeProduct = signal<Product | null>(null);
  readonly isOpen = signal<boolean>(false);

  open(product: Product) {
    this.activeProduct.set(product);
    this.isOpen.set(true);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(12);
      } catch (_) {}
    }

    if (typeof document !== 'undefined') {
      document.body.style.overflow = 'hidden';
    }
  }

  close() {
    this.isOpen.set(false);
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    setTimeout(() => {
      if (!this.isOpen()) {
        this.activeProduct.set(null);
      }
    }, 280);
  }

  /**
   * Derive intelligent nutrition facts based on product category, tags, and unit.
   */
  getNutrition(product: Product): NutritionFacts {
    const name = product.name.toLowerCase();
    const cat = (typeof product.category === 'object' ? product.category.name : product.category || '').toLowerCase();
    const tags = product.tags.map((t) => t.toLowerCase()).join(' ');

    // 1. Dairy & Milk
    if (cat.includes('dairy') || name.includes('milk') || name.includes('curd') || name.includes('paneer') || name.includes('cheese')) {
      if (name.includes('paneer')) {
        return { calories: 295, protein: 18.2, carbs: 3.5, fat: 22.8, calcium: '480 mg', servingSize: '100g' };
      }
      if (name.includes('curd') || name.includes('dahi') || name.includes('yogurt')) {
        return { calories: 61, protein: 3.5, carbs: 4.7, fat: 3.2, calcium: '140 mg', servingSize: '100g' };
      }
      if (name.includes('cheese')) {
        return { calories: 310, protein: 20.0, carbs: 2.1, fat: 25.0, calcium: '650 mg', servingSize: '100g' };
      }
      return { calories: 59, protein: 3.2, carbs: 4.8, fat: 3.1, calcium: '120 mg', servingSize: '100ml' };
    }

    // 2. Fresh Fruits & Vegetables
    if (cat.includes('produce') || cat.includes('fruit') || cat.includes('veggie') || tags.includes('fresh')) {
      if (name.includes('banana')) {
        return { calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, fiber: 2.6, servingSize: '100g' };
      }
      if (name.includes('apple')) {
        return { calories: 52, protein: 0.3, carbs: 13.8, fat: 0.2, fiber: 2.4, servingSize: '100g' };
      }
      if (name.includes('potato') || name.includes('aloo')) {
        return { calories: 77, protein: 2.0, carbs: 17.5, fat: 0.1, fiber: 2.2, servingSize: '100g' };
      }
      if (name.includes('tomato')) {
        return { calories: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2, servingSize: '100g' };
      }
      if (name.includes('onion')) {
        return { calories: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7, servingSize: '100g' };
      }
      return { calories: 34, protein: 1.4, carbs: 7.2, fat: 0.2, fiber: 2.8, servingSize: '100g' };
    }

    // 3. Bakery & Bread
    if (cat.includes('bread') || cat.includes('bakery') || name.includes('bread') || name.includes('pav') || name.includes('bun')) {
      return { calories: 265, protein: 8.8, carbs: 49.2, fat: 3.2, fiber: 3.8, servingSize: '100g' };
    }

    // 4. Munchies, Snacks, Chips & Biscuits
    if (cat.includes('snack') || cat.includes('munchies') || name.includes('chip') || name.includes('cookie') || name.includes('biscuit')) {
      return { calories: 492, protein: 6.5, carbs: 62.0, fat: 24.5, fiber: 2.1, servingSize: '100g' };
    }

    // 5. Atta, Rice, Dal & Staples
    if (cat.includes('staple') || name.includes('atta') || name.includes('rice') || name.includes('dal') || name.includes('oil')) {
      if (name.includes('oil') || name.includes('ghee')) {
        return { calories: 884, protein: 0, carbs: 0, fat: 100, servingSize: '100ml' };
      }
      if (name.includes('dal') || name.includes('pulse')) {
        return { calories: 343, protein: 24.0, carbs: 59.0, fat: 1.5, fiber: 10.8, servingSize: '100g' };
      }
      return { calories: 340, protein: 11.5, carbs: 72.0, fat: 1.7, fiber: 11.0, servingSize: '100g' };
    }

    // 6. Beverages & Juices
    if (cat.includes('beverage') || name.includes('juice') || name.includes('tea') || name.includes('coffee') || name.includes('drink')) {
      return { calories: 42, protein: 0.4, carbs: 10.2, fat: 0.1, servingSize: '100ml' };
    }

    // Default Balanced Profile
    return {
      calories: 145,
      protein: 4.8,
      carbs: 22.0,
      fat: 4.2,
      fiber: 2.4,
      servingSize: '100g',
    };
  }
}
