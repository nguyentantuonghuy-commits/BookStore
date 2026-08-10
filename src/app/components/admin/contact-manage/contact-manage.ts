import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContactService, ContactMessage } from '../../../services/contact.service';
import { AuthService } from '../../../services/auth.service';
import { removeAccents } from '../../../utils/string-utils';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-contact-manage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact-manage.html',
  styleUrl: './contact-manage.css'
})
export class ContactManageComponent implements OnInit {
  contactService = inject(ContactService);
  authService = inject(AuthService);
  cartService = inject(CartService);

  messages = computed(() => this.contactService.messages());

  // Quick statistics
  totalMessages = computed(() => this.contactService.totalMessages());
  newCount = computed(() => this.contactService.newCount());
  repliedCount = computed(() => this.contactService.repliedCount());
  archivedCount = computed(() => this.contactService.archivedCount());

  // Permission-based computed signals
  canViewContact = computed(() => this.authService.hasPermission('CONTACT_VIEW'));
  canReplyContact = computed(() => this.authService.hasPermission('CONTACT_REPLY'));
  canDeleteContact = computed(() => this.authService.hasPermission('CONTACT_DELETE'));
  canArchiveContact = computed(() => this.authService.hasPermission('CONTACT_ARCHIVE'));

  // Search & Filter States
  searchTerm = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(8);
  selectedStatus = signal<string>('All');

  // Detail modal state
  selectedMessage = signal<ContactMessage | null>(null);
  isDetailModalOpen = signal<boolean>(false);

  // Reply modal state
  isReplyModalOpen = signal<boolean>(false);
  replyContent = signal<string>('');
  replyingMessage = signal<ContactMessage | null>(null);

  filteredMessages = computed(() => {
    let list = this.messages();

    // Status Filter
    const status = this.selectedStatus();
    if (status !== 'All') {
      list = list.filter(m => m.status === status);
    }

    // Search Filter
    const query = removeAccents(this.searchTerm().trim().toLowerCase());
    if (!query) return list;

    return list.filter(m =>
      removeAccents(m.fullName).toLowerCase().includes(query) ||
      removeAccents(m.email).toLowerCase().includes(query) ||
      removeAccents(m.phone).toLowerCase().includes(query) ||
      removeAccents(m.subject).toLowerCase().includes(query) ||
      removeAccents(m.message).toLowerCase().includes(query)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredMessages().length / this.pageSize())));

  pagedMessages = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredMessages().slice(start, start + this.pageSize());
  });

  ngOnInit() { }

  // View Detail
  viewDetail(msg: ContactMessage) {
    this.selectedMessage.set({ ...msg });
    this.isDetailModalOpen.set(true);
    // Auto-mark as read when viewing
    if (msg.status === 'new') {
      this.contactService.markAsRead(msg.id);
    }
  }

  closeDetailModal() {
    this.selectedMessage.set(null);
    this.isDetailModalOpen.set(false);
  }

  // Reply
  openReplyModal(msg: ContactMessage) {
    if (!this.canReplyContact()) {
      alert('Bạn không có quyền phản hồi tin nhắn liên hệ. Vui lòng liên hệ quản trị viên để được cấp quyền CONTACT_REPLY.');
      return;
    }
    this.replyingMessage.set({ ...msg });
    this.replyContent.set('');
    this.isReplyModalOpen.set(true);
    this.closeDetailModal();
  }

  // Email sending simulation states
  isSendingEmail = signal<boolean>(false);
  emailSendingProgress = signal<number>(0);
  emailSendingStatusText = signal<string>('');
  showEmailSuccessReport = signal<boolean>(false);
  emailReportData = signal<any>(null);

  closeReplyModal() {
    this.replyingMessage.set(null);
    this.replyContent.set('');
    this.isReplyModalOpen.set(false);
  }

  completeSendProcess(msg: any, content: string, repliedBy: string, isFallback: boolean) {
    this.contactService.replyMessage(msg.id, content, repliedBy);
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    this.emailReportData.set({
      id: 'MSG-' + Math.floor(100000 + Math.random() * 900000),
      recipient: msg.fullName,
      email: msg.email,
      subject: `[Sachweb] Phản hồi liên hệ: ${msg.subject}`,
      content: content,
      originalMessage: msg.message,
      sentAt: dateStr,
      repliedBy: repliedBy,
      isSimulation: isFallback
    });
    this.showEmailSuccessReport.set(true);
    this.cartService.showToast(isFallback ? 'Đã lưu phản hồi (Mô phỏng)!' : 'Đã gửi email phản hồi thành công!');
    this.closeReplyModal();
  }

  submitReply() {
    const msg = this.replyingMessage();
    const content = this.replyContent().trim();
    if (!msg || !content) {
      alert('Vui lòng nhập nội dung phản hồi.');
      return;
    }
    const currentUser = this.authService.getCurrentUser();
    const repliedBy = currentUser?.name || currentUser?.email || 'Admin';

    // Start email simulation workflow
    this.isReplyModalOpen.set(false); // Close reply modal to show sending screen
    this.isSendingEmail.set(true);
    this.emailSendingProgress.set(5);
    this.emailSendingStatusText.set('Đang kết nối tới máy chủ SMTP (smtp.sachweb.vn:465)...');

    // Trigger the real email API call immediately in background
    let apiSuccess = false;
    let apiError: string | null = null;

    this.contactService.sendReplyEmail(msg.email, msg.fullName, msg.subject, msg.message, content)
      .subscribe({
        next: (res) => {
          apiSuccess = true;
        },
        error: (err) => {
          console.error('Failed to send real email:', err);
          apiError = err.error?.message || err.message || 'Lỗi kết nối tới email server.';
        }
      });

    // Animate steps
    setTimeout(() => {
      this.emailSendingProgress.set(30);
      this.emailSendingStatusText.set('Đang xác thực bảo mật SSL/TLS & tài khoản support@sachweb.vn...');
      
      setTimeout(() => {
        this.emailSendingProgress.set(65);
        this.emailSendingStatusText.set('Đang gửi dữ liệu phản hồi đến máy chủ SMTP...');

        setTimeout(() => {
          const checkAndFinish = () => {
            if (apiError) {
              this.isSendingEmail.set(false);
              alert('Lỗi gửi Email thực tế: ' + apiError + '\n\nHệ thống sẽ tự động lưu phản hồi và chuyển sang chế độ Mô Phỏng.');
              this.completeSendProcess(msg, content, repliedBy, true);
              return;
            }

            if (apiSuccess) {
              this.emailSendingProgress.set(100);
              this.emailSendingStatusText.set('Gửi email thực tế thành công! Đang lưu lịch sử...');
              setTimeout(() => {
                this.isSendingEmail.set(false);
                this.completeSendProcess(msg, content, repliedBy, false);
              }, 600);
            } else {
              this.emailSendingStatusText.set('Đang chờ phản hồi xác nhận giao dịch từ Gmail SMTP...');
              setTimeout(checkAndFinish, 300);
            }
          };
          
          checkAndFinish();
        }, 1000);
      }, 700);
    }, 600);
  }

  // Update Priority
  changePriority(id: string, priority: 'low' | 'normal' | 'high' | 'urgent') {
    this.contactService.updatePriority(id, priority);
    this.cartService.showToast('Cập nhật mức độ ưu tiên thành công!');
  }

  // Update Admin Note
  saveAdminNote(id: string, note: string) {
    const msg = this.contactService.messages().find(m => m.id === id);
    if (msg && msg.adminNote === note) {
      return; // No change, do not save or show toast
    }
    this.contactService.updateAdminNote(id, note);
    this.cartService.showToast('Lưu ghi chú nội bộ thành công!');
  }

  // Archive
  archiveMsg(id: string) {
    if (!this.canArchiveContact()) {
      alert('Bạn không có quyền lưu trữ tin nhắn liên hệ. Vui lòng liên hệ quản trị viên để được cấp quyền CONTACT_ARCHIVE.');
      return;
    }
    if (confirm('Bạn có chắc muốn chuyển tin nhắn này vào kho lưu trữ?')) {
      this.contactService.archiveMessage(id);
      this.cartService.showToast('Đã lưu trữ tin nhắn thành công!');
      this.closeDetailModal();
    }
  }

  // Delete
  deleteMsg(id: string) {
    if (!this.canDeleteContact()) {
      alert('Bạn không có quyền xóa tin nhắn liên hệ. Vui lòng liên hệ quản trị viên để được cấp quyền CONTACT_DELETE.');
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa vĩnh viễn tin nhắn này không? Thao tác này không thể hoàn tác!')) {
      this.contactService.deleteMessage(id);
      this.cartService.showToast('Xóa tin nhắn thành công!');
      this.closeDetailModal();
      if (this.currentPage() > this.totalPages()) {
        this.currentPage.set(this.totalPages());
      }
    }
  }

  // Reset Database
  resetDatabase() {
    if (this.authService.getCurrentUser()?.role !== 'admin') {
      alert('Chỉ quản trị viên tối cao mới có quyền khôi phục dữ liệu mẫu.');
      return;
    }
    if (confirm('Bạn có chắc muốn khôi phục toàn bộ danh sách liên hệ mặc định không?')) {
      this.contactService.resetToDefault();
      this.currentPage.set(1);
      this.selectedStatus.set('All');
      this.cartService.showToast('Khôi phục danh sách liên hệ thành công!');
    }
  }

  filterByStatus(status: string) {
    if (this.selectedStatus() === status) {
      this.selectedStatus.set('All');
    } else {
      this.selectedStatus.set(status);
    }
    this.currentPage.set(1);
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'new': return 'Mới';
      case 'read': return 'Đã đọc';
      case 'replied': return 'Đã phản hồi';
      case 'archived': return 'Lưu trữ';
      default: return status;
    }
  }

  getPriorityLabel(priority: string): string {
    switch (priority) {
      case 'low': return 'Thấp';
      case 'normal': return 'Bình thường';
      case 'high': return 'Cao';
      case 'urgent': return 'Khẩn cấp';
      default: return priority;
    }
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  replyFromDetail(msg: ContactMessage) {
    this.closeDetailModal();
    this.openReplyModal(msg);
  }
}
