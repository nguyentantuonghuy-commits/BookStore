import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, defer, forkJoin, map, of, tap, throwError } from 'rxjs';
import { CartService } from './cart.service';
import { AuthService } from './auth.service';
import { CustomerService } from './customer.service';
import { EmployeeService } from './employee.service';
import { BookService } from './book.service';
import { EmailService } from './email.service';

@Injectable({
  providedIn: 'root'
})
export class CheckoutService {
  private readonly apiUrl = 'http://localhost:3000/orders';
  private readonly checkoutApiUrl = 'http://localhost:3000/api/orders/checkout';
  private readonly orderUpdateApiUrl = 'http://localhost:3000/api/orders';

  orders = signal<any[]>([]);
  ordersLoaded = signal(false);
  selectedOrderNotificationId = signal<string | number | null>(null);

  private emailService = inject(EmailService);

  currentUser = computed(() => this.authService.currentUser());

  userOrders = computed(() => {
    const user = this.currentUser();
    return user ? this.orders().filter(order => this.orderBelongsToUser(order, user)) : [];
  });

  constructor(
    private cartService: CartService,
    private authService: AuthService,
    private customerService: CustomerService,
    private employeeService: EmployeeService,
    private http: HttpClient,
    private bookService: BookService
  ) {
    this.loadOrders().subscribe({
      error: error => console.error('Không thể tải danh sách đơn hàng:', error)
    });
  }

  private getLocalISOString(): string {
    const now = new Date();
    const pad = (value: number) => value.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  private normalizeEmail(value: unknown): string {
    return String(value || '').trim().toLowerCase();
  }

  private sameValue(first: unknown, second: unknown): boolean {
    if (first === undefined || first === null || second === undefined || second === null) {
      return false;
    }
    return String(first) === String(second);
  }

  private orderBelongsToUser(order: any, user: any): boolean {
    const userEmail = this.normalizeEmail(user?.email);
    const orderAccountEmail = this.normalizeEmail(order?.accountEmail);
    const shippingEmail = this.normalizeEmail(order?.email);

    if (
      this.sameValue(order?.userId, user?.id) ||
      this.sameValue(order?.customerId, user?.id) ||
      this.sameValue(order?.userId, user?.email)
    ) {
      return true;
    }

    if (userEmail && orderAccountEmail === userEmail) {
      return true;
    }

    // Dữ liệu đơn hàng cũ chưa có accountEmail được nhận diện bằng email giao hàng.
    return !orderAccountEmail && !!userEmail && shippingEmail === userEmail;
  }

  private parseError(error: unknown, fallback: string): Error {
    if (error instanceof HttpErrorResponse) {
      const serverMessage = error.error?.message || error.error?.error;
      return new Error(serverMessage || error.message || fallback);
    }
    if (error instanceof Error) {
      return error;
    }
    return new Error(fallback);
  }

  loadOrders(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}?_t=${Date.now()}`).pipe(
      tap(data => {
        this.orders.set(Array.isArray(data) ? data : []);
        this.ordersLoaded.set(true);
      }),
      catchError(error => {
        this.ordersLoaded.set(true);
        return throwError(() => this.parseError(error, 'Không thể tải đơn hàng từ máy chủ.'));
      })
    );
  }

  getOrders() {
    return this.orders.asReadonly();
  }

  getUserOrders(): any[] {
    const user = this.authService.currentUser();
    return user ? this.orders().filter(order => this.orderBelongsToUser(order, user)) : [];
  }

  addOrder(order: any): void {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    const payload = {
      ...order,
      accountId: currentUser.id,
      accountEmail: currentUser.email,
      currentUser,
      createdAt: this.getLocalISOString()
    };

    this.http.post<any>(this.checkoutApiUrl, payload).pipe(
      map(response => response?.order || response)
    ).subscribe({
      next: savedOrder => {
        this.orders.update(items => [...items.filter(item => !this.sameValue(item.id, savedOrder.id)), savedOrder]);
        this.emailService.triggerOrderConfirmation(savedOrder, savedOrder);
      },
      error: error => console.error('Không thể thêm đơn hàng:', error)
    });
  }

  updateOrderStatus(orderId: string | number, status: string): Observable<any> {
    const previousOrder = this.orders().find(order => this.sameValue(order.id, orderId));

    return this.http.patch<any>(`${this.orderUpdateApiUrl}/${orderId}`, { status }).pipe(
      map(response => response?.order || response),
      tap(updatedOrder => {
        this.orders.update(items =>
          items.map(item => this.sameValue(item.id, orderId) ? updatedOrder : item)
        );
        this.bookService.loadBooks();
        if (previousOrder && previousOrder.status !== status) {
          this.emailService.triggerOrderStatusUpdate(updatedOrder, updatedOrder, status);
        }
      }),
      catchError(error => throwError(() => this.parseError(error, 'Không thể cập nhật trạng thái đơn hàng.')))
    );
  }

  updateOrdersIsNew(): void {
    const currentUser = this.currentUser();
    if (!currentUser) return;

    const unreadOrders = this.orders().filter(order =>
      this.orderBelongsToUser(order, currentUser) && order.isNew === true
    );

    if (unreadOrders.length === 0) return;

    const requests = unreadOrders.map(order =>
      this.updateOrder(order.id, { isNew: false })
    );

    forkJoin(requests).subscribe({
      error: error => console.error('Lỗi cập nhật thông báo đơn hàng:', error)
    });
  }

  updateOrder(orderId: string | number, updated: Partial<any>): Observable<any> {
    return this.http.patch<any>(`${this.orderUpdateApiUrl}/${orderId}`, updated).pipe(
      map(response => response?.order || response),
      tap(updatedOrder => {
        this.orders.update(items =>
          items.map(item => this.sameValue(item.id, orderId) ? updatedOrder : item)
        );
      }),
      catchError(error => throwError(() => this.parseError(error, 'Không thể cập nhật đơn hàng.')))
    );
  }

  removeOrder(orderId: string | number): Observable<void> {
    const safeOrderId = encodeURIComponent(String(orderId));

    // Dùng API xóa an toàn của server. Không gọi DELETE /orders/:id trực tiếp
    // vì json-server 0.17 có thể cascade và xóa nhầm nhiều đơn khách hàng khác.
    return this.http.delete<any>(`${this.orderUpdateApiUrl}/${safeOrderId}`).pipe(
      tap(response => {
        if (response?.success !== true) {
          throw new Error(response?.message || 'Máy chủ không xác nhận xóa đơn hàng.');
        }

        this.orders.update(items =>
          items.filter(order => !this.sameValue(order.id, orderId))
        );
      }),
      map(() => void 0),
      catchError(error => throwError(() => this.parseError(error, 'Không thể xóa đơn hàng.')))
    );
  }

  findCurrentUserInfo(userIdOrEmail: string): any {
    const normalized = this.normalizeEmail(userIdOrEmail);
    const employees = this.employeeService.getEmployees();
    const customers = this.customerService.getCustomers();

    return (
      employees.find((employee: any) =>
        this.sameValue(employee.id, userIdOrEmail) || this.normalizeEmail(employee.email) === normalized
      ) ||
      customers.find((customer: any) =>
        this.sameValue(customer.id, userIdOrEmail) || this.normalizeEmail(customer.email) === normalized
      )
    );
  }

  getActiveUserCarts(): any[] {
    return this.cartService.getUserCart().filter(item => item.active === true);
  }

  calculateSubtotal(activeCarts: any[]): number {
    return activeCarts.reduce((total, item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(
        item.unitPrice ?? (quantity > 0 ? Number(item.price || 0) / quantity : 0)
      );
      return total + unitPrice * quantity;
    }, 0);
  }

  checkout(data: any): Observable<any> {
    return defer(() => {
      const currentUser = this.currentUser();
      if (!currentUser) {
        return throwError(() => new Error('Vui lòng đăng nhập để thanh toán!'));
      }

      const activeCarts = this.getActiveUserCarts();
      if (activeCarts.length === 0) {
        return throwError(() => new Error('Chưa có sản phẩm nào được chọn để thanh toán!'));
      }

      const checkedCartIds = new Set(activeCarts.map(item => String(item.id)));
      const payload = {
        ...data,
        accountId: currentUser.id || currentUser.email,
        accountEmail: currentUser.email,
        currentUser: {
          id: currentUser.id || currentUser.email,
          email: currentUser.email,
          role: currentUser.role
        },
        items: activeCarts.map(item => ({ ...item })),
        createdAt: this.getLocalISOString()
      };

      return this.http.post<any>(this.checkoutApiUrl, payload).pipe(
        map(response => response?.order || response),
        tap(savedOrder => {
          if (!savedOrder?.id) {
            throw new Error('Máy chủ không trả về mã đơn hàng đã lưu.');
          }

          this.orders.update(items => [
            ...items.filter(item => !this.sameValue(item.id, savedOrder.id)),
            savedOrder
          ]);

          // Chỉ xóa giỏ sau khi máy chủ đã ghi đơn thành công.
          this.cartService.carts.update(cartItems =>
            cartItems.filter(item => !checkedCartIds.has(String(item.id)))
          );
          this.cartService.saveCart();

          // Tải lại tồn kho đã được máy chủ cập nhật.
          this.bookService.loadBooks();
          this.emailService.triggerOrderConfirmation(savedOrder, savedOrder);
        }),
        catchError(error => throwError(() => this.parseError(error, 'Đã xảy ra lỗi trong quá trình thanh toán.')))
      );
    });
  }

  hasUserPurchasedBook(userId: string, bookId: string): boolean {
    if (!userId || !bookId) return false;

    const currentUser = this.currentUser();
    return this.orders().some(order => {
      const belongsToUser = currentUser
        ? this.orderBelongsToUser(order, currentUser)
        : this.sameValue(order.userId, userId) || this.sameValue(order.customerId, userId);

      return belongsToUser &&
        order.status !== 'Hủy đơn hàng' &&
        order.items?.some((item: any) => String(item.productId) === String(bookId));
    });
  }
}
