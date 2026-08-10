import { Component, inject, signal, PLATFORM_ID, OnDestroy } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CartService } from '../../services/cart.service';

interface CustomerApiResponse {
  success: boolean;
  customer: any;
  message?: string;
}

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.css'
})
export class ForgotPasswordComponent implements OnDestroy {
  platformId = inject(PLATFORM_ID);
  cartService = inject(CartService);
  router = inject(Router);
  private http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:3000';

  email = '';
  enteredOtp = '';
  newPassword = '';
  confirmPassword = '';

  step = signal(1);
  errorMessage = signal('');
  successMessage = signal('');
  isLoading = signal(false);

  generatedOtp = '';
  otpExpiration = 0;
  countdown = signal(300);
  countdownInterval: ReturnType<typeof setInterval> | null = null;

  showNewPassword = signal(false);

  targetAccountType: 'customer' | 'employee' | null = null;
  targetAccount: any = null;

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update(value => !value);
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
  }

  private normalizeEmail(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || error.message || fallback;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  }

  startCountdown(): void {
    this.countdown.set(300);
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    this.countdownInterval = setInterval(() => {
      this.countdown.update(seconds => {
        if (seconds <= 1) {
          if (this.countdownInterval) clearInterval(this.countdownInterval);
          this.errorMessage.set('Mã OTP đã hết hạn. Vui lòng gửi lại mã mới!');
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
  }

  get formattedCountdown(): string {
    const minutes = Math.floor(this.countdown() / 60);
    const seconds = this.countdown() % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private async findAccount(email: string): Promise<void> {
    this.targetAccountType = null;
    this.targetAccount = null;

    try {
      const params = new HttpParams()
        .set('email', email)
        .set('_t', Date.now().toString());
      const response = await firstValueFrom(
        this.http.get<CustomerApiResponse>(`${this.apiUrl}/api/customers/account`, { params })
      );
      this.targetAccountType = 'customer';
      this.targetAccount = response.customer;
      return;
    } catch (error) {
      if (!(error instanceof HttpErrorResponse) || error.status !== 404) {
        throw error;
      }
    }

    const [employees, users] = await Promise.all([
      firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/employees?_t=${Date.now()}`)),
      firstValueFrom(this.http.get<any[]>(`${this.apiUrl}/users?_t=${Date.now()}`))
    ]);

    const employee = employees.find(item => this.normalizeEmail(item.email) === email);
    const employeeUser = employee
      ? users.find(item => String(item.id) === String(employee.id))
      : null;

    if (employeeUser) {
      this.targetAccountType = 'employee';
      this.targetAccount = employeeUser;
      return;
    }

    throw new Error('Email này chưa được đăng ký trong hệ thống!');
  }

  async sendOTP(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!isPlatformBrowser(this.platformId) || this.isLoading()) return;

    const normalizedEmail = this.normalizeEmail(this.email);
    if (!normalizedEmail) {
      this.errorMessage.set('Vui lòng nhập địa chỉ email.');
      return;
    }

    this.email = normalizedEmail;
    this.isLoading.set(true);

    try {
      await this.findAccount(normalizedEmail);

      if (this.targetAccount?.islocked) {
        this.errorMessage.set('Tài khoản này hiện đang bị khóa. Vui lòng liên hệ quản trị viên.');
        return;
      }

      // Tài khoản được tạo trực tiếp bằng Google không dùng mật khẩu của Sachweb.
      // Không gửi OTP và không cho đặt mật khẩu cục bộ tại website.
      if (
        this.targetAccountType === 'customer' &&
        this.targetAccount?.isGoogleAccount === true
      ) {
        this.errorMessage.set(
          'Tài khoản này đăng nhập bằng Google nên không thể đặt lại mật khẩu tại Sachweb. ' +
          'Vui lòng đổi mật khẩu tại trang quản lý Tài khoản Google.'
        );
        return;
      }

      this.generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      this.otpExpiration = Date.now() + 5 * 60 * 1000;

      const response = await fetch(`${this.apiUrl}/api/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          otp: this.generatedOtp
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        this.successMessage.set('Mã OTP đã được gửi về email của bạn.');
      } else {
        this.cartService.showToast('Gợi ý (Dev): Mã OTP là ' + this.generatedOtp);
        this.successMessage.set('Chế độ Dev: Mã OTP đã hiển thị trong thông báo.');
        this.errorMessage.set(data.message || 'Máy chủ email chưa gửi được OTP.');
      }

      this.step.set(2);
      this.startCountdown();
    } catch (error) {
      console.error('Không thể tìm tài khoản hoặc gửi OTP:', error);
      this.errorMessage.set(this.getErrorMessage(error, 'Không thể kiểm tra tài khoản trên máy chủ.'));
    } finally {
      this.isLoading.set(false);
    }
  }

  verifyOTP(): void {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!this.enteredOtp.trim()) {
      this.errorMessage.set('Vui lòng nhập mã xác thực OTP.');
      return;
    }
    if (Date.now() > this.otpExpiration || this.countdown() === 0) {
      this.errorMessage.set('Mã OTP đã hết hạn. Vui lòng gửi lại mã mới!');
      return;
    }
    if (this.enteredOtp.trim() !== this.generatedOtp) {
      this.errorMessage.set('Mã OTP không chính xác. Vui lòng thử lại!');
      return;
    }

    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.successMessage.set('Xác thực OTP thành công. Vui lòng nhập mật khẩu mới!');
    this.step.set(3);
  }

  async resetPassword(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (!isPlatformBrowser(this.platformId) || this.isLoading()) return;

    const newPassword = this.newPassword.trim();
    const confirmPassword = this.confirmPassword.trim();

    if (!newPassword || !confirmPassword) {
      this.errorMessage.set('Vui lòng nhập đầy đủ thông tin mật khẩu.');
      return;
    }
    if (newPassword.length < 6) {
      this.errorMessage.set('Mật khẩu mới phải có độ dài tối thiểu 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      this.errorMessage.set('Xác nhận mật khẩu mới không khớp.');
      return;
    }
    if (!this.targetAccount || !this.targetAccountType) {
      this.errorMessage.set('Phiên khôi phục không hợp lệ. Vui lòng gửi lại OTP.');
      this.step.set(1);
      return;
    }

    if (
      this.targetAccountType === 'customer' &&
      this.targetAccount.isGoogleAccount === true
    ) {
      this.errorMessage.set(
        'Tài khoản Google không thể đặt lại mật khẩu tại Sachweb. ' +
        'Vui lòng đổi mật khẩu tại trang quản lý Tài khoản Google.'
      );
      this.step.set(1);
      return;
    }

    this.isLoading.set(true);

    try {
      if (this.targetAccountType === 'customer') {
        await firstValueFrom(
          this.http.post<CustomerApiResponse>(`${this.apiUrl}/api/customers/reset-password`, {
            customerId: this.targetAccount.id,
            email: this.email,
            newPassword
          })
        );
      } else {
        await firstValueFrom(
          this.http.patch(`${this.apiUrl}/users/${this.targetAccount.id}`, { password: newPassword })
        );
      }

      this.successMessage.set('Đổi mật khẩu thành công! Đang chuyển hướng về trang đăng nhập...');
      this.cartService.showToast('Đặt lại mật khẩu thành công!');

      setTimeout(() => {
        void this.router.navigate(['/login']);
      }, 1800);
    } catch (error) {
      console.error('Lỗi đặt lại mật khẩu:', error);
      this.errorMessage.set(this.getErrorMessage(error, 'Mật khẩu chưa được lưu. Vui lòng thử lại.'));
    } finally {
      this.isLoading.set(false);
    }
  }
}
