import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { BookService } from '../../../services/book.service';
import {
  Promotion,
  PromotionDiscountType,
  PromotionScope,
  PromotionService
} from '../../../services/promotion.service';
import { removeAccents } from '../../../utils/string-utils';

@Component({
  selector: 'app-promotions-manage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promotions-manage.html',
  styleUrl: './promotions-manage.css'
})
export class PromotionsManageComponent implements OnInit {
  promotionService = inject(PromotionService);
  authService = inject(AuthService);
  bookService = inject(BookService);

  canView = computed(() => this.authService.hasPermission('PROMOTIONS_VIEW'));
  canCreate = computed(() => this.authService.hasPermission('PROMOTIONS_CREATE'));
  canEdit = computed(() => this.authService.hasPermission('PROMOTIONS_EDIT'));
  canDelete = computed(() => this.authService.hasPermission('PROMOTIONS_DELETE'));

  searchTerm = signal('');
  statusFilter = signal<'ALL' | 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'DISABLED'>('ALL');
  typeFilter = signal<'ALL' | PromotionDiscountType>('ALL');
  currentPage = signal(1);
  pageSize = signal(8);

  isModalOpen = signal(false);
  isEditing = signal(false);
  isSaving = signal(false);
  isDeletingId = signal<string | null>(null);
  errorMessage = signal('');

  formModel = signal<Promotion>(this.createEmptyPromotion());

  promotions = computed(() => this.promotionService.promotions());
  books = computed(() => this.bookService.allBooks());
  categories = computed(() => this.bookService.getAdminCategories());

  filteredPromotions = computed(() => {
    let items = [...this.promotions()];
    const query = removeAccents(this.searchTerm().trim().toLowerCase());
    const status = this.statusFilter();
    const type = this.typeFilter();

    if (query) {
      items = items.filter(item => {
        const text = removeAccents([
          item.code,
          item.name,
          item.description
        ].join(' ').toLowerCase());
        return text.includes(query);
      });
    }

    if (status !== 'ALL') {
      items = items.filter(item => this.getPromotionStatus(item).key === status);
    }

    if (type !== 'ALL') {
      items = items.filter(item => item.discountType === type);
    }

    return items.sort((first, second) =>
      new Date(second.createdAt || 0).getTime() - new Date(first.createdAt || 0).getTime()
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredPromotions().length / this.pageSize())));

  pagedPromotions = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredPromotions().slice(start, start + this.pageSize());
  });

  stats = computed(() => {
    const list = this.promotions();
    return {
      total: list.length,
      active: list.filter(item => this.getPromotionStatus(item).key === 'ACTIVE').length,
      upcoming: list.filter(item => this.getPromotionStatus(item).key === 'UPCOMING').length,
      usage: list.reduce((sum, item) => sum + Number(item.usedCount || 0), 0)
    };
  });

  ngOnInit(): void {
    if (!this.canView()) return;
    this.promotionService.loadPromotions(true).subscribe({
      error: error => this.errorMessage.set(error.message || 'Không thể tải mã giảm giá.')
    });
  }

  private toLocalInputValue(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private createEmptyPromotion(): Promotion {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 30);

    return {
      id: '',
      code: '',
      name: '',
      description: '',
      discountType: 'PERCENT',
      discountValue: 10,
      minOrderValue: 0,
      maxDiscount: 0,
      startAt: this.toLocalInputValue(now),
      endAt: this.toLocalInputValue(end),
      usageLimit: 0,
      usedCount: 0,
      perUserLimit: 1,
      applicableScope: 'ALL',
      applicableCategory: '',
      applicableProductIds: [],
      isActive: true,
      createdAt: '',
      updatedAt: ''
    };
  }

  openCreateModal(): void {
    if (!this.canCreate()) {
      alert('Bạn không có quyền tạo mã giảm giá.');
      return;
    }
    this.formModel.set(this.createEmptyPromotion());
    this.isEditing.set(false);
    this.errorMessage.set('');
    this.isModalOpen.set(true);
  }

  openEditModal(item: Promotion): void {
    if (!this.canEdit()) {
      alert('Bạn không có quyền chỉnh sửa mã giảm giá.');
      return;
    }
    this.formModel.set({
      ...item,
      startAt: this.toDateTimeLocal(item.startAt),
      endAt: this.toDateTimeLocal(item.endAt),
      applicableProductIds: [...(item.applicableProductIds || [])]
    });
    this.isEditing.set(true);
    this.errorMessage.set('');
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    if (this.isSaving()) return;
    this.isModalOpen.set(false);
    this.errorMessage.set('');
  }

  updateForm<K extends keyof Promotion>(key: K, value: Promotion[K]): void {
    this.formModel.update(model => ({ ...model, [key]: value }));
  }

  onCodeInput(value: string): void {
    this.updateForm('code', value.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, ''));
  }

  onScopeChange(scope: PromotionScope): void {
    this.formModel.update(model => ({
      ...model,
      applicableScope: scope,
      applicableCategory: scope === 'CATEGORY' ? model.applicableCategory : '',
      applicableProductIds: scope === 'PRODUCT' ? model.applicableProductIds : []
    }));
  }

  isProductSelected(productId: string): boolean {
    return this.formModel().applicableProductIds.includes(String(productId));
  }

  toggleProduct(productId: string, checked: boolean): void {
    const id = String(productId);
    this.formModel.update(model => {
      const current = new Set((model.applicableProductIds || []).map(String));
      if (checked) current.add(id);
      else current.delete(id);
      return { ...model, applicableProductIds: Array.from(current) };
    });
  }

  private validateForm(model: Promotion): string | null {
    if (!model.code.trim()) return 'Vui lòng nhập mã giảm giá.';
    if (!model.name.trim()) return 'Vui lòng nhập tên chương trình.';
    if (!Number.isFinite(Number(model.discountValue)) || Number(model.discountValue) <= 0) {
      return 'Giá trị giảm phải lớn hơn 0.';
    }
    if (model.discountType === 'PERCENT' && Number(model.discountValue) > 100) {
      return 'Mức giảm theo phần trăm không được vượt quá 100%.';
    }
    if (Number(model.minOrderValue) < 0 || Number(model.maxDiscount) < 0) {
      return 'Giá trị đơn tối thiểu và mức giảm tối đa không được âm.';
    }
    if (Number(model.usageLimit) < 0 || Number(model.perUserLimit) < 0) {
      return 'Giới hạn sử dụng không được âm.';
    }
    const start = new Date(model.startAt);
    const end = new Date(model.endAt);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Thời gian áp dụng không hợp lệ.';
    if (end <= start) return 'Thời gian kết thúc phải sau thời gian bắt đầu.';
    if (model.applicableScope === 'CATEGORY' && !model.applicableCategory) {
      return 'Vui lòng chọn danh mục áp dụng.';
    }
    if (model.applicableScope === 'PRODUCT' && model.applicableProductIds.length === 0) {
      return 'Vui lòng chọn ít nhất một sản phẩm áp dụng.';
    }
    return null;
  }

  savePromotion(): void {
    const model = this.formModel();
    const validationError = this.validateForm(model);
    if (validationError) {
      this.errorMessage.set(validationError);
      return;
    }

    const payload: Partial<Promotion> = {
      ...model,
      code: model.code.trim().toUpperCase(),
      name: model.name.trim(),
      description: model.description.trim(),
      discountValue: Number(model.discountValue),
      minOrderValue: Number(model.minOrderValue || 0),
      maxDiscount: Number(model.maxDiscount || 0),
      usageLimit: Number(model.usageLimit || 0),
      perUserLimit: Number(model.perUserLimit || 0),
      startAt: new Date(model.startAt).toISOString(),
      endAt: new Date(model.endAt).toISOString(),
      applicableProductIds: (model.applicableProductIds || []).map(String)
    };

    this.isSaving.set(true);
    this.errorMessage.set('');

    const request = this.isEditing()
      ? this.promotionService.updatePromotion(model.id, payload)
      : this.promotionService.createPromotion(payload);

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isModalOpen.set(false);
        alert(this.isEditing() ? 'Cập nhật mã giảm giá thành công!' : 'Tạo mã giảm giá thành công!');
      },
      error: error => {
        this.isSaving.set(false);
        this.errorMessage.set(error.message || 'Không thể lưu mã giảm giá.');
      }
    });
  }

  toggleStatus(item: Promotion): void {
    if (!this.canEdit()) {
      alert('Bạn không có quyền thay đổi trạng thái mã giảm giá.');
      return;
    }
    this.promotionService.togglePromotion(item.id, !item.isActive).subscribe({
      error: error => alert(error.message || 'Không thể đổi trạng thái mã giảm giá.')
    });
  }

  deletePromotion(item: Promotion): void {
    if (!this.canDelete()) {
      alert('Bạn không có quyền xóa mã giảm giá.');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa mã "${item.code}"? Mã đã phát sinh lượt dùng sẽ không được phép xóa.`)) {
      return;
    }

    this.isDeletingId.set(item.id);
    this.promotionService.deletePromotion(item.id).subscribe({
      next: () => {
        this.isDeletingId.set(null);
        if (this.currentPage() > this.totalPages()) this.currentPage.set(this.totalPages());
      },
      error: error => {
        this.isDeletingId.set(null);
        alert(error.message || 'Không thể xóa mã giảm giá.');
      }
    });
  }

  getPromotionStatus(item: Promotion): { key: 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'DISABLED'; label: string; className: string } {
    if (!item.isActive) {
      return { key: 'DISABLED', label: 'Tạm ngưng', className: 'status-disabled' };
    }
    const now = Date.now();
    const start = new Date(item.startAt).getTime();
    const end = new Date(item.endAt).getTime();
    if (Number.isFinite(start) && now < start) {
      return { key: 'UPCOMING', label: 'Sắp diễn ra', className: 'status-upcoming' };
    }
    if (Number.isFinite(end) && now > end) {
      return { key: 'EXPIRED', label: 'Đã hết hạn', className: 'status-expired' };
    }
    if (item.usageLimit > 0 && item.usedCount >= item.usageLimit) {
      return { key: 'EXPIRED', label: 'Hết lượt', className: 'status-expired' };
    }
    return { key: 'ACTIVE', label: 'Đang hoạt động', className: 'status-active' };
  }

  getDiscountLabel(item: Promotion): string {
    return item.discountType === 'PERCENT'
      ? `${this.formatNumber(item.discountValue)}%`
      : `${this.formatPrice(item.discountValue)} đ`;
  }

  getScopeLabel(item: Promotion): string {
    if (item.applicableScope === 'CATEGORY') {
      const category = this.categories().find(entry => entry.value === item.applicableCategory);
      return `Danh mục: ${category?.name || item.applicableCategory}`;
    }
    if (item.applicableScope === 'PRODUCT') {
      return `${item.applicableProductIds?.length || 0} sản phẩm`;
    }
    return 'Toàn bộ đơn hàng';
  }

  getUsagePercent(item: Promotion): number {
    if (!item.usageLimit) return 0;
    return Math.min(100, Math.round((Number(item.usedCount || 0) / Number(item.usageLimit)) * 100));
  }

  setStatusFilter(status: 'ALL' | 'ACTIVE' | 'UPCOMING' | 'EXPIRED' | 'DISABLED'): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) this.currentPage.set(page);
  }

  toDateTimeLocal(value: string): string {
    const date = new Date(value);
    return isNaN(date.getTime()) ? value : this.toLocalInputValue(date);
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return isNaN(date.getTime()) ? 'Không xác định' : date.toLocaleString('vi-VN');
  }

  formatPrice(value: number): string {
    return Number(value || 0).toLocaleString('vi-VN');
  }

  formatNumber(value: number): string {
    return Number(value || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
  }
}
