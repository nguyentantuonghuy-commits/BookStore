import { Component, inject, signal, computed, ElementRef, ViewChild, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatSession, ChatMessage } from '../../../services/chat.service';
import { AuthService } from '../../../services/auth.service';
import { removeAccents } from '../../../utils/string-utils';

@Component({
  selector: 'app-chat-manage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-manage.html',
  styleUrl: './chat-manage.css'
})
export class ChatManageComponent {
  chatService = inject(ChatService);
  authService = inject(AuthService);

  @ViewChild('chatMessagesBody') chatMessagesBody!: ElementRef;

  activeFilter = signal<'all' | 'live' | 'ai' | 'unread' | 'active' | 'closed'>('all');
  searchQuery = signal<string>('');
  selectedSessionId = signal<string | null>(null);
  replyText: string = '';

  currentUser = computed(() => this.authService.currentUser());

  // Permissions checking based on currentUser permissions array or super admin role
  canReply = computed(() => {
    const u = this.currentUser();
    if (!u) return false;
    const adminRoles = ['admin', 'manager', 'sales', 'editor', 'customer_care', 'user'];
    if (adminRoles.includes(u.role)) return true;
    return u.permissions?.includes('CHAT_REPLY') ?? false;
  });

  canManage = computed(() => {
    const u = this.currentUser();
    if (!u) return false;
    const adminRoles = ['admin', 'manager', 'sales', 'editor', 'customer_care', 'user'];
    if (adminRoles.includes(u.role)) return true;
    return u.permissions?.includes('CHAT_MANAGE') ?? false;
  });

  // Filtered Sessions List
  filteredSessions = computed(() => {
    const sessions = this.chatService.sessions();
    const filter = this.activeFilter();
    const rawQuery = (this.searchQuery() || '').trim();
    const queryNormalized = removeAccents(rawQuery.toLowerCase());
    const queryWords = queryNormalized.split(/\s+/).filter(w => w.length > 0);

    return sessions.filter((s) => {
      // Filter tab
      if (filter === 'unread' && (!s.unreadCountAdmin || s.unreadCountAdmin <= 0)) return false;
      if (filter === 'live' && s.chatMode !== 'live') return false;
      if (filter === 'ai' && s.chatMode === 'live') return false;
      if (filter === 'active' && s.status !== 'active') return false;
      if (filter === 'closed' && s.status !== 'closed') return false;

      // Search query
      if (queryWords.length > 0) {
        const nameNorm = removeAccents((s.userName || '').toLowerCase());
        const emailNorm = removeAccents((s.userEmail || '').toLowerCase());
        const idNorm = removeAccents((s.id || '').toLowerCase());
        const userIdNorm = removeAccents((s.userId || '').toLowerCase());
        const msgNorm = removeAccents((s.lastMessage || '').toLowerCase());

        const fullText = `${nameNorm} ${emailNorm} ${idNorm} ${userIdNorm} ${msgNorm}`;
        const match = queryWords.every(word => fullText.includes(word));
        if (!match) return false;
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.lastMessageTime ? new Date(a.lastMessageTime).getTime() : 0;
      const timeB = b.lastMessageTime ? new Date(b.lastMessageTime).getTime() : 0;
      return timeB - timeA;
    });
  });

  // Selected Session
  selectedSession = computed(() => {
    const id = this.selectedSessionId();
    if (!id) return null;
    return this.chatService.sessions().find((s) => s.id === id) || null;
  });

  // Messages for selected session
  sessionMessages = computed(() => {
    const id = this.selectedSessionId();
    if (!id) return [];
    return this.chatService.messages().filter((m) => m.sessionId === id);
  });

  // Stats Counters
  stats = computed(() => {
    const sessions = this.chatService.sessions();
    return {
      total: sessions.length,
      unread: sessions.filter((s) => (s.unreadCountAdmin || 0) > 0).length,
      active: sessions.filter((s) => s.status === 'active').length,
      closed: sessions.filter((s) => s.status === 'closed').length
    };
  });

  quickTemplates = [
    'Dạ chào anh/chị, em là tư vấn viên Sachweb! Em có thể hỗ trợ gì cho mình ạ?',
    'Đơn hàng của anh/chị đã được bàn giao cho đơn vị vận chuyển, dự kiến giao trong 1-2 ngày tới.',
    'Sachweb gửi tặng anh/chị mã giảm giá 10% áp dụng cho đơn hàng tiếp theo ạ.',
    'Dạ thông tin này bên em đã ghi nhận và chuyển cho bộ phận chuyên trách xử lý.',
    'Cảm ơn anh/chị đã liên hệ Sachweb! Chúc anh/chị một ngày đọc sách thật nhiều niềm vui!'
  ];

  constructor() {
    // Auto-select first session if none selected, without creating signal mutation loops
    effect(() => {
      const list = this.filteredSessions();
      const current = untracked(() => this.selectedSessionId());
      if (!current && list.length > 0) {
        untracked(() => {
          this.selectedSessionId.set(list[0].id);
          this.chatService.markAsReadByAdmin(list[0].id);
        });
      }
    });

    // Auto-scroll when messages update
    effect(() => {
      const msgs = this.sessionMessages();
      if (msgs.length > 0) {
        setTimeout(() => this.scrollToBottom(), 100);
      }
    });
  }

  getAvatarUrl(url?: string, name?: string): string {
    if (url && typeof url === 'string' && url.trim().length > 0) {
      if (!url.includes('customer1.jpg') && !url.includes('default-avatar.png') && !url.includes('undefined')) {
        return url;
      }
    }
    if (name && (name.toLowerCase().includes('admin') || name.toLowerCase().includes('cskh'))) {
      return '/image/danhmuc3.png';
    }
    if (name && name.toLowerCase().includes('nguyễn văn an')) {
      return '/image/commentor-item1.jpg';
    }
    return '/image/avatar.jpg';
  }

  onAvatarError(event: Event, fallbackName?: string) {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.onerror = null;
      img.src = this.getAvatarUrl(undefined, fallbackName);
    }
  }

  selectSession(sessionId: string) {
    this.selectedSessionId.set(sessionId);
    this.chatService.markAsReadByAdmin(sessionId);
    setTimeout(() => this.scrollToBottom(), 100);
  }

  sendReply(textOverride?: string) {
    const text = textOverride || this.replyText;
    if (!text || !text.trim()) return;
    if (!this.canReply()) {
      alert('Tài khoản của bạn không có quyền gửi tin nhắn phản hồi (CHAT_REPLY).');
      return;
    }

    const session = this.selectedSession();
    if (!session) return;

    const user = this.currentUser();
    const adminName = user ? (user.fullname || user.username) : 'Admin CSKH';
    const adminAvatar = this.getAvatarUrl(user?.avatar, adminName);

    this.chatService.sendMessage(session.id, text, 'admin', adminName, adminAvatar);
    this.replyText = '';
    setTimeout(() => this.scrollToBottom(), 100);
  }

  insertTemplate(tmpl: string) {
    this.replyText = tmpl;
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendReply();
    }
  }

  toggleSessionStatus() {
    if (!this.canManage()) {
      alert('Tài khoản của bạn không có quyền quản lý phiên chat (CHAT_MANAGE).');
      return;
    }
    const session = this.selectedSession();
    if (!session) return;

    if (session.status === 'active') {
      this.chatService.closeSession(session.id);
    } else {
      this.chatService.reopenSession(session.id);
    }
  }

  deleteCurrentSession() {
    if (!this.canManage()) {
      alert('Tài khoản của bạn không có quyền xóa phiên chat (CHAT_MANAGE).');
      return;
    }
    const session = this.selectedSession();
    if (!session) return;

    if (confirm(`Bạn có chắc chắn muốn xóa hội thoại với "${session.userName}" không?`)) {
      this.chatService.deleteSession(session.id);
      this.selectedSessionId.set(null);
    }
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  private scrollToBottom() {
    if (this.chatMessagesBody) {
      try {
        const el = this.chatMessagesBody.nativeElement;
        el.scrollTop = el.scrollHeight;
      } catch (err) {}
    }
  }
}
