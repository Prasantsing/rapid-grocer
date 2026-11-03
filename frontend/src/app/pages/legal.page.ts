import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShopService } from '../core/shop.service';
import { ToastService } from '../core/toast.service';

type LegalTab = 'terms' | 'privacy' | 'refunds' | 'contact' | 'fssai';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './legal.page.html',
  styleUrl: './legal.page.scss',
})
export class LegalPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeTab = signal<LegalTab>('terms');

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const tab = params.get('tab') as LegalTab;
      if (tab && ['terms', 'privacy', 'refunds', 'contact', 'fssai'].includes(tab)) {
        this.activeTab.set(tab);
      }
    });

    // Check query params if any
    this.route.queryParamMap.subscribe((query) => {
      const tab = query.get('tab') as LegalTab;
      if (tab && ['terms', 'privacy', 'refunds', 'contact', 'fssai'].includes(tab)) {
        this.activeTab.set(tab);
      }
    });
  }

  setTab(tab: LegalTab) {
    this.activeTab.set(tab);
    void this.router.navigate(['/legal', tab]);
  }
}
