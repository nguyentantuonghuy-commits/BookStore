import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ContactService } from '../../services/contact.service';

interface ContactForm {
  fullName: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './contact.html',
  styleUrl: './contact.css'
})
export class ContactComponent {
  private contactService = inject(ContactService);

  // Form Model
  form = signal<ContactForm>({
    fullName: '',
    email: '',
    phone: '',
    subject: 'Góp ý dịch vụ',
    message: ''
  });

  // State Signals
  isSubmitting = signal<boolean>(false);

  // Notification State
  notification = signal<{ message: string; type: 'success' | 'danger' | null }>({
    message: '',
    type: null
  });

  subjects = [
    'Góp ý dịch vụ',
    'Góp ý chất lượng dịch vụ & CSKH',
    'Đóng góp ý kiến về chất lượng sách',
    'Hỏi đáp chương trình khuyến mãi / Voucher',
    'Hợp tác kinh doanh / Phát hành sách',
    'Hợp tác kinh doanh & Quảng cáo',
    'Yêu cầu mua sỉ / Số lượng lớn',
    'Yêu cầu xuất hóa đơn đỏ (VAT)',
    'Hỗ trợ tài khoản đăng nhập / Khóa tài khoản',
    'Hỗ trợ đơn hàng / Đổi trả',
    'Yêu cầu đổi trả / Hoàn tiền đơn hàng',
    'Báo cáo lỗi kỹ thuật website',
    'Báo cáo lỗi / Sự cố bảo mật',
    'Yêu cầu khác'
  ];

  submitForm() {
    const data = this.form();
    if (!data.fullName || !data.email || !data.message) {
      this.showToast('Vui lòng điền đầy đủ các thông tin bắt buộc (*)', 'danger');
      return;
    }

    this.isSubmitting.set(true);

    // Format current date
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Save to ContactService (persisted for admin to view)
    setTimeout(() => {
      this.contactService.createMessage({
        fullName: data.fullName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        subject: data.subject,
        message: data.message.trim(),
        createdAt: dateStr
      });

      this.isSubmitting.set(false);
      this.showToast('Gửi lời nhắn thành công! Chúng tôi sẽ phản hồi trong vòng 24 giờ.', 'success');

      // Reset Form
      this.form.set({
        fullName: '',
        email: '',
        phone: '',
        subject: 'Góp ý dịch vụ',
        message: ''
      });
    }, 1200);
  }

  showToast(message: string, type: 'success' | 'danger') {
    this.notification.set({ message, type });
    setTimeout(() => {
      this.notification.set({ message: '', type: null });
    }, 4000);
  }
}

