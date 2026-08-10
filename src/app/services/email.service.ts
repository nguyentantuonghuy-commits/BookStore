import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export interface EmailLog {
  id: string;
  toEmail: string;
  recipientName: string;
  subject: string;
  htmlContent: string;
  type: 'ORDER_CONFIRMATION' | 'STATUS_UPDATE' | 'MANUAL';
  status: 'Thành công' | 'Thất bại';
  sentAt: string;
}

export interface EmailTemplate {
  type: string;
  name: string;
  subject: string;
  bodyTemplate: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:3000/emails';

  // Signals
  emails = signal<EmailLog[]>([]);
  latestDispatchedEmails = signal<EmailLog[]>([]);

  dismissEmailToast(id: string) {
    this.latestDispatchedEmails.update(list => list.filter(e => e.id !== id));
  }

  // Email Templates (saved in local storage to allow editing)
  templates = signal<EmailTemplate[]>([]);

  constructor() {
    this.loadEmails();
    this.loadTemplates();
  }

  loadEmails() {
    this.http.get<EmailLog[]>(this.apiUrl).subscribe({
      next: (data) => {
        // Sort newest first
        this.emails.set(data.sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
      },
      error: (err) => console.error('Lỗi khi tải nhật ký email:', err)
    });
  }

  private loadTemplates() {
    const stored = localStorage.getItem('email_templates');
    if (stored) {
      this.templates.set(JSON.parse(stored));
      return;
    }

    const defaultTemplates: EmailTemplate[] = [
      {
        type: 'ORDER_CONFIRMATION',
        name: 'Xác nhận Đơn hàng',
        subject: 'Xác nhận đơn hàng #{orderId} - Sachweb Bookstore',
        bodyTemplate: `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
  <!-- HEADER with gradient -->
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 35px 30px; text-align: center;">
    <div style="display: inline-block; width: 56px; height: 56px; background-color: rgba(197,168,128,0.2); border-radius: 50%; line-height: 56px; font-size: 28px; margin-bottom: 12px;">📦</div>
    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Sachweb Bookstore</h1>
    <div style="width: 50px; height: 3px; background: linear-gradient(90deg, #c5a880, #e8d5b7); margin: 12px auto; border-radius: 2px;"></div>
    <p style="color: #c5a880; margin: 0; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; font-weight: 600;">Xác nhận đơn hàng thành công</p>
  </div>

  <!-- BODY -->
  <div style="padding: 30px;">
    <!-- Greeting -->
    <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 8px 0;">Xin chào <strong style="color: #1a1a2e;">{customerName}</strong>,</p>
    <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">Cảm ơn bạn đã tin tưởng mua sắm tại Sachweb! Đơn hàng của bạn đã được tiếp nhận thành công. Dưới đây là thông tin chi tiết:</p>

    <!-- Order Info Card -->
    <div style="background: linear-gradient(135deg, #faf9f6 0%, #f5f0e8 100%); border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid rgba(197,168,128,0.25);">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #94a3b8; width: 140px; vertical-align: top;">🆔 Mã đơn hàng</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 700;">#{orderId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #94a3b8; vertical-align: top;">🕐 Thời gian đặt</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b;">{createdAt}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #94a3b8; vertical-align: top;">📍 Địa chỉ giao</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b;">{address}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-size: 13px; color: #94a3b8; vertical-align: top;">💳 Thanh toán</td>
          <td style="padding: 6px 0; font-size: 14px; color: #1e293b; font-weight: 600;">{paymentMethod}</td>
        </tr>
      </table>
    </div>

    <!-- Products Section -->
    <div style="margin-bottom: 24px;">
      <h3 style="font-size: 15px; color: #1a1a2e; margin: 0 0 14px 0; padding-bottom: 10px; border-bottom: 2px solid #f1f5f9; display: flex; align-items: center;">📚 Chi Tiết Sản Phẩm</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="padding: 12px 10px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; text-align: left; background-color: #f8fafc; border-radius: 6px 0 0 6px; font-weight: 600;">Tên sách</th>
            <th style="padding: 12px 10px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; text-align: center; background-color: #f8fafc; font-weight: 600;">SL</th>
            <th style="padding: 12px 10px; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 1px; text-align: right; background-color: #f8fafc; border-radius: 0 6px 6px 0; font-weight: 600;">Đơn giá</th>
          </tr>
        </thead>
        <tbody>
          {itemsTable}
        </tbody>
      </table>
    </div>

    <!-- Total Price -->
    <div style="background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 10px; padding: 18px 20px; text-align: right;">
      <span style="color: #c5a880; font-size: 13px; letter-spacing: 0.5px;">Tổng thanh toán</span>
      <div style="color: #ffffff; font-size: 24px; font-weight: 800; margin-top: 4px; letter-spacing: 0.5px;">{totalPrice}</div>
    </div>

    <!-- Status Banner -->
    <div style="text-align: center; margin: 24px 0 0 0; padding: 16px; background-color: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
      <span style="font-size: 22px;">✅</span>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #15803d; font-weight: 600;">Đơn hàng đang được xử lý — Chúng tôi sẽ giao sớm nhất có thể!</p>
    </div>
  </div>

  <!-- FOOTER -->
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
        `.trim()
      },
      {
        type: 'STATUS_UPDATE',
        name: 'Cập nhật Vận chuyển',
        subject: 'Cập nhật trạng thái đơn hàng #{orderId} - {newStatus}',
        bodyTemplate: `
<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
  <!-- HEADER with gradient -->
  <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%); padding: 35px 30px; text-align: center;">
    <div style="display: inline-block; width: 56px; height: 56px; background-color: rgba(197,168,128,0.2); border-radius: 50%; line-height: 56px; font-size: 28px; margin-bottom: 12px;">🚚</div>
    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Sachweb Bookstore</h1>
    <div style="width: 50px; height: 3px; background: linear-gradient(90deg, #c5a880, #e8d5b7); margin: 12px auto; border-radius: 2px;"></div>
    <p style="color: #c5a880; margin: 0; font-size: 13px; letter-spacing: 3px; text-transform: uppercase; font-weight: 600;">Cập nhật vận chuyển đơn hàng</p>
  </div>

  <!-- BODY -->
  <div style="padding: 30px;">
    <!-- Greeting -->
    <p style="font-size: 15px; color: #334155; line-height: 1.6; margin: 0 0 8px 0;">Xin chào <strong style="color: #1a1a2e;">{customerName}</strong>,</p>
    <p style="font-size: 14px; color: #64748b; line-height: 1.6; margin: 0 0 24px 0;">Sachweb xin thông báo đơn hàng <strong style="color: #1a1a2e;">#{orderId}</strong> của bạn vừa có cập nhật trạng thái mới nhất:</p>

    <!-- Status Highlight Card -->
    <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 28px 20px; margin-bottom: 24px; text-align: center; border: 1px solid #a7f3d0;">
      <div style="font-size: 40px; margin-bottom: 8px;">🎯</div>
      <p style="margin: 0 0 6px 0; font-size: 12px; color: #059669; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">Trạng thái đơn hàng</p>
      <h2 style="margin: 0; color: #047857; font-size: 26px; font-weight: 800; letter-spacing: 0.5px;">{newStatus}</h2>
    </div>

    <!-- Visual Tracking Timeline -->
    <div style="margin-bottom: 24px; padding: 20px; background-color: #faf9f6; border-radius: 10px; border: 1px solid rgba(197,168,128,0.2);">
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">📋 THEO DÕI HÀNH TRÌNH</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 30px; vertical-align: top; padding: 0;">
            <div style="width: 24px; height: 24px; background-color: #c5a880; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; color: white; font-weight: bold;">✓</div>
            <div style="width: 2px; height: 20px; background-color: #c5a880; margin: 4px auto;"></div>
          </td>
          <td style="padding: 0 0 12px 10px; font-size: 13px; color: #1e293b; vertical-align: top;">
            <strong>Đặt hàng thành công</strong><br/>
            <span style="font-size: 11px; color: #94a3b8;">Đơn hàng #{orderId} đã được tiếp nhận</span>
          </td>
        </tr>
        <tr>
          <td style="width: 30px; vertical-align: top; padding: 0;">
            <div style="width: 24px; height: 24px; background-color: #c5a880; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; color: white; font-weight: bold;">✓</div>
            <div style="width: 2px; height: 20px; background-color: #c5a880; margin: 4px auto;"></div>
          </td>
          <td style="padding: 0 0 12px 10px; font-size: 13px; color: #1e293b; vertical-align: top;">
            <strong>Đang xử lý</strong><br/>
            <span style="font-size: 11px; color: #94a3b8;">Kho đang chuẩn bị hàng cho bạn</span>
          </td>
        </tr>
        <tr>
          <td style="width: 30px; vertical-align: top; padding: 0;">
            <div style="width: 24px; height: 24px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 50%; text-align: center; line-height: 24px; font-size: 14px; color: white; font-weight: bold; box-shadow: 0 2px 8px rgba(5,150,105,0.3);">★</div>
          </td>
          <td style="padding: 0 0 0 10px; font-size: 13px; color: #059669; vertical-align: top; font-weight: 700;">
            {newStatus}<br/>
            <span style="font-size: 11px; color: #94a3b8; font-weight: 400;">Trạng thái hiện tại của đơn hàng</span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Delivery Info Card -->
    <div style="border-radius: 10px; padding: 20px; margin-bottom: 24px; border: 1px solid #e2e8f0; background-color: #ffffff;">
      <p style="margin: 0 0 14px 0; font-size: 13px; color: #64748b; font-weight: 600; letter-spacing: 0.5px;">📬 THÔNG TIN GIAO HÀNG</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #94a3b8; width: 120px;">Người nhận</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1e293b; font-weight: 600;">{customerName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9;">Số điện thoại</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1e293b; border-top: 1px solid #f1f5f9;">{phone}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #94a3b8; border-top: 1px solid #f1f5f9;">Địa chỉ</td>
          <td style="padding: 8px 0; font-size: 14px; color: #1e293b; border-top: 1px solid #f1f5f9;">{address}</td>
        </tr>
      </table>
    </div>

    <!-- CTA Note -->
    <div style="text-align: center; padding: 16px; background-color: #eff6ff; border-radius: 8px; border: 1px solid #bfdbfe;">
      <span style="font-size: 18px;">💡</span>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #1d4ed8;">Bạn có thể theo dõi chi tiết trong mục <strong>Lịch sử mua hàng</strong> trên tài khoản Sachweb.</p>
    </div>
  </div>

  <!-- FOOTER -->
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
        `.trim()
      }
    ];

    // Clear old cached templates so users get the fresh premium design
    localStorage.removeItem('email_templates');
    this.templates.set(defaultTemplates);
    localStorage.setItem('email_templates', JSON.stringify(defaultTemplates));
  }

  saveTemplates(updated: EmailTemplate[]) {
    this.templates.set(updated);
    localStorage.setItem('email_templates', JSON.stringify(updated));
  }

  deleteEmail(id: string) {
    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.emails.update((list) => list.filter(e => e.id !== id));
      },
      error: (err) => console.error('Lỗi khi xóa email:', err)
    });
  }

  deleteMultipleEmails(ids: string[]) {
    this.http.post<{ success: boolean; deletedCount: number }>('http://localhost:3000/api/emails/bulk-delete', { ids }).subscribe({
      next: () => {
        this.emails.update((list) => list.filter(e => !ids.includes(e.id)));
      },
      error: (err) => console.error('Lỗi khi xóa nhiều email:', err)
    });
  }

  cleanUpEmails(days: number) {
    return this.http.post<{ success: boolean; deletedCount: number }>('http://localhost:3000/api/emails/clean-up', { days });
  }

  private getLocalISOString(): string {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }

  sendEmail(toEmail: string, recipientName: string, subject: string, htmlContent: string, type: 'ORDER_CONFIRMATION' | 'STATUS_UPDATE' | 'MANUAL') {
    const newLog: Omit<EmailLog, 'id'> = {
      toEmail,
      recipientName,
      subject,
      htmlContent,
      type,
      status: 'Thành công',
      sentAt: this.getLocalISOString()
    };

    this.http.post<EmailLog>(this.apiUrl, newLog).subscribe({
      next: (res) => {
        // Prepend to signal list
        this.emails.update((list) => [res, ...list]);
        // Trigger simulated notifications popup (multiple concurrent toasts)
        this.latestDispatchedEmails.update((list) => [...list, res]);

        // Auto dismiss this specific toast after 3 seconds
        setTimeout(() => {
          this.dismissEmailToast(res.id);
        }, 3000);
      },
      error: (err) => {
        console.error('Lỗi khi gửi email:', err);
        // Failover simulation log
        const failLog: EmailLog = {
          id: 'email_fail_' + Date.now(),
          ...newLog,
          status: 'Thất bại',
          sentAt: this.getLocalISOString()
        };
        this.emails.update((list) => [failLog, ...list]);
        
        // Trigger simulated notifications popup for failed mail too
        this.latestDispatchedEmails.update((list) => [...list, failLog]);
        setTimeout(() => {
          this.dismissEmailToast(failLog.id);
        }, 3000);
      }
    });
  }

  // Generate confirmation email HTML dynamically
  triggerOrderConfirmation(order: any, customerInfo: any) {
    const template = this.templates().find(t => t.type === 'ORDER_CONFIRMATION');
    if (!template) return;

    let subject = template.subject.replace('{orderId}', order.id);
    let html = template.bodyTemplate
      .replace('{customerName}', customerInfo?.fullname || 'Quý khách')
      .replace('{orderId}', order.id)
      .replace('{createdAt}', order.createdAt || this.getLocalISOString())
      .replace('{address}', order.address || 'Tại quầy / Địa chỉ mặc định')
      .replace('{paymentMethod}', order.paymentMethod === 'BANK_TRANSFER' ? 'Chuyển khoản Ngân hàng (VietQR)' : 'Thanh toán COD (Khi nhận hàng)')
      .replace('{totalPrice}', (order.total || 0).toLocaleString('vi-VN') + ' đ');

    // Build items table
    let itemsTable = '';
    const items = order.items || [];
    items.forEach((item: any) => {
      itemsTable += `
        <tr>
          <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; line-height: 1.4;">${item.title}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 13px; color: #475569; font-weight: 600;">${item.quantity}</td>
          <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 13px; color: #1e293b; font-weight: 600;">${(item.price || 0).toLocaleString('vi-VN')} đ</td>
        </tr>
      `;
    });
    html = html.replace('{itemsTable}', itemsTable);

    const email = customerInfo?.email || 'customer@gmail.com';
    this.sendEmail(email, customerInfo?.fullname || 'Khách hàng', subject, html, 'ORDER_CONFIRMATION');
  }

  // Generate status update email HTML dynamically
  triggerOrderStatusUpdate(order: any, customerInfo: any, newStatus: string) {
    const template = this.templates().find(t => t.type === 'STATUS_UPDATE');
    if (!template) return;

    let subject = template.subject.replace('{orderId}', order.id).replace('{newStatus}', newStatus);
    let html = template.bodyTemplate
      .replace(/{customerName}/g, customerInfo?.fullname || 'Quý khách')
      .replace(/{orderId}/g, order.id)
      .replace('{newStatus}', newStatus)
      .replace('{phone}', order.phone || customerInfo?.phone || 'Chưa cung cấp')
      .replace('{address}', order.address || customerInfo?.address || 'Chưa cung cấp');

    const email = customerInfo?.email || 'customer@gmail.com';
    this.sendEmail(email, customerInfo?.fullname || 'Khách hàng', subject, html, 'STATUS_UPDATE');
  }
}
