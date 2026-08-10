import { Component, inject, computed, effect, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CartService } from '../../services/cart.service';
import { BookService } from '../../services/book.service';
import { AuthService } from '../../services/auth.service';
import { PromotionService } from '../../services/promotion.service';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cart.html',
  styleUrl: './cart.css'
})
export class CartComponent implements OnDestroy {
  cartService = inject(CartService);
  bookService = inject(BookService);
  authService = inject(AuthService);
  router = inject(Router);
  promotionService = inject(PromotionService);

  carts = this.cartService.userCarts; // Dùng trực tiếp signal từ service
  active: boolean = false;
  showEmptySuggestions = signal(false);

  couponCode = signal('');
  couponMessage = signal('');
  couponError = signal('');
  isApplyingCoupon = signal(false);
  private couponValidationTimer: ReturnType<typeof setTimeout> | null = null;
  private lastCouponCartSignature = '';

  // Trạng thái đặt hàng thành công
  isCheckoutSuccess = signal(false);
  purchasedItems = signal<any[]>([]);
  lastOrderTotal = signal<number>(0);
  orderDate = signal<string>('');
  orderNumber = signal<string>('');

  constructor() {
    if (this.carts().length === 0) {
      this.showEmptySuggestions.set(true);
    }

    // Tự khôi phục và kiểm tra lại coupon theo đúng tài khoản hiện tại.
    // Mỗi khi sản phẩm được chọn, số lượng hoặc giá thay đổi, server sẽ tính lại mức giảm.
    effect(() => {
      const user = this.authService.currentUser();
      const items = this.activeItems();
      const subtotal = this.totalPrice();
      const storedCode = user ? this.promotionService.getStoredCode() : '';
      const signature = `${user?.id || user?.email || 'guest'}|${storedCode}|${subtotal}|${items
        .map(item => `${item.productId}:${item.quantity}:${item.unitPrice}:${item.price}`)
        .join(',')}`;

      if (signature === this.lastCouponCartSignature) return;
      this.lastCouponCartSignature = signature;

      if (this.couponValidationTimer) clearTimeout(this.couponValidationTimer);
      if (!user || !storedCode || items.length === 0 || subtotal <= 0) {
        this.promotionService.clearQuoteOnly();
        if (storedCode) this.couponCode.set(storedCode);
        return;
      }

      this.couponCode.set(storedCode);
      this.couponValidationTimer = setTimeout(() => {
        this.promotionService.restoreAndValidate(subtotal, items).subscribe({
          next: quote => {
            if (quote) {
              this.couponMessage.set(`Đã áp dụng mã ${quote.code}: giảm ${this.formatPrice(quote.discountAmount)} đ.`);
              this.couponError.set('');
            }
          },
          error: error => {
            this.couponMessage.set('');
            this.couponError.set(error.message || 'Mã giảm giá không còn hợp lệ.');
          }
        });
      }, 180);
    });
  }

  ngOnDestroy(): void {
    if (this.couponValidationTimer) clearTimeout(this.couponValidationTimer);
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
  activeItems = computed(() => this.carts().filter(item => item.active));

  totalPrice = computed(() =>
    this.activeItems().reduce((sum, item) => sum + Number(item.price || 0), 0)
  );

  discountAmount = computed(() => Math.min(this.totalPrice(), this.promotionService.discountAmount()));
  totalAfterDiscount = computed(() => Math.max(0, this.totalPrice() - this.discountAmount()));
  grandTotal = computed(() => this.totalPrice() > 0 ? this.totalAfterDiscount() + this.shippingCost : 0);

  applyCoupon(): void {
    if (!this.authService.currentUser()) {
      this.cartService.showToast('Vui lòng đăng nhập để sử dụng mã giảm giá!');
      this.router.navigate(['/login']);
      return;
    }

    const code = this.couponCode().trim().toUpperCase();
    if (!code) {
      this.couponError.set('Vui lòng nhập mã giảm giá.');
      this.couponMessage.set('');
      return;
    }
    if (this.activeItems().length === 0) {
      this.couponError.set('Vui lòng chọn ít nhất một sản phẩm trước khi áp dụng mã.');
      this.couponMessage.set('');
      return;
    }

    this.isApplyingCoupon.set(true);
    this.couponError.set('');
    this.couponMessage.set('');
    this.promotionService.validateCode(code, this.totalPrice(), this.activeItems(), true).subscribe({
      next: quote => {
        this.isApplyingCoupon.set(false);
        this.couponCode.set(quote.code);
        this.couponMessage.set(`Áp dụng thành công: giảm ${this.formatPrice(quote.discountAmount)} đ.`);
      },
      error: error => {
        this.isApplyingCoupon.set(false);
        this.couponError.set(error.message || 'Mã giảm giá không hợp lệ.');
      }
    });
  }

  removeCoupon(): void {
    this.promotionService.clearAppliedPromotion();
    this.couponCode.set('');
    this.couponMessage.set('');
    this.couponError.set('');
    this.lastCouponCartSignature = '';
  }

  getBookStock(productId: string): number {
    const book = this.bookService.getBookById(productId);
    return book ? book.stock : 0;
  }

  hasActiveStockError = computed(() => {
    return this.carts().some(item => {
      const stock = this.getBookStock(item.productId);
      return item.active && item.quantity > stock;
    });
  });

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  // Phí vận chuyển được người dùng chọn tại trang thanh toán.
  shippingCost = 0;

  checkout(): void {
    if (!this.authService.currentUser()) {
      this.cartService.showToast('Bạn cần đăng nhập để thực hiện thanh toán!');
      this.router.navigate(['/login']);
      return;
    }

    const activeItems = this.carts().filter((item) => item.active);
    if (activeItems.length === 0) {
      this.cartService.showToast('Vui lòng chọn ít nhất một sản phẩm để thanh toán!');
      return;
    }

    if (this.promotionService.isValidating()) {
      this.cartService.showToast('Hệ thống đang kiểm tra mã giảm giá. Vui lòng chờ trong giây lát!');
      return;
    }

    if (this.hasActiveStockError()) {
      this.cartService.showToast('Có sản phẩm vượt quá số lượng trong kho. Vui lòng kiểm tra lại!');
      return;
    }

    this.router.navigate(['/checkout']);
  }

  continueShopping(): void {
    this.isCheckoutSuccess.set(false);
    this.router.navigate(['/']);
  }
}
