import { Routes } from '@angular/router';
import { BookDetailComponent } from './components/book-detail/book-detail';
import { HomeComponent } from './components/home/home';
import { CartComponent } from './components/cart/cart';
import { DashboardComponent } from './components/admin/dashboard/dashboard';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password';
import { ProductsComponent } from './components/products/products';
import { WishlistComponent } from './components/wishlist/wishlist';
import { AboutComponent } from './components/about/about';
import { NewsComponent } from './components/news/news';
import { ContactComponent } from './components/contact/contact';
import { adminGuard } from './guards/admin.guard';
import { guestGuard } from './guards/guest.guard';
import { authGuard } from './guards/auth.guard';
import { CheckoutComponent } from './components/checkout/checkout';
import { OrderUserComponent } from './components/orderuser/orderuser';
import { ChangePasswordComponent } from './components/change-password/change-password';
import { ProfileComponent } from './components/profile/profile';
import { PromotionsComponent } from './components/promotions/promotions';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Bookstore Home' },
  { path: 'profile', component: ProfileComponent, title: 'Thông tin cá nhân - Bookstore', canActivate: [authGuard] },
  { path: 'products', component: ProductsComponent, title: 'Sản phẩm - Bookstore' },
  { path: 'promotions', component: PromotionsComponent, title: 'Khuyến mãi - Bookstore' },
  { path: 'book/:id', component: BookDetailComponent, title: 'Book Detail' },
  { path: 'cart', component: CartComponent, title: 'Giỏ hàng - Bookstore' },
  { path: 'wishlist', component: WishlistComponent, title: 'Bộ sưu tập cá nhân - Bookstore', canActivate: [authGuard] },
  { path: 'checkout', component: CheckoutComponent, title: 'Thanh toán - Bookstore', canActivate: [authGuard] },
  { path: 'orderuser', component: OrderUserComponent, title: 'Đơn hàng của tôi - Bookstore', canActivate: [authGuard] },
  { path: 'about', component: AboutComponent, title: 'Giới thiệu - Bookstore' },
  { path: 'news', component: NewsComponent, title: 'Tin tức - Bookstore' },
  { path: 'contact', component: ContactComponent, title: 'Liên hệ - Bookstore' },
  { path: 'dashboard', component: DashboardComponent, title: 'dashboard', canActivate: [authGuard] },
  { path: 'change-password', component: ChangePasswordComponent, title: 'Đổi mật khẩu - Bookstore', canActivate: [authGuard] },
  { path: 'login', component: LoginComponent, title: 'Đăng nhập - Bookstore', canActivate: [guestGuard] },
  { path: 'Signin', component: LoginComponent, title: 'Đăng nhập - Bookstore', canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, title: 'Đăng ký - Bookstore', canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, title: 'Quên mật khẩu - Bookstore', canActivate: [guestGuard] },
  { path: '**', redirectTo: '' }
];

