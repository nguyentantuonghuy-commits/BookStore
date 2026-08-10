import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Promotion, PromotionService } from '../../services/promotion.service';

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './promotions.html',
  styleUrl: './promotions.css'
})
export class PromotionsComponent implements OnInit {
  promotionService = inject(PromotionService);
  authService = inject(AuthService);
  private router = inject(Router);

  isLoading = signal(true);
  errorMessage = signal('');
  copiedCode = signal('');

  promotions = computed(() => this.promotionService.publicPromotions());

  ngOnInit(): void {
    this.loadPromotions();
  }

  loadPromotions(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');
    this.promotionService.loadPublicPromotions(true).subscribe({
      next: () => this.isLoading.set(false),
      error: error => {
        this.isLoading.set(false);
        this.errorMessage.set(error.message || 'Không thể tải chương trình khuyến mãi.');
      }
    });
  }

  discountLabel(item: Promotion): string {
    return item.discountType === 'FIXED'
      ? `Giảm ${this.formatPrice(item.discountValue)} đ`
      : `Giảm ${item.discountValue}%`;
  }

  scopeLabel(item: Promotion): string {
    if (item.applicableScope === 'CATEGORY') {
      return `Áp dụng cho danh mục ${item.applicableCategory}`;
    }
    if (item.applicableScope === 'PRODUCT') {
      return `Áp dụng cho ${item.applicableProductIds?.length || 0} sản phẩm được chọn`;
    }
    return 'Áp dụng cho toàn bộ sản phẩm';
  }

  remainingLabel(item: Promotion): string {
    if (!item.usageLimit) return 'Không giới hạn tổng lượt';
    const remaining = Math.max(0, Number(item.usageLimit) - Number(item.usedCount || 0));
    return `Còn ${remaining} lượt`;
  }

  endDate(item: Promotion): string {
    return new Date(item.endAt).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.copiedCode.set(code);
      setTimeout(() => {
        if (this.copiedCode() === code) this.copiedCode.set('');
      }, 1800);
    } catch {
      this.copiedCode.set('');
      alert(`Mã giảm giá: ${code}`);
    }
  }

  usePromotion(item: Promotion): void {
    if (!this.authService.currentUser()) {
      alert('Vui lòng đăng nhập trước khi sử dụng mã giảm giá.');
      this.router.navigate(['/login']);
      return;
    }

    this.promotionService.rememberCodeForCart(item.code);
    this.router.navigate(['/cart']);
  }

  formatPrice(value: number): string {
    return Number(value || 0).toLocaleString('vi-VN');
  }
}
