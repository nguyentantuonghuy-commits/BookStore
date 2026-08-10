import { Component, inject, computed, signal, HostListener, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, RouterLinkActive } from '@angular/router';
import { BookService } from '../../services/book.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { CheckoutService } from '../../services/checkout.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent {
  searching = '';
  public authService = inject(AuthService);
  public bookService = inject(BookService);
  public checkoutService = inject(CheckoutService);

  showNotifications = signal(false);

  newOrders = computed(() =>
    this.checkoutService
      .getUserOrders()
      .filter((o) => o.isNew === true)
  );

  orderNewCount = computed(() => this.newOrders().length);

  constructor(
    public cartService: CartService,
    private router: Router
  ) {
    effect(() => {
      this.searching = this.bookService.searchQuery();
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    this.showNotifications.set(false);
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    if (this.isLoggedIn()) {
      this.showNotifications.update((v) => !v);
    }
  }

  markAllAsRead(): void {
    this.checkoutService.updateOrdersIsNew();
    this.showNotifications.set(false);
  }

  clickNotification(order: any): void {
    this.showNotifications.set(false);
    this.checkoutService.selectedOrderNotificationId.set(order.id);

    this.checkoutService.updateOrder(order.id, { isNew: false }).subscribe({
      next: () => this.router.navigate(['/orderuser']),
      error: (error) => {
        console.error('Không thể đánh dấu thông báo đã đọc:', error);
        this.router.navigate(['/orderuser']);
      }
    });
  }

  viewAllOrders(): void {
    this.checkoutService.updateOrdersIsNew();
    this.showNotifications.set(false);
    this.router.navigate(['/orderuser']);
  }

  isLoggedIn(): boolean {
    return !!this.authService.currentUser();
  }

  clearSearch(): void {
    this.searching = '';
    this.bookService.searchQuery.set('');
    this.bookService.selectedCategory.set('TẤT CẢ EBOOK');
  }

  onSearch(): void {
    this.bookService.onSearch(this.searching);
    if (this.router.url !== '/' && this.router.url !== '/#') {
      this.router.navigate(['/']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.clearSearch();
    this.cartService.showToast('Đăng xuất tài khoản thành công.');
    this.router.navigate(['/']);
  }
}
