import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { BookService } from '../../services/book.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class CartComponent {
  cartService = inject(CartService);
  bookService = inject(BookService);
  authService = inject(AuthService);
  router = inject(Router);

  carts = this.cartService.carts; // Dùng trực tiếp signal từ service
  active: boolean = false;
  showEmptySuggestions = signal(false);

  constructor() {
    if (this.carts().length === 0) {
      this.showEmptySuggestions.set(true);
    }
  }

  // Lấy 4 cuốn sách bán chạy đề xuất khi giỏ hàng trống
  recommendedBooks = computed(() => {
    return this.bookService.getBooks().slice(0, 4);
  });

  addRecommendedToCart(book: any) {
    this.cartService.addToCart(book, 1);
  }

  showCartList() {
    this.showEmptySuggestions.set(false);
  }

  increaseQuantity(item: any): void {
    this.cartService.updateQuantity(item, item.quantity + 1);
  }

  decreaseQuantity(item: any): void {
    if (item.quantity > 1) {
      this.cartService.updateQuantity(item, item.quantity - 1);
    }
  }

  removeItem(item: any): void {
    this.cartService.removeCart(item);
    if (this.carts().length === 0) {
      this.showEmptySuggestions.set(true);
    }
  }

  toggleBuy(item: any) {
    this.cartService.toggleActive(item);
  }

  toggleBuyAll(active: boolean) {
    this.cartService.toggleActiveAll(active);
  }

  onSelectAllChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.toggleBuyAll(checked);
  }

  // Tất cả đã được chọn hay chưa
  allSelected = computed(
    () => this.carts().length > 0 && this.carts().every((item) => item.active)
  );

  // Tạo computed cho tổng tiền
  totalPrice = computed(() =>
    this.carts()
      .filter((item) => item.active)
      .reduce((sum, item) => sum + item.price, 0)
  );

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  // Tiền Ship cố định
  shippingCost = 13000;

  checkout(): void {
    if (!this.authService.currentUser()) {
      this.cartService.showToast('Bạn cần đăng nhập để thực hiện thanh toán!');
      this.router.navigate(['/login']);
      return;
    }

    this.cartService.showToast('Đặt hàng và thanh toán thành công! Cảm ơn bạn.');
    // Clear purchased (active) items
    const activeItems = this.carts().filter((item) => item.active);
    activeItems.forEach((item) => this.cartService.removeCart(item));

    if (this.carts().length === 0) {
      this.showEmptySuggestions.set(true);
    }
  }
}
