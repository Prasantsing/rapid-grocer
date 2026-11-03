import {
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Product } from '../core/models';
import { ShopService } from '../core/shop.service';
import { InrPipe } from './inr.pipe';
import { VoiceSearchModalComponent } from './voice-search-modal.component';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [RouterLink, InrPipe, VoiceSearchModalComponent],
  templateUrl: './search-bar.component.html',
  styleUrl: './search-bar.component.scss',
})
export class SearchBarComponent implements OnInit, OnDestroy {
  private readonly shop = inject(ShopService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly elementRef = inject(ElementRef);

  readonly searchTerm = signal<string>('');
  readonly liveResults = signal<Product[]>([]);
  readonly isSearching = signal<boolean>(false);
  readonly isOpen = signal<boolean>(false);
  readonly isFocused = signal<boolean>(false);
  readonly showVoiceModal = signal<boolean>(false);

  private debounceTimer: any = null;

  getItemCategoryName(item: Product): string {
    if (!item.category) return '';
    if (typeof item.category === 'string') return item.category;
    return item.category.name || '';
  }

  ngOnInit() {
    this.syncFromUrl();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.syncFromUrl();
    });
  }

  ngOnDestroy() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  private syncFromUrl() {
    let currentRoute: ActivatedRoute | null = this.route;
    while (currentRoute?.firstChild) {
      currentRoute = currentRoute.firstChild;
    }

    if (currentRoute) {
      const q = currentRoute.snapshot.queryParamMap.get('q') || '';
      this.searchTerm.set(q);
    }
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const value = target.value;
    this.searchTerm.set(value);

    if (this.debounceTimer) clearTimeout(this.debounceTimer);

    const query = value.trim();
    if (query.length >= 2) {
      this.isOpen.set(true);
      this.isSearching.set(true);
      this.debounceTimer = setTimeout(() => {
        this.fetchLiveResults(query);
      }, 220);
    } else {
      this.liveResults.set([]);
      this.isSearching.set(false);
      this.isOpen.set(false);
    }
  }

  private fetchLiveResults(query: string) {
    void this.shop
      .products({
        search: query,
        limit: 6,
      })
      .then((page) => {
        this.liveResults.set(page.items);
      })
      .catch(() => {
        this.liveResults.set([]);
      })
      .finally(() => {
        this.isSearching.set(false);
      });
  }

  onInputFocus() {
    this.isFocused.set(true);
    if (this.searchTerm().trim().length >= 2) {
      this.isOpen.set(true);
      if (this.liveResults().length === 0) {
        this.fetchLiveResults(this.searchTerm().trim());
      }
    }
  }

  clearSearch() {
    this.searchTerm.set('');
    this.liveResults.set([]);
    this.isOpen.set(false);
    this.submitFilter();
  }

  onSubmit(event: Event) {
    event.preventDefault();
    this.submitFilter();
  }

  submitFilter() {
    this.closeDropdown();
    const query = this.searchTerm().trim();
    void this.router.navigate(['/'], {
      queryParams: query ? { q: query } : {},
    });
  }

  openVoiceSearch(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.closeDropdown();
    this.showVoiceModal.set(true);
  }

  onVoiceQuery(query: string) {
    this.showVoiceModal.set(false);
    if (query && query.trim()) {
      this.searchTerm.set(query.trim());
      this.submitFilter();
    }
  }

  onSelectProduct() {
    this.closeDropdown();
  }

  closeDropdown() {
    this.isOpen.set(false);
    this.isFocused.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.closeDropdown();
    }
  }
}
