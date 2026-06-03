import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  currentUser = signal<any>(null);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        try {
          this.currentUser.set(JSON.parse(savedUser));
        } catch (e) {
          localStorage.removeItem('currentUser');
        }
      }
    }
  }

  register(user: any): { success: boolean; message: string } {
    if (!isPlatformBrowser(this.platformId)) {
      return { success: false, message: 'Đăng ký không khả dụng trên server' };
    }

    const usersJson = localStorage.getItem('users');
    let users = [];
    if (usersJson) {
      try {
        users = JSON.parse(usersJson);
      } catch (e) {
        users = [];
      }
    }

    const emailExists = users.some((u: any) => u.email === user.email);
    if (emailExists) {
      return { success: false, message: 'Email này đã được đăng ký sử dụng!' };
    }

    users.push(user);
    localStorage.setItem('users', JSON.stringify(users));
    return { success: true, message: 'Đăng ký tài khoản thành công!' };
  }

  login(credentials: any): { success: boolean; message: string } {
    if (!isPlatformBrowser(this.platformId)) {
      return { success: false, message: 'Đăng nhập không khả dụng trên server' };
    }

    // Default admin user account
    if ((credentials.email === 'admin' || credentials.email === 'admin@gmail.com') && credentials.password === 'admin123') {
      const adminUser = { name: 'Quản trị viên', email: credentials.email, role: 'admin' };
      this.currentUser.set(adminUser);
      localStorage.setItem('currentUser', JSON.stringify(adminUser));
      return { success: true, message: 'Đăng nhập thành công! Chào mừng Quản trị viên.' };
    }

    const usersJson = localStorage.getItem('users');
    let users = [];
    if (usersJson) {
      try {
        users = JSON.parse(usersJson);
      } catch (e) {
        users = [];
      }
    }

    const foundUser = users.find((u: any) => u.email === credentials.email && u.password === credentials.password);
    if (foundUser) {
      const loggedUser = { name: foundUser.name, email: foundUser.email, role: 'user' };
      this.currentUser.set(loggedUser);
      localStorage.setItem('currentUser', JSON.stringify(loggedUser));
      return { success: true, message: `Đăng nhập thành công! Chào mừng ${foundUser.name}.` };
    }

    return { success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' };
  }

  logout(): void {
    this.currentUser.set(null);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('currentUser');
    }
  }
}
