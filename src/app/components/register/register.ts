import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css'
})
export class RegisterComponent {
  authService = inject(AuthService);
  cartService = inject(CartService);
  router = inject(Router);

  name = '';
  email = '';
  phone = '';
  password = '';
  confirmPassword = '';
  showPassword = signal(false);
  errorMessage = signal('');

  togglePasswordVisibility() {
    this.showPassword.update(val => !val);
  }

  onPhoneInput(event: any) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/[^0-9]/g, '');
    this.phone = input.value;
  }

  async onSubmit() {
    this.errorMessage.set('');
    if (!this.name.trim() || !this.email.trim() || !this.phone.trim() || !this.password.trim() || !this.confirmPassword.trim()) {
      this.errorMessage.set('Vui lòng điền đầy đủ tất cả các trường.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.email)) {
      this.errorMessage.set('Định dạng Email không hợp lệ.');
      return;
    }

    const phoneRegex = /^0[0-9]{9}$/;
    if (!phoneRegex.test(this.phone)) {
      this.errorMessage.set('Số điện thoại phải bắt đầu bằng số 0 và có đúng 10 chữ số.');
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage.set('Mật khẩu phải chứa ít nhất 6 ký tự.');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage.set('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    const res = await this.authService.register({
      name: this.name,
      email: this.email,
      phone: this.phone,
      password: this.password
    });

    if (res.success) {
      this.cartService.showToast(res.message);
      this.router.navigate(['/login']);
    } else {
      this.errorMessage.set(res.message);
    }
  }
}
