import { Injectable, inject, signal, computed } from '@angular/core';
import { StorageService } from './storage.service';
import { HttpClient } from '@angular/common/http';

export interface ContactMessage {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  adminNote: string;
  repliedContent: string;
  repliedAt: string;
  repliedBy: string;
  createdAt: string;
  readAt: string;
}

export const DEFAULT_CONTACT_MESSAGES: ContactMessage[] = [
  {
    id: 'ct1',
    fullName: 'Nguyễn Văn Minh',
    email: 'minhnguyen@gmail.com',
    phone: '0901234567',
    subject: 'Hỗ trợ đơn hàng / Đổi trả',
    message: 'Tôi đã đặt đơn hàng #DH0012 từ ngày 25/06 nhưng đến nay vẫn chưa nhận được sách. Xin hỗ trợ kiểm tra giúp tôi.',
    status: 'new',
    priority: 'high',
    adminNote: '',
    repliedContent: '',
    repliedAt: '',
    repliedBy: '',
    createdAt: '03/07/2026 08:30',
    readAt: ''
  },
  {
    id: 'ct2',
    fullName: 'Trần Thị Hoa',
    email: 'hoatran@gmail.com',
    phone: '0912345678',
    subject: 'Góp ý dịch vụ',
    message: 'Tôi rất thích dịch vụ giao hàng nhanh của Sachweb. Tuy nhiên, tôi mong muốn có thêm chương trình ưu đãi cho khách hàng thân thiết. Cảm ơn đội ngũ Sachweb!',
    status: 'read',
    priority: 'normal',
    adminNote: 'Khách hàng VIP, cần chuyển tiếp cho bộ phận Marketing',
    repliedContent: '',
    repliedAt: '',
    repliedBy: '',
    createdAt: '02/07/2026 14:15',
    readAt: '02/07/2026 16:30'
  },
  {
    id: 'ct3',
    fullName: 'Lê Hoàng Nam',
    email: 'namle@outlook.com',
    phone: '0987654321',
    subject: 'Hợp tác kinh doanh / Phát hành sách',
    message: 'Chào đội ngũ Sachweb, tôi là đại diện NXB Tân Việt. Chúng tôi muốn hợp tác phát hành bộ sách Lịch sử Việt Nam qua nền tảng Sachweb. Xin liên hệ lại qua email để thảo luận chi tiết.',
    status: 'replied',
    priority: 'urgent',
    adminNote: 'Đã chuyển tiếp cho Giám đốc kinh doanh xử lý',
    repliedContent: 'Chào anh Nam, cảm ơn anh đã quan tâm đến Sachweb. Chúng tôi rất vui được hợp tác với NXB Tân Việt. Bộ phận kinh doanh sẽ liên hệ trực tiếp qua email trong ngày hôm nay. Trân trọng!',
    repliedAt: '01/07/2026 10:00',
    repliedBy: 'Admin',
    createdAt: '30/06/2026 09:45',
    readAt: '30/06/2026 11:00'
  },
  {
    id: 'ct4',
    fullName: 'Phạm Quốc Bảo',
    email: 'baopham@yahoo.com',
    phone: '',
    subject: 'Báo cáo lỗi kỹ thuật website',
    message: 'Khi tôi truy cập trang thanh toán trên điện thoại, giao diện bị lệch và không thể bấm nút "Đặt hàng". Trình duyệt Safari trên iPhone 14.',
    status: 'new',
    priority: 'high',
    adminNote: '',
    repliedContent: '',
    repliedAt: '',
    repliedBy: '',
    createdAt: '03/07/2026 10:20',
    readAt: ''
  },
  {
    id: 'ct5',
    fullName: 'Vũ Thị Lan Anh',
    email: 'lananh.vu@gmail.com',
    phone: '0938765432',
    subject: 'Yêu cầu khác',
    message: 'Tôi muốn hỏi Sachweb có nhận đặt số lượng lớn (100+ cuốn) để tặng cho chương trình từ thiện không? Nếu có, xin cho biết mức chiết khấu.',
    status: 'archived',
    priority: 'normal',
    adminNote: 'Đã xử lý xong - Khách đã được báo giá và chốt đơn.',
    repliedContent: 'Chào chị Lan Anh, Sachweb rất vinh dự được đồng hành cùng chương trình từ thiện của chị. Chúng tôi áp dụng chiết khấu 25% cho đơn hàng từ 100 cuốn trở lên. Chi tiết xin liên hệ hotline 090 123 4567.',
    repliedAt: '28/06/2026 15:30',
    repliedBy: 'Admin',
    createdAt: '27/06/2026 11:00',
    readAt: '27/06/2026 13:00'
  }
];

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private storageService = inject(StorageService);
  private http = inject(HttpClient);
  private storageKey = 'contact_messages';

  messages = signal<ContactMessage[]>([]);

  sendReplyEmail(email: string, fullName: string, subject: string, originalMessage: string, replyContent: string) {
    return this.http.post<any>('http://localhost:3000/api/send-reply', {
      email,
      fullName,
      subject,
      originalMessage,
      replyContent
    });
  }

  // Thống kê
  totalMessages = computed(() => this.messages().length);
  newCount = computed(() => this.messages().filter(m => m.status === 'new').length);
  readCount = computed(() => this.messages().filter(m => m.status === 'read').length);
  repliedCount = computed(() => this.messages().filter(m => m.status === 'replied').length);
  archivedCount = computed(() => this.messages().filter(m => m.status === 'archived').length);
  urgentCount = computed(() => this.messages().filter(m => m.priority === 'urgent' || m.priority === 'high').length);

  constructor() {
    this.loadData();
  }

  private loadData() {
    const data = this.storageService.getOrCreate<ContactMessage[]>(this.storageKey, DEFAULT_CONTACT_MESSAGES);
    this.messages.set(data);
  }

  private saveData() {
    this.storageService.set(this.storageKey, this.messages());
  }

  // Tạo mới liên hệ
  createMessage(msg: Omit<ContactMessage, 'id' | 'status' | 'priority' | 'adminNote' | 'repliedContent' | 'repliedAt' | 'repliedBy' | 'readAt'>): void {
    // Bảng ưu tiên của liên hệ
    const priorityMap: Record<string, 'low' | 'normal' | 'high' | 'urgent'> = {
      // Các vấn đề thông thường
      'Góp ý dịch vụ': 'normal',
      'Góp ý chất lượng dịch vụ & CSKH': 'low',
      'Đóng góp ý kiến về chất lượng sách': 'low',
      'Hỏi đáp chương trình khuyến mãi / Voucher': 'low',
      'Yêu cầu khác': 'normal',

      // Các vấn đề kinh doanh
      'Hợp tác kinh doanh / Phát hành sách': 'normal',
      'Hợp tác kinh doanh & Quảng cáo': 'normal',
      'Yêu cầu mua sỉ / Số lượng lớn': 'normal',
      'Yêu cầu xuất hóa đơn đỏ (VAT)': 'normal',

      // Các vấn đề khẩn cấp
      'Hỗ trợ đơn hàng / Đổi trả': 'high',
      'Hỗ trợ tài khoản đăng nhập / Khóa tài khoản': 'high',
      'Yêu cầu đổi trả / Hoàn tiền đơn hàng': 'high',
      'Báo cáo lỗi kỹ thuật website': 'high',
      'Báo cáo lỗi / Sự cố bảo mật': 'urgent'
    };

    const detectedPriority = priorityMap[msg.subject] || 'normal';

    const newMsg: ContactMessage = {
      ...msg,
      id: 'ct' + Date.now(),
      status: 'new',
      priority: detectedPriority,
      adminNote: '',
      repliedContent: '',
      repliedAt: '',
      repliedBy: '',
      readAt: ''
    };
    this.messages.update(list => [newMsg, ...list]);
    this.saveData();
  }

  // Cập nhật trạng thái là đã đọc
  markAsRead(id: string): void {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.messages.update(list => list.map(m => m.id === id ? { ...m, status: m.status === 'new' ? 'read' : m.status, readAt: m.readAt || dateStr } as ContactMessage : m));
    this.saveData();
  }

  // Trả lời liên hệ
  replyMessage(id: string, replyContent: string, repliedBy: string): void {
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    this.messages.update(list => list.map(m => m.id === id ? {
      ...m,
      status: 'replied' as const,
      repliedContent: replyContent,
      repliedAt: dateStr,
      repliedBy: repliedBy,
      readAt: m.readAt || dateStr
    } : m));
    this.saveData();
  }

  // Cập nhật ghi chú (admin)
  updateAdminNote(id: string, note: string): void {
    this.messages.update(list => list.map(m => m.id === id ? { ...m, adminNote: note } : m));
    this.saveData();
  }

  // Cập nhật mức độ ưu tiên
  updatePriority(id: string, priority: 'low' | 'normal' | 'high' | 'urgent'): void {
    this.messages.update(list => list.map(m => m.id === id ? { ...m, priority } : m));
    this.saveData();
  }

  // Lưu trữ liên hệ
  archiveMessage(id: string): void {
    this.messages.update(list => list.map(m => m.id === id ? { ...m, status: 'archived' as const } : m));
    this.saveData();
  }

  // Xóa liên hệ
  deleteMessage(id: string): void {
    this.messages.update(list => list.filter(m => m.id !== id));
    this.saveData();
  }

  // Xóa tất cả liên hệ
  resetToDefault(): void {
    this.messages.set([...DEFAULT_CONTACT_MESSAGES]);
    this.saveData();
  }
}
