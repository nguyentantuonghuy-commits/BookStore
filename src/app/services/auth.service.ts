import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { StorageService } from './storage.service';
import { EmployeeService } from './employee.service';

interface CustomerApiResponse {
  success: boolean;
  customer: any;
  message?: string;
}

interface ActionResult {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private platformId = inject(PLATFORM_ID);
  private storageService = inject(StorageService);
  private employeeService = inject(EmployeeService);
  private router = inject(Router);
  private http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:3000';

  currentUser = signal<any>(null);

  constructor() {
    const savedUser = this.storageService.get<any>('currentUser');
    if (savedUser) {
      this.currentUser.set(savedUser);

      if (savedUser.role === 'customer') {
        void this.refreshCurrentCustomerSession();
      }
    }
  }

  private normalizeEmail(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || error.message || fallback;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  }

  private buildCustomerSession(customer: any, loginProvider: 'password' | 'google' = 'password'): any {
    return {
      id: customer.id,
      name: customer.fullname || customer.username,
      email: customer.email,
      role: 'customer',
      permissions: [],
      isGoogleAccount: !!customer.isGoogleAccount,
      loginProvider,
      avatar: customer.avatar || ''
    };
  }

  private setCurrentUser(user: any): void {
    this.storageService.set('currentUser', user);
    this.currentUser.set(user);
  }

  private async fetchCustomers(): Promise<any[]> {
    return firstValueFrom(
      this.http.get<any[]>(`${this.apiUrl}/customers?_t=${Date.now()}`)
    );
  }

  private async refreshCurrentCustomerSession(): Promise<void> {
    const user = this.currentUser();
    if (!user || user.role !== 'customer' || !isPlatformBrowser(this.platformId)) return;

    try {
      let params = new HttpParams().set('_t', Date.now().toString());
      if (user.id) params = params.set('id', String(user.id));
      if (user.email) params = params.set('email', String(user.email));

      const response = await firstValueFrom(
        this.http.get<CustomerApiResponse>(`${this.apiUrl}/api/customers/account`, { params })
      );

      const refreshed = {
        ...user,
        id: response.customer.id,
        name: response.customer.fullname || response.customer.username,
        email: response.customer.email,
        isGoogleAccount: !!response.customer.isGoogleAccount,
        avatar: response.customer.avatar || ''
      };
      this.setCurrentUser(refreshed);
    } catch (error) {
      console.warn('Không thể làm mới phiên khách hàng từ server:', error);
    }
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }

  getCurrentUser(): any {
    return this.currentUser();
  }

  async register(user: any): Promise<ActionResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return { success: false, message: 'Đăng ký không khả dụng trên server.' };
    }

    try {
      const email = this.normalizeEmail(user.email);
      const username = String(user.username || email.split('@')[0] || '').trim().toLowerCase();

      const response = await firstValueFrom(
        this.http.post<CustomerApiResponse>(`${this.apiUrl}/api/customers/register`, {
          username,
          password: String(user.password || ''),
          fullname: user.name || user.fullname || 'Khách hàng',
          email,
          phone: user.phone || ''
        })
      );

      return {
        success: true,
        message: response.message || 'Đăng ký tài khoản thành công!'
      };
    } catch (error) {
      return {
        success: false,
        message: this.errorMessage(error, 'Không thể đăng ký tài khoản. Vui lòng thử lại.')
      };
    }
  }

  Signin(username: string, password: string): boolean {
    const users = this.employeeService.users();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    const user = users.find((item: any) =>
      item.username?.toLowerCase() === normalizedUsername && item.password === password
    );

    if (!user) return false;

    if (user.islocked) {
      alert('Tài khoản của bạn đã bị khóa.');
      return false;
    }

    const employee = this.employeeService.getEmployees().find((item: any) =>
      item.email?.toLowerCase() ===
        (user.username === 'admin' ? 'admin@gmail.com' : `${user.username}@gmail.com`).toLowerCase() ||
      item.fullname?.toLowerCase() === user.username?.toLowerCase()
    );

    const loggedUser = {
      id: user.id,
      name: user.username === 'admin' ? 'Quản trị viên' : user.username,
      email: user.username === 'admin' ? 'admin@gmail.com' : `${user.username}@gmail.com`,
      role: user.role,
      permissions: user.permissions,
      avatar: employee ? employee.image : ''
    };

    this.setCurrentUser(loggedUser);
    return true;
  }

  async login(credentials: any): Promise<ActionResult> {
    if (!isPlatformBrowser(this.platformId)) {
      return { success: false, message: 'Đăng nhập không khả dụng trên server.' };
    }

    await this.storageService.sync();

    const loginValue = this.normalizeEmail(credentials.email);
    const password = String(credentials.password || '');

    if (this.Signin(loginValue, password)) {
      const loggedUser = this.getCurrentUser();
      return {
        success: true,
        message: loggedUser.role === 'admin'
          ? 'Đăng nhập thành công! Chào mừng Quản trị viên.'
          : `Đăng nhập thành công! Chào mừng Nhân viên ${loggedUser.name}.`
      };
    }

    try {
      const customers = await this.fetchCustomers();
      const customer = customers.find((item: any) => {
        const email = this.normalizeEmail(item.email);
        const username = String(item.username || '').trim().toLowerCase();
        return email === loginValue || username === loginValue;
      });

      if (!customer) {
        return { success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' };
      }
      if (customer.islocked) {
        return { success: false, message: 'Tài khoản của bạn đã bị khóa.' };
      }
      if (customer.isGoogleAccount && !String(customer.password || '')) {
        return {
          success: false,
          message: 'Tài khoản này được đăng nhập bằng Google. Vui lòng chọn Đăng nhập bằng Google; mật khẩu phải được quản lý tại Google.'
        };
      }
      if (String(customer.password || '') !== password) {
        return { success: false, message: 'Tài khoản hoặc mật khẩu không chính xác.' };
      }

      const loggedUser = this.buildCustomerSession(customer, 'password');
      this.setCurrentUser(loggedUser);
      return { success: true, message: `Đăng nhập thành công! Chào mừng ${loggedUser.name}.` };
    } catch (error) {
      return {
        success: false,
        message: this.errorMessage(error, 'Không thể kết nối máy chủ tài khoản. Vui lòng kiểm tra cổng 3000.')
      };
    }
  }

  async registerOrGetGoogleUser(
    profile: { name: string; email: string }
  ): Promise<{ success: boolean; user: any; message: string }> {
    if (!isPlatformBrowser(this.platformId)) {
      return { success: false, user: null, message: 'Thao tác không khả dụng trên server.' };
    }

    try {
      const response = await firstValueFrom(
        this.http.post<CustomerApiResponse>(`${this.apiUrl}/api/customers/google-login`, {
          name: profile.name,
          email: this.normalizeEmail(profile.email)
        })
      );

      const loggedUser = this.buildCustomerSession(response.customer, 'google');
      this.setCurrentUser(loggedUser);

      return {
        success: true,
        user: loggedUser,
        message: 'Đăng nhập bằng Google thành công!'
      };
    } catch (error) {
      return {
        success: false,
        user: null,
        message: this.errorMessage(error, 'Không thể đăng nhập bằng Google.')
      };
    }
  }

  async loginGoogle(): Promise<ActionResult> {
    const result = await this.registerOrGetGoogleUser({
      name: 'Người dùng Google',
      email: 'user.google@gmail.com'
    });
    return { success: result.success, message: result.message };
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<ActionResult> {
    const user = this.getCurrentUser();
    if (!user) {
      return { success: false, message: 'Bạn chưa đăng nhập.' };
    }

    if (user.role === 'customer') {
      if (user.isGoogleAccount === true) {
        return {
          success: false,
          message: 'Tài khoản Google không thể đổi mật khẩu tại Sachweb. Vui lòng đổi mật khẩu tại Google.'
        };
      }

      try {
        const response = await firstValueFrom(
          this.http.post<CustomerApiResponse>(`${this.apiUrl}/api/customers/change-password`, {
            customerId: user.id,
            email: user.email,
            oldPassword,
            newPassword
          })
        );

        const refreshedUser = {
          ...user,
          name: response.customer.fullname || response.customer.username,
          email: response.customer.email,
          isGoogleAccount: !!response.customer.isGoogleAccount,
          loginProvider: 'password',
          avatar: response.customer.avatar || user.avatar || ''
        };
        this.setCurrentUser(refreshedUser);

        return { success: true, message: 'Đổi mật khẩu thành công!' };
      } catch (error) {
        return {
          success: false,
          message: this.errorMessage(error, 'Không thể đổi mật khẩu. Vui lòng thử lại.')
        };
      }
    }

    const adminUsers = this.employeeService.users();
    const foundAdminUser = adminUsers.find((item: any) =>
      String(item.id) === String(user.id) || item.username === user.name
    );

    if (!foundAdminUser) {
      return { success: false, message: 'Không tìm thấy tài khoản nhân sự.' };
    }
    if (foundAdminUser.password !== oldPassword) {
      return { success: false, message: 'Mật khẩu cũ không chính xác.' };
    }

    try {
      const updatedUser = await firstValueFrom(
        this.http.patch<any>(`${this.apiUrl}/users/${foundAdminUser.id}`, { password: newPassword })
      );
      this.employeeService.users.update(items =>
        items.map((item: any) => String(item.id) === String(updatedUser.id) ? updatedUser : item)
      );
      this.storageService.set('users', this.employeeService.users());
      return { success: true, message: 'Đổi mật khẩu tài khoản quản trị/nhân viên thành công!' };
    } catch (error) {
      return {
        success: false,
        message: this.errorMessage(error, 'Không thể đổi mật khẩu nhân sự.')
      };
    }
  }

  logout(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('chat_tab_session_id');
      localStorage.removeItem('chat_guest_session_id');
    }
    this.storageService.remove('currentUser');
    this.storageService.remove('user');
    this.storageService.remove('employee');
    this.storageService.remove('employees');
    [
      'order',
      'role_permissions',
      'system_permissions',
      'settings_general',
      'settings_shipping',
      'settings_payment',
      'settings_security'
    ].forEach(key => this.storageService.remove(key));

    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  hasPermission(permission: string, moduleContext?: string): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    if (user.role === 'admin') return true;

    const userPerms = user.permissions || [];
    if (userPerms.includes(permission)) return true;

    if (permission === 'create') {
      return userPerms.includes('PRODUCTS_CREATE') || userPerms.includes('EMPLOYEES_MANAGE');
    }
    if (permission === 'update' || permission === 'edit') {
      return userPerms.includes('PRODUCTS_EDIT') ||
        userPerms.includes('EMPLOYEES_MANAGE') ||
        userPerms.includes('ORDERS_STATUS');
    }
    if (permission === 'delete') {
      return userPerms.includes('PRODUCTS_DELETE') || userPerms.includes('EMPLOYEES_MANAGE');
    }

    const lowerPerm = permission.toLowerCase();
    if (
      lowerPerm.includes('export') ||
      lowerPerm.includes('excel') ||
      lowerPerm.includes('xuat') ||
      lowerPerm.includes('xuất')
    ) {
      const allPerms = this.storageService.get<any[]>('system_permissions') || [];
      const matchPerms = allPerms.filter(item => {
        const matchesKeyword = item.code?.toLowerCase().includes('excel') ||
          item.code?.toLowerCase().includes('export') ||
          item.name?.toLowerCase().includes('excel') ||
          item.name?.toLowerCase().includes('xuất');

        if (!matchesKeyword) return false;
        if (moduleContext) {
          return item.module?.toLowerCase() === moduleContext.toLowerCase();
        }
        return true;
      });

      if (matchPerms.length > 0) {
        return matchPerms.some(item => userPerms.includes(item.code));
      }
    }

    return false;
  }

  isStaff(): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;
    const administrativeRoles = ['admin', 'user', 'manager', 'sales', 'editor', 'customer_care'];
    return administrativeRoles.includes(user.role);
  }

  updateCurrentUserDetails(details: { name: string; avatar?: string }): void {
    const user = this.currentUser();
    if (!user) return;

    const updatedUser = {
      ...user,
      name: details.name,
      avatar: details.avatar !== undefined ? details.avatar : user.avatar
    };
    this.setCurrentUser(updatedUser);
  }
}
