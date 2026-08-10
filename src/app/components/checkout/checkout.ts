import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CheckoutService } from '../../services/checkout.service';
import { PromotionService } from '../../services/promotion.service';
import { removeAccents } from '../../utils/string-utils';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class CheckoutComponent implements OnInit {
  private checkoutService = inject(CheckoutService);
  private promotionService = inject(PromotionService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  currentUser = this.checkoutService.currentUser;
  appliedPromotion = this.promotionService.appliedQuote;
  isPromotionValidating = this.promotionService.isValidating;

  userCarts = computed(() => {
    const user = this.currentUser();
    return user ? this.checkoutService.getActiveUserCarts() : [];
  });

  subtotal = computed(() => this.checkoutService.calculateSubtotal(this.userCarts()));
  discountAmount = computed(() => Math.min(
    this.subtotal(),
    Number(this.appliedPromotion()?.discountAmount || 0)
  ));
  shippingCost = signal<number>(0);
  total = computed(() => Math.max(0, this.subtotal() - this.discountAmount()) + this.shippingCost());

  isCheckoutSuccess = signal(false);
  isSubmitting = signal(false);
  orderDate = signal('');
  orderNumber = signal('');
  lastOrderSubtotal = signal(0);
  lastOrderDiscount = signal(0);
  lastOrderShipping = signal(0);
  lastOrderTotal = signal(0);
  lastOrderPromotionCode = signal('');
  purchasedItems = signal<any[]>([]);
  lastOrderPaymentMethod = signal<string>('COD');

  paymentMethod = signal<'COD' | 'BANK_TRANSFER'>('COD');
  paymentReceipt = signal<string>('');
  orderCode = signal<string>('');
  uploadedFileName = signal<string>('');
  activeRightTab = signal<'order' | 'vietqr'>('order');
  showReceiptLightbox = signal(false);
  promotionNotice = signal('');

  formData: FormGroup = this.fb.group({
    fullname: ['', Validators.required],
    phone: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    address: ['', Validators.required],
  });

  ngOnInit(): void {
    this.generateOrderCode();

    const user = this.currentUser();
    if (!user) {
      alert('Bạn cần đăng nhập để truy cập trang thanh toán.');
      this.router.navigate(['/login']);
      return;
    }

    const currentInfo = this.checkoutService.findCurrentUserInfo(user.id || user.email);
    if (currentInfo) {
      this.formData.patchValue({
        fullname: currentInfo.fullname || user.name || '',
        phone: currentInfo.phone || '',
        email: currentInfo.email || user.email || '',
        address: currentInfo.address || '',
      });
    } else {
      this.formData.patchValue({
        fullname: user.name || '',
        email: user.email || '',
      });
    }

    // Không tin mức giảm đang giữ trong trình duyệt. Khi vào trang thanh toán,
    // mã được kiểm tra lại với giỏ hàng và tài khoản hiện tại trên server.
    const storedCode = this.promotionService.getStoredCode();
    if (storedCode && this.userCarts().length > 0) {
      this.promotionNotice.set('Đang kiểm tra lại mã giảm giá...');
      this.promotionService.restoreAndValidate(this.subtotal(), this.userCarts()).subscribe({
        next: quote => {
          this.promotionNotice.set(quote
            ? `Mã ${quote.code} hợp lệ, bạn được giảm ${this.formatPrice(quote.discountAmount)} đ.`
            : '');
        },
        error: error => {
          this.promotionNotice.set(error.message || 'Mã giảm giá không còn hợp lệ và đã được gỡ khỏi đơn hàng.');
        }
      });
    }
  }

  private generateOrderCode(): void {
    this.orderCode.set('SW' + Math.floor(100000 + Math.random() * 900000));
  }

  setShippingCost(cost: number): void {
    this.shippingCost.set(cost);
  }

  selectPaymentMethod(method: 'COD' | 'BANK_TRANSFER'): void {
    this.paymentMethod.set(method);
    if (method === 'BANK_TRANSFER') {
      this.activeRightTab.set('vietqr');
    } else {
      this.activeRightTab.set('order');
      this.paymentReceipt.set('');
      this.uploadedFileName.set('');
    }
  }

  getQrCodeUrl(): string {
    const amount = Math.round(this.total());
    const cleanName = removeAccents(this.formData.get('fullname')?.value || '')
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, '')
      .trim();
    const info = encodeURIComponent(`${this.orderCode()} ${cleanName}`);
    return `https://img.vietqr.io/image/970407-59786666666666-compact.png?amount=${amount}&addInfo=${info}&accountName=NGUYEN%20TAN%20TUONG%20HUY`;
  }

  copyToClipboard(text: string, label: string): void {
    navigator.clipboard.writeText(text).then(() => {
      alert(`Đã sao chép ${label} thành công!`);
    }).catch(error => {
      console.error('Không thể sao chép:', error);
    });
  }

  removeReceiptFile(event: Event): void {
    event.stopPropagation();
    event.preventDefault();
    this.paymentReceipt.set('');
    this.uploadedFileName.set('');
    const fileInput = document.getElementById('receipt-file-direct') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploadedFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = loadEvent => {
      this.paymentReceipt.set(String(loadEvent.target?.result || ''));
    };
    reader.readAsDataURL(file);
  }

  handleSubmit(): void {
    if (this.isSubmitting()) return;

    if (this.isPromotionValidating()) {
      alert('Hệ thống đang kiểm tra mã giảm giá. Vui lòng chờ trong giây lát.');
      return;
    }

    if (this.formData.invalid || this.userCarts().length === 0) {
      alert('Vui lòng kiểm tra lại thông tin và giỏ hàng.');
      this.formData.markAllAsTouched();
      return;
    }

    if (this.paymentMethod() === 'BANK_TRANSFER' && !this.paymentReceipt()) {
      alert('Vui lòng tải lên hình ảnh chụp màn hình giao dịch chuyển khoản thành công để xác minh thanh toán.');
      return;
    }

    const activeItems = this.userCarts().map(item => ({ ...item }));
    const paymentMethod = this.paymentMethod();
    const quote = this.appliedPromotion();

    const orderPayload = {
      ...this.formData.getRawValue(),
      orderCode: this.orderCode(),
      shippingCost: this.shippingCost(),
      paymentMethod,
      paymentReceipt: this.paymentReceipt(),
      // Server sẽ kiểm tra lại toàn bộ điều kiện và tự tính số tiền giảm.
      // Frontend không được phép tự gửi discountAmount để tránh sửa giá.
      promotionCode: quote?.code || ''
    };

    this.isSubmitting.set(true);

    // Thông tin nhận hàng chỉ được lưu trong đơn hàng.
    // Không cập nhật hồ sơ tại đây để tránh mua hàng ghi đè tên, ngày sinh, giới tính hoặc mật khẩu.
    this.checkoutService.checkout(orderPayload).subscribe({
      next: savedOrder => {
        const savedSubtotal = Number(savedOrder.subtotal ?? this.subtotal());
        const savedDiscount = Number(savedOrder.discountAmount || 0);
        const savedShipping = Number(savedOrder.shippingCost || 0);

        this.purchasedItems.set(Array.isArray(savedOrder.items) ? savedOrder.items : activeItems);
        this.lastOrderSubtotal.set(savedSubtotal);
        this.lastOrderDiscount.set(savedDiscount);
        this.lastOrderShipping.set(savedShipping);
        this.lastOrderTotal.set(Number(savedOrder.total ?? (savedSubtotal - savedDiscount + savedShipping)));
        this.lastOrderPromotionCode.set(savedOrder.promotion?.code || '');
        this.lastOrderPaymentMethod.set(savedOrder.paymentMethod || paymentMethod);

        const createdAt = savedOrder.createdAt ? new Date(savedOrder.createdAt) : new Date();
        this.orderDate.set(
          createdAt.toLocaleDateString('vi-VN') + ' ' +
          createdAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
        );
        this.orderNumber.set(savedOrder.orderCode || this.orderCode());

        // Mã đã được ghi nhận cho đơn hàng này; gỡ khỏi phiên hiện tại để tránh
        // người dùng hiểu nhầm rằng mã tự động áp dụng cho giỏ hàng tiếp theo.
        this.promotionService.clearAppliedPromotion();
        this.promotionNotice.set('');

        this.isCheckoutSuccess.set(true);
        this.generateOrderCode();
        this.paymentReceipt.set('');
        this.uploadedFileName.set('');
        this.paymentMethod.set('COD');
        this.activeRightTab.set('order');

        window.scrollTo({ top: 0, behavior: 'instant' });
      },
      error: error => {
        this.isSubmitting.set(false);
        console.error('Lỗi thanh toán:', error);
        alert(error?.message || 'Đơn hàng chưa được lưu. Vui lòng kiểm tra server và thử lại.');
      },
      complete: () => this.isSubmitting.set(false)
    });
  }

  continueShopping(): void {
    this.isCheckoutSuccess.set(false);
    this.router.navigate(['/']).then(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  formatPrice(price: number): string {
    return Number(price || 0).toLocaleString('vi-VN');
  }
}
