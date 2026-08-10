import { Component, OnInit, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EmailService, EmailLog, EmailTemplate } from '../../../services/email.service';
import { AuthService } from '../../../services/auth.service';
import { removeAccents } from '../../../utils/string-utils';

@Component({
  selector: 'app-emails',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './emails.html',
  styleUrl: './emails.css'
})
export class EmailsComponent implements OnInit {
  emailService = inject(EmailService);
  authService = inject(AuthService);

  // Search & Filter State
  searchQuery = signal<string>('');
  selectedTypeFilter = signal<string>('all');
  selectedStatusFilter = signal<string>('all');
  activeSubTab = signal<'logs' | 'templates'>('logs');

  // Date filter
  dateFilter = signal<string>('all');

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(15);

  // Bulk selection
  selectedIds = signal<Set<string>>(new Set());

  // Selected Item details for Modals
  selectedLog = signal<EmailLog | null>(null);
  selectedTemplate = signal<EmailTemplate | null>(null);

  // Edit Template Form
  editSubject = signal<string>('');
  editBody = signal<string>('');

  // Manual Email State
  isManualEmailModalOpen = signal<boolean>(false);
  manualToEmail = signal<string>('');
  manualRecipientName = signal<string>('');
  manualSubject = signal<string>('');
  manualContent = signal<string>('');

  // Auto-cleanup
  cleanupDays = signal<number>(90);
  cleanupMessage = signal<string>('');

  constructor() {
    // Reset page to 1 when filters change
    effect(() => {
      this.searchQuery();
      this.selectedTypeFilter();
      this.selectedStatusFilter();
      this.dateFilter();
      this.currentPage.set(1);
      this.selectedIds.set(new Set());
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    if (!this.authService.hasPermission('EMAIL_MANAGE')) {
      return;
    }
    if (this.emailService.templates().length > 0) {
      this.selectTemplate(this.emailService.templates()[0]);
    }

    // Load cleanup setting
    const saved = localStorage.getItem('email_cleanup_days');
    if (saved) this.cleanupDays.set(parseInt(saved, 10));

    // Run auto-cleanup
    this.runAutoCleanup();
  }

  // ─── STATISTICS (computed) ───────────────────────────────
  totalEmails = computed(() => this.emailService.emails().length);
  successEmails = computed(() => this.emailService.emails().filter(e => e.status === 'Thành công').length);
  failedEmails = computed(() => this.emailService.emails().filter(e => e.status === 'Thất bại').length);
  todayEmails = computed(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
    return this.emailService.emails().filter(e => e.sentAt.startsWith(todayStr)).length;
  });
  successRate = computed(() => {
    const total = this.totalEmails();
    if (total === 0) return 0;
    return Math.round((this.successEmails() / total) * 100);
  });

  // ─── DATE FILTER HELPERS ─────────────────────────────────
  private getDateRange(filter: string): [Date, Date] | null {
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    switch (filter) {
      case 'today':
        return [startOfDay(now), endOfDay(now)];
      case 'yesterday': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        return [startOfDay(y), endOfDay(y)];
      }
      case '7days': {
        const d7 = new Date(now);
        d7.setDate(d7.getDate() - 7);
        return [startOfDay(d7), endOfDay(now)];
      }
      case '30days': {
        const d30 = new Date(now);
        d30.setDate(d30.getDate() - 30);
        return [startOfDay(d30), endOfDay(now)];
      }
      default:
        return null;
    }
  }

  // ─── FILTERED + PAGINATED DATA ───────────────────────────
  filteredLogs = computed(() => {
    let list = this.emailService.emails();
    const query = this.searchQuery().toLowerCase().trim();
    const typeFilter = this.selectedTypeFilter();
    const statusFilter = this.selectedStatusFilter();
    const dateRange = this.getDateRange(this.dateFilter());

    // Text search
    if (query) {
      const cleanQuery = removeAccents(query);
      list = list.filter(log =>
        removeAccents(log.toEmail).toLowerCase().includes(cleanQuery) ||
        removeAccents(log.recipientName).toLowerCase().includes(cleanQuery) ||
        removeAccents(log.subject).toLowerCase().includes(cleanQuery)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter(log => log.type === typeFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      list = list.filter(log => log.status === statusFilter);
    }

    // Date range filter
    if (dateRange) {
      const [start, end] = dateRange;
      list = list.filter(log => {
        const d = new Date(log.sentAt);
        return d >= start && d <= end;
      });
    }

    return list;
  });

  totalFilteredCount = computed(() => this.filteredLogs().length);
  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredLogs().length / this.pageSize())));

  paginatedLogs = computed(() => {
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.filteredLogs().slice(start, start + size);
  });

  // Page range for display
  displayStart = computed(() => {
    if (this.filteredLogs().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });
  displayEnd = computed(() => Math.min(this.currentPage() * this.pageSize(), this.filteredLogs().length));

  // Page number buttons
  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | '...')[] = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        pages.push(i);
      }
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  goToPage(page: number | '...') {
    if (page === '...') return;
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.selectedIds.set(new Set());
  }

  // ─── BULK SELECTION ──────────────────────────────────────
  isAllCurrentPageSelected = computed(() => {
    const currentPageLogs = this.paginatedLogs();
    if (currentPageLogs.length === 0) return false;
    return currentPageLogs.every(log => this.selectedIds().has(log.id));
  });

  toggleSelectAll() {
    const currentPageLogs = this.paginatedLogs();
    const current = new Set(this.selectedIds());
    if (this.isAllCurrentPageSelected()) {
      currentPageLogs.forEach(log => current.delete(log.id));
    } else {
      currentPageLogs.forEach(log => current.add(log.id));
    }
    this.selectedIds.set(current);
  }

  toggleSelect(id: string) {
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  deleteSelected() {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;
    if (!confirm(`Bạn có chắc chắn muốn xóa ${ids.length} email đã chọn?`)) return;
    this.emailService.deleteMultipleEmails(ids);
    this.selectedIds.set(new Set());
  }

  exportSelectedCSV() {
    const ids = this.selectedIds();
    const logs = ids.size > 0
      ? this.emailService.emails().filter(e => ids.has(e.id))
      : this.filteredLogs();

    if (logs.length === 0) {
      alert('Không có dữ liệu để xuất.');
      return;
    }

    const header = 'ID,Email,Tên KH,Tiêu đề,Loại,Trạng thái,Thời gian\n';
    const rows = logs.map(l =>
      `"${l.id}","${l.toEmail}","${l.recipientName}","${l.subject.replace(/"/g, '""')}","${this.getTypeLabel(l.type)}","${l.status}","${l.sentAt}"`
    ).join('\n');

    const csvContent = '\uFEFF' + header + rows; // BOM for Vietnamese chars
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `email_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // ─── AUTO-CLEANUP ────────────────────────────────────────
  saveCleanupDays() {
    localStorage.setItem('email_cleanup_days', this.cleanupDays().toString());
  }

  runAutoCleanup() {
    const days = this.cleanupDays();
    if (days <= 0) {
      this.emailService.loadEmails();
      return;
    }
    this.emailService.cleanUpEmails(days).subscribe({
      next: (res) => {
        if (res.deletedCount > 0) {
          this.cleanupMessage.set(`Đã tự động dọn dẹp ${res.deletedCount} email cũ hơn ${days} ngày.`);
          setTimeout(() => this.cleanupMessage.set(''), 8000);
        } else if (this.cleanupMessage()) {
          // Clear any manually set messages if cleanup was executed manually but nothing deleted
          this.cleanupMessage.set('');
        }
        this.emailService.loadEmails();
      },
      error: (err) => {
        console.error('Lỗi khi tự động dọn dẹp email:', err);
        this.emailService.loadEmails();
      }
    });
  }

  // ─── TEMPLATE MANAGEMENT (unchanged) ─────────────────────
  selectTemplate(tmpl: EmailTemplate) {
    this.selectedTemplate.set(tmpl);
    this.editSubject.set(tmpl.subject);
    this.editBody.set(tmpl.bodyTemplate);
  }

  saveTemplate() {
    if (!this.authService.hasPermission('EMAIL_MANAGE')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }
    const current = this.selectedTemplate();
    if (!current) return;

    const updatedTemplates = this.emailService.templates().map(t => {
      if (t.type === current.type) {
        return {
          ...t,
          subject: this.editSubject(),
          bodyTemplate: this.editBody()
        };
      }
      return t;
    });

    this.emailService.saveTemplates(updatedTemplates);
    alert('Đã cập nhật mẫu email thành công!');
  }

  // ─── MANUAL EMAIL (unchanged) ────────────────────────────
  openManualEmailModal() {
    this.manualToEmail.set('');
    this.manualRecipientName.set('');
    this.manualSubject.set('');
    this.manualContent.set('');
    this.isManualEmailModalOpen.set(true);
  }

  closeManualEmailModal() {
    this.isManualEmailModalOpen.set(false);
  }

  sendManualEmail() {
    if (!this.authService.hasPermission('EMAIL_MANAGE')) {
      alert('Bạn không có quyền thực hiện hành động này.');
      return;
    }

    const email = this.manualToEmail().trim();
    const name = this.manualRecipientName().trim();
    const subject = this.manualSubject().trim();
    const content = this.manualContent().trim();

    if (!email || !name || !subject || !content) {
      alert('Vui lòng nhập đầy đủ thông tin gửi email.');
      return;
    }

    const htmlContent = `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 35px 30px; text-align: center;">
    <div style="display: inline-block; width: 56px; height: 56px; background-color: rgba(197,168,128,0.2); border-radius: 50%; line-height: 56px; font-size: 28px; margin-bottom: 12px;">✉️</div>
    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700;">Sachweb Bookstore</h1>
    <div style="width: 50px; height: 3px; background: linear-gradient(90deg, #c5a880, #e8d5b7); margin: 12px auto; border-radius: 2px;"></div>
    <p style="color: #c5a880; margin: 0; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; font-weight: 600;">Thông báo từ hệ thống</p>
  </div>
  <div style="padding: 30px;">
    <p style="font-size: 15px; color: #334155; line-height: 1.6;">Thân gửi <strong style="color: #1a1a2e;">${name}</strong>,</p>
    <div style="line-height: 1.7; margin: 20px 0; color: #475569; font-size: 14px; padding: 20px; background-color: #faf9f6; border-radius: 10px; border: 1px solid rgba(197,168,128,0.2);">
      ${content.replace(/\n/g, '<br/>')}
    </div>
  </div>
  <div style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">Nếu có thắc mắc, liên hệ chúng tôi qua:</p>
    <p style="margin: 0 0 12px 0; font-size: 13px;">
      <span style="color: #c5a880; font-weight: 600;">📞 1900-XXXX</span>
      <span style="color: #cbd5e1; margin: 0 8px;">|</span>
      <span style="color: #c5a880; font-weight: 600;">✉️ support@sachweb.vn</span>
    </p>
    <div style="width: 40px; height: 2px; background-color: #e2e8f0; margin: 12px auto;"></div>
    <p style="margin: 0; font-size: 11px; color: #cbd5e1;">© 2026 Sachweb Bookstore. All rights reserved.</p>
  </div>
</div>
    `.trim();

    this.emailService.sendEmail(email, name, subject, htmlContent, 'MANUAL');
    this.closeManualEmailModal();
    alert('Email đã được đưa vào hàng đợi gửi thành công!');
  }

  // ─── HELPERS (unchanged) ─────────────────────────────────
  getTypeLabel(type: string): string {
    switch (type) {
      case 'ORDER_CONFIRMATION': return 'Xác nhận đơn hàng';
      case 'STATUS_UPDATE': return 'Cập nhật vận chuyển';
      case 'MANUAL': return 'Thư gửi thủ công';
      default: return type;
    }
  }

  getTypeBadgeClass(type: string): string {
    switch (type) {
      case 'ORDER_CONFIRMATION': return 'bg-info bg-opacity-10 text-info border border-info border-opacity-25';
      case 'STATUS_UPDATE': return 'bg-success bg-opacity-10 text-success border border-success border-opacity-25';
      case 'MANUAL': return 'bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25';
      default: return 'bg-secondary bg-opacity-10 text-secondary';
    }
  }

  formatDate(isoStr: string): string {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return isoStr;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
