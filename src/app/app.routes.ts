import { Routes } from '@angular/router';
import { BookDetailComponent } from './components/book-detail/book-detail';
import { HomeComponent } from './components/home/home';
import { CartComponent } from './components/cart/cart';
import { DashboardComponent } from './components/dashboard/dashboard';
import { LoginComponent } from './components/login/login';
import { RegisterComponent } from './components/register/register';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Bookstore Home' },
  { path: 'book/:id', component: BookDetailComponent, title: 'Book Detail' },
  { path: 'cart', component: CartComponent, title: 'Giỏ hàng - Bookstore' },
  { path: 'dashboard', component: DashboardComponent, title: 'Admin Dashboard - Bookstore', canActivate: [adminGuard] },
  { path: 'login', component: LoginComponent, title: 'Đăng nhập - Bookstore' },
  { path: 'register', component: RegisterComponent, title: 'Đăng ký - Bookstore' },
  { path: '**', redirectTo: '' }
];
