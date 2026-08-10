import { Component, inject, signal, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';

declare var google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent implements OnInit {
  authService = inject(AuthService);
  cartService = inject(CartService);
  router = inject(Router);
  platformId = inject(PLATFORM_ID);

  email = '';
  password = '';
  showPassword = signal(false);
  errorMessage = signal('');
  isGoogleLoaded = signal(false);
  googleTokenClient: any;

  togglePasswordVisibility() {
    this.showPassword.update(val => !val);
  }

  async onSubmit() {
    this.errorMessage.set('');
    if (!this.email.trim() || !this.password.trim()) {
      this.errorMessage.set('Vui lòng nhập đầy đủ thông tin đăng nhập.');
      return;
    }

    const res = await this.authService.login({ email: this.email, password: this.password });
    if (res.success) {
      this.cartService.showToast(res.message);
      if (this.authService.isStaff()) {
        this.router.navigate(['/dashboard']);
      } else {
        this.router.navigate(['/']);
      }
    } else {
      this.errorMessage.set(res.message);
    }
  }
  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Delay slightly to ensure client script is loaded
      setTimeout(() => {
        this.initializeGoogleSignIn();
      }, 500);
    }
  }

  initializeGoogleSignIn() {
    try {
      if (typeof google !== 'undefined') {
        this.googleTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: '345688130634-0rqhu15bucde2vg8brhv7hqb3mgotgfv.apps.googleusercontent.com',
          scope: 'openid email profile',
          callback: this.handleTokenResponse.bind(this)
        });
        this.isGoogleLoaded.set(true);
      }
    } catch (e) {
      console.warn('Google client library failed to load:', e);
    }
  }

  handleTokenResponse(response: any) {
    if (response && response.access_token) {
      this.errorMessage.set('');
      this.isGoogleLoaded.set(true);
      
      // Fetch user profile from google userinfo API using access token
      fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${response.access_token}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch userinfo');
          return res.json();
        })
        .then(async payload => {
          const profile = {
            name: payload.name || 'Người dùng Google',
            email: payload.email
          };

          const res = await this.authService.registerOrGetGoogleUser(profile);
          if (res.success) {
            this.cartService.showToast(res.message);
            this.router.navigate(['/']);
          } else {
            this.errorMessage.set(res.message);
          }
        })
        .catch(error => {
          console.error('Error fetching google user info:', error);
          this.errorMessage.set('Không thể đồng bộ thông tin tài khoản Google.');
        });
    } else {
      this.errorMessage.set('Đăng nhập Google thất bại hoặc bị hủy.');
    }
  }

  loginWithGoogle() {
    this.errorMessage.set('');
    if (this.isGoogleLoaded() && this.googleTokenClient) {
      try {
        this.googleTokenClient.requestAccessToken();
      } catch (err) {
        console.warn('Programmatic Google login failed, running mock fallback:', err);
        this.runMockGoogleLogin();
      }
    } else {
      this.runMockGoogleLogin();
    }
  }

  async runMockGoogleLogin() {
    const res = await this.authService.loginGoogle();
    if (res.success) {
      this.cartService.showToast(res.message);
      this.router.navigate(['/']);
    } else {
      this.errorMessage.set(res.message);
    }
  }
}
