import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './change-password.html',
  styleUrl: './change-password.css'
})
export class ChangePasswordComponent implements OnInit {
  authService = inject(AuthService);
  cartService = inject(CartService);
  router = inject(Router);

  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  errorMessage = signal('');
  successMessage = signal('');
  showPasswords = signal(false);
  isSubmitting = signal(false);
  isGoogleOnlyAccount = signal(false);

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (!user) {
      void this.router.navigate(['/login']);
      return;
    }

    // Tài khoản được tạo trực tiếp bằng Google không có mật khẩu do Sachweb quản lý.
    // Người dùng phải đổi mật khẩu tại Google, không được đổi tại website.
    if (user.role === 'customer' && user.isGoogleAccount === true) {
      this.isGoogleOnlyAccount.set(true);
      this.errorMessage.set(
        'Tài khoản này đăng nhập bằng Google. Sachweb không lưu mật khẩu Google, ' +
        'vui lòng đổi mật khẩu tại trang quản lý Tài khoản Google.'
      );
    }
  }

  togglePasswordsVisibility(): void {
    this.showPasswords.update(value => !value);
  }

  async submitChangePassword(): Promise<void> {
    if (this.isSubmitting()) return;

    this.errorMessage.set('');
    this.successMessage.set('');

    const currentUser = this.authService.currentUser();
    if (currentUser?.role === 'customer' && currentUser.isGoogleAccount === true) {
      this.isGoogleOnlyAccount.set(true);
      this.errorMessage.set(
        'Tài khoản này đăng nhập bằng Google. Vui lòng đổi mật khẩu tại trang quản lý Tài khoản Google.'
      );
      return;
    }

    const oldPass = this.oldPassword.trim();
    const newPass = this.newPassword.trim();
    const confirmPass = this.confirmPassword.trim();

    if (!oldPass || !newPass || !confirmPass) {
      this.errorMessage.set('Vui lòng nhập đầy đủ các trường thông tin.');
      return;
    }
    if (newPass !== confirmPass) {
      this.errorMessage.set('Mật khẩu mới và xác nhận mật khẩu không khớp.');
      return;
    }
    if (newPass.length < 6) {
      this.errorMessage.set('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPass === oldPass) {
      this.errorMessage.set('Mật khẩu mới phải khác mật khẩu cũ.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      const result = await this.authService.changePassword(oldPass, newPass);
      if (!result.success) {
        this.errorMessage.set(result.message);
        return;
      }

      this.successMessage.set(result.message + ' Đang chuyển hướng...');
      this.cartService.showToast(result.message);
      this.oldPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';

      setTimeout(() => {
        void this.router.navigate([this.authService.isStaff() ? '/dashboard' : '/']);
      }, 1600);
    } catch (error) {
      console.error('Lỗi đổi mật khẩu:', error);
      this.errorMessage.set('Mật khẩu chưa được lưu. Vui lòng kiểm tra server cổng 3000 và thử lại.');
    } finally {
      this.isSubmitting.set(false);
    }
  }
}
