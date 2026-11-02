import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { StoreShell } from './layout/store-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/auth.page').then((m) => m.AuthPage),
    canActivate: [guestGuard],
    data: { mode: 'login' },
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth.page').then((m) => m.AuthPage),
    canActivate: [guestGuard],
    data: { mode: 'register' },
  },
  {
    path: '',
    component: StoreShell,
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/home.page').then((m) => m.HomePage),
      },
      {
        path: 'c/:slug',
        loadComponent: () => import('./pages/home.page').then((m) => m.HomePage),
      },
      {
        path: 'p/:slug',
        loadComponent: () => import('./pages/product.page').then((m) => m.ProductPage),
      },
      {
        path: 'cart',
        loadComponent: () => import('./pages/cart.page').then((m) => m.CartPage),
        canActivate: [authGuard],
      },
      {
        path: 'checkout',
        loadComponent: () => import('./pages/checkout.page').then((m) => m.CheckoutPage),
        canActivate: [authGuard],
      },
      {
        path: 'orders',
        loadComponent: () => import('./pages/orders.page').then((m) => m.OrdersPage),
        canActivate: [authGuard],
      },
      {
        path: 'orders/:id',
        loadComponent: () => import('./pages/order-detail.page').then((m) => m.OrderDetailPage),
        canActivate: [authGuard],
      },
      {
        path: 'wishlist',
        loadComponent: () => import('./pages/wishlist.page').then((m) => m.WishlistPage),
        canActivate: [authGuard],
      },
      {
        path: 'addresses',
        loadComponent: () => import('./pages/addresses.page').then((m) => m.AddressesPage),
        canActivate: [authGuard],
      },
      {
        path: 'notifications',
        loadComponent: () => import('./pages/notifications.page').then((m) => m.NotificationsPage),
        canActivate: [authGuard],
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/user-profile.page').then((m) => m.UserProfilePage),
        canActivate: [authGuard],
      },
      {
        path: 'account',
        loadComponent: () => import('./pages/user-profile.page').then((m) => m.UserProfilePage),
        canActivate: [authGuard],
      },
      { path: 'legal', redirectTo: 'legal/terms', pathMatch: 'full' },
      {
        path: 'legal/:tab',
        loadComponent: () => import('./pages/legal.page').then((m) => m.LegalPage),
      },
      { path: 'terms', redirectTo: 'legal/terms' },
      { path: 'privacy', redirectTo: 'legal/privacy' },
      { path: 'refund-policy', redirectTo: 'legal/refunds' },
      { path: 'refunds', redirectTo: 'legal/refunds' },
      { path: 'contact', redirectTo: 'legal/contact' },
    ],
  },
  {
    path: 'admin',
    loadComponent: () => import('./layout/admin-shell.component').then((m) => m.AdminShell),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/admin-dashboard.page').then((m) => m.AdminDashboardPage),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/admin-products.page').then((m) => m.AdminProductsPage),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./pages/admin-inventory.page').then((m) => m.AdminInventoryPage),
      },
      {
        path: 'gst-billing',
        loadComponent: () =>
          import('./pages/admin-gst-billing.page').then((m) => m.AdminGstBillingPage),
      },
      {
        path: 'settlement',
        loadComponent: () =>
          import('./pages/admin-settlement.page').then((m) => m.AdminSettlementPage),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./pages/admin-categories.page').then((m) => m.AdminCategoriesPage),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./pages/admin-orders.page').then((m) => m.AdminOrdersPage),
      },
      {
        path: 'coupons',
        loadComponent: () =>
          import('./pages/admin-coupons.page').then((m) => m.AdminCouponsPage),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/admin-users.page').then((m) => m.AdminUsersPage),
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('./pages/admin-reports.page').then((m) => m.AdminReportsPage),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./pages/admin-settings.page').then((m) => m.AdminSettingsPage),
      },
      {
        path: 'theme',
        loadComponent: () =>
          import('./pages/theme-settings.component').then((m) => m.ThemeSettingsComponent),
      },
      {
        path: 'theme-settings',
        redirectTo: 'theme',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'delivery',
    loadComponent: () =>
      import('./layout/delivery-shell.component').then((m) => m.DeliveryShell),
    canActivate: [authGuard, roleGuard],
    data: { roles: ['delivery'] },
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/delivery.page').then((m) => m.DeliveryPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
