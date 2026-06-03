import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  authService = inject(AuthService);
  cartService = inject(CartService);
  router = inject(Router);

  email = '';
  password = '';
  showPassword = signal(false);
  errorMessage = signal('');

  togglePasswordVisibility() {
    this.showPassword.update(val => !val);
  }

  onSubmit() {
    this.errorMessage.set('');
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage.set('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }

    const res = this.authService.login({ email: this.email, password: this.password });
    if (res.success) {
      this.cartService.showToast(res.message);
      if (this.authService.currentUser()?.role === 'admin') {
        this.router.navigate(['/dashboard']);
      } else {
        this.router.navigate(['/']);
      }
    } else {
      this.errorMessage.set(res.message);
    }
  }
}
