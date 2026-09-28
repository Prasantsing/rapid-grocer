import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/guards';
import { StoreShell } from './layout/store-shell.component';
import { AdminShell } from './layout/admin-shell.component';
import { DeliveryShell } from './layout/delivery-shell.component';
import { HomePage } from './pages/home.page';
import { ProductPage } from './pages/product.page';
import { CartPage } from './pages/cart.page';
import { CheckoutPage } from './pages/checkout.page';
import { OrdersPage } from './pages/orders.page';
import { OrderDetailPage } from './pages/order-detail.page';
import { WishlistPage } from './pages/wishlist.page';
import { AddressesPage } from './pages/addresses.page';
import { AuthPage } from './pages/auth.page';
import { NotificationsPage } from './pages/notifications.page';
import { AccountPage } from './pages/account.page';
import { AdminDashboardPage } from './pages/admin-dashboard.page';
import { AdminProductsPage } from './pages/admin-products.page';
import { AdminCategoriesPage } from './pages/admin-categories.page';
import { AdminOrdersPage } from './pages/admin-orders.page';
import { AdminCouponsPage } from './pages/admin-coupons.page';
import { AdminUsersPage } from './pages/admin-users.page';
import { AdminReportsPage } from './pages/admin-reports.page';
import { DeliveryPage } from './pages/delivery.page';

export const routes: Routes = [
  { path: 'login', component: AuthPage, canActivate: [guestGuard], data: { mode: 'login' } },
  { path: 'register', component: AuthPage, canActivate: [guestGuard], data: { mode: 'register' } },
  {
    path: '',
    component: StoreShell,
    children: [
      { path: '', component: HomePage },
      { path: 'c/:slug', component: HomePage },
      { path: 'p/:slug', component: ProductPage },
      { path: 'cart', component: CartPage, canActivate: [authGuard] },
      { path: 'checkout', component: CheckoutPage, canActivate: [authGuard] },
      { path: 'orders', component: OrdersPage, canActivate: [authGuard] },
      { path: 'orders/:id', component: OrderDetailPage, canActivate: [authGuard] },
      { path: 'wishlist', component: WishlistPage, canActivate: [authGuard] },
      { path: 'addresses', component: AddressesPage, canActivate: [authGuard] },
      { path: 'notifications', component: NotificationsPage, canActivate: [authGuard] },
      { path: 'account', component: AccountPage },
    ],
  },
  {
    path: 'admin',
    component: AdminShell,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin'] },
    children: [
      { path: '', component: AdminDashboardPage },
      { path: 'products', component: AdminProductsPage },
      { path: 'categories', component: AdminCategoriesPage },
      { path: 'orders', component: AdminOrdersPage },
      { path: 'coupons', component: AdminCouponsPage },
      { path: 'users', component: AdminUsersPage },
      { path: 'reports', component: AdminReportsPage },
    ],
  },
  {
    path: 'delivery',
    component: DeliveryShell,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['delivery'] },
    children: [
      { path: '', component: DeliveryPage },
    ],
  },
  { path: '**', redirectTo: '' },
];
