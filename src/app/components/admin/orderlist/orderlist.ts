import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckoutService } from '../../../services/checkout.service';
import { AuthService } from '../../../services/auth.service';
import { EmailService } from '../../../services/email.service';
import { removeAccents } from '../../../utils/string-utils';

@Component({
  selector: 'app-orderlist',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orderlist.html',
  styleUrl: './orderlist.css'
})
export class OrderlistComponent implements OnInit {
  checkoutService = inject(CheckoutService);
  authService = inject(AuthService);
  emailService = inject(EmailService);

  orders = this.checkoutService.orders;

  searchQuery = signal<string>('');
  statusFilter = signal<string>('all');
  priceFilter = signal<string>('all');
  sortOption = signal<string>('newest');

  selectedOrder = signal<any | null>(null);
  lightboxReceiptUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.checkoutService.loadOrders().subscribe({
      error: error => console.error('Không thể tải đơn hàng cho Admin:', error)
    });
  }

  showReceiptModal(url: string): void {
    this.lightboxReceiptUrl.set(url);
  }

  closeLightbox(): void {
    this.lightboxReceiptUrl.set(null);
  }

  filteredOrders = computed(() => {
    let list = [...this.orders()];
    const query = this.searchQuery().trim().toLowerCase();
    const status = this.statusFilter();
    const priceRange = this.priceFilter();
    const sort = this.sortOption();

    if (query) {
      const cleanQuery = removeAccents(query);
      const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 0);
      if (queryWords.length > 0) {
        list = list.filter(order => {
          const values = [order.id, order.orderCode, order.fullname, order.phone, order.email, order.accountEmail, order.address, order.userId]
            .map(value => removeAccents(String(value || '').toLowerCase()))
            .join(' ');
          const productTitles = (order.items || []).map((item: any) =>
            `${removeAccents(String(item.title || '').toLowerCase())} ${removeAccents(String(item.productId || '').toLowerCase())}`
          ).join(' ');
          const fullText = `${values} ${productTitles}`;
          return queryWords.every(w => fullText.includes(w));
        });
      }
    }

    if (status !== 'all') {
      list = list.filter(order => order.status === status);
    }

    if (priceRange !== 'all') {
      list = list.filter(order => {
        const total = Number(order.total || 0);
        if (priceRange === 'under100k') return total < 100000;
        if (priceRange === '100k-500k') return total >= 100000 && total <= 500000;
        if (priceRange === 'over500k') return total > 500000;
        return true;
      });
    }

    if (sort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    } else if (sort === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
    } else if (sort === 'priceHigh') {
      list.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
    } else if (sort === 'priceLow') {
      list.sort((a, b) => Number(a.total || 0) - Number(b.total || 0));
    }

    return list;
  });

  totalOrders = computed(() => this.orders().length);
  totalRevenue = computed(() => this.orders().filter(order => order.status === 'Đã giao hàng').reduce((sum, order) => sum + Number(order.total || 0), 0));
  pendingOrders = computed(() => this.orders().filter(order => order.status === 'Đang xử lý').length);
  completedOrders = computed(() => this.orders().filter(order => order.status === 'Đã giao hàng').length);
  cancelledOrders = computed(() => this.orders().filter(order => order.status === 'Hủy đơn hàng').length);

  updateStatus(orderId: string | number, newStatus: string): void {
    if (!this.authService.hasPermission('ORDERS_STATUS') && !this.authService.hasPermission('update')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }

    this.checkoutService.updateOrderStatus(orderId, newStatus).subscribe({
      next: updatedOrder => {
        const currentSelected = this.selectedOrder();
        if (currentSelected && String(currentSelected.id) === String(orderId)) {
          this.selectedOrder.set(updatedOrder);
        }
      },
      error: error => alert(error?.message || 'Không thể cập nhật trạng thái đơn hàng.')
    });
  }

  updatePaymentStatus(orderId: string | number, newPaymentStatus: string): void {
    if (!this.authService.hasPermission('ORDERS_STATUS') && !this.authService.hasPermission('update')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }

    const previousOrder = this.orders().find(order => String(order.id) === String(orderId));

    this.checkoutService.updateOrder(orderId, { paymentStatus: newPaymentStatus }).subscribe({
      next: updatedOrder => {
        const currentSelected = this.selectedOrder();
        if (currentSelected && String(currentSelected.id) === String(orderId)) {
          this.selectedOrder.set(updatedOrder);
        }

        // Gửi email thông báo cập nhật thanh toán nếu trạng thái thay đổi
        if (previousOrder && previousOrder.paymentStatus !== newPaymentStatus) {
          const statusText = `Thanh toán: ${newPaymentStatus}`;
          this.emailService.triggerOrderStatusUpdate(updatedOrder, updatedOrder, statusText);
        }
      },
      error: error => alert(error?.message || 'Không thể cập nhật trạng thái thanh toán.')
    });
  }

  deleteOrder(orderId: string | number): void {
    if (!this.authService.hasPermission('ORDERS_STATUS') && !this.authService.hasPermission('delete')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }

    if (!confirm('Bạn có muốn xóa đơn hàng này khỏi danh sách không? Hành động này không thể hoàn tác.')) return;

    this.checkoutService.removeOrder(orderId).subscribe({
      next: () => {
        if (String(this.selectedOrder()?.id) === String(orderId)) this.selectedOrder.set(null);
      },
      error: error => alert(error?.message || 'Không thể xóa đơn hàng.')
    });
  }

  viewOrderDetails(order: any): void {
    this.selectedOrder.set(order);
  }

  closeModal(): void {
    this.selectedOrder.set(null);
  }

  printInvoice(): void {
    window.print();
  }

  getOrderStatusClass(status: string): string {
    switch (status) {
      case 'Đã giao hàng': return 'status-completed';
      case 'Hủy đơn hàng': return 'status-cancelled';
      case 'Đang xử lý':
      default: return 'status-pending';
    }
  }

  getOrderStatusIcon(status: string): string {
    switch (status) {
      case 'Đã giao hàng': return 'bi bi-check-circle-fill';
      case 'Hủy đơn hàng': return 'bi bi-x-circle-fill';
      case 'Đang xử lý':
      default: return 'bi bi-clock-history';
    }
  }

  getPaymentStatusClass(status: string | undefined | null): string {
    switch (status || 'Chưa thanh toán') {
      case 'Đã thanh toán': return 'bg-success text-white';
      case 'Chờ xác nhận': return 'bg-warning text-dark';
      case 'Chưa thanh toán':
      default: return 'bg-danger text-white';
    }
  }

  getReceiptUrl(receipt: string | undefined | null): string {
    if (!receipt) return '';
    if (receipt.startsWith('http://') || receipt.startsWith('https://') || receipt.startsWith('data:image')) return receipt;
    return `http://localhost:3000${receipt}`;
  }
}
