import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckoutService } from '../../services/checkout.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-orderuser',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orderuser.html',
  styleUrl: './orderuser.css'
})
export class OrderUserComponent implements OnInit {
  checkoutService = inject(CheckoutService);
  router = inject(Router);

  orders = computed(() => [...this.checkoutService.getUserOrders()].reverse());

  selectedOrder = signal<any | null>(null);
  lightboxReceiptUrl = signal<string | null>(null);

  ngOnInit(): void {
    this.checkoutService.loadOrders().subscribe({
      next: () => this.openNotificationOrderIfNeeded(),
      error: error => console.error('Không thể tải lịch sử đơn hàng:', error)
    });
  }

  private openNotificationOrderIfNeeded(): void {
    const orderId = this.checkoutService.selectedOrderNotificationId();
    if (orderId === null || orderId === undefined) return;

    const match = this.orders().find(order => String(order.id) === String(orderId));
    if (match) this.selectedOrder.set(match);
    this.checkoutService.selectedOrderNotificationId.set(null);
  }

  showReceiptModal(url: string): void {
    this.lightboxReceiptUrl.set(url);
  }

  closeLightbox(): void {
    this.lightboxReceiptUrl.set(null);
  }

  updateStatus(orderId: string | number, newStatus: string): void {
    if (!confirm('Bạn có chắc chắn muốn hủy đơn hàng này không?')) return;

    this.checkoutService.updateOrderStatus(orderId, newStatus).subscribe({
      next: updatedOrder => {
        const currentSelected = this.selectedOrder();
        if (currentSelected && String(currentSelected.id) === String(orderId)) {
          this.selectedOrder.set(updatedOrder);
        }
      },
      error: error => alert(error?.message || 'Không thể cập nhật đơn hàng.')
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
}
