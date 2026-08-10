import { Component, inject, signal, computed, ElementRef, ViewChild, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage, ChatSession } from '../../services/chat.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-widget.html',
  styleUrl: './chat-widget.css'
})
export class ChatWidgetComponent {
  chatService = inject(ChatService);
  authService = inject(AuthService);

  @ViewChild('messagesContainer') messagesContainer!: ElementRef;

  inputText: string = '';
  currentSession = signal<ChatSession | null>(null);
  currentMode = computed(() => this.currentSession()?.chatMode || 'ai');

  setMode(mode: 'ai' | 'live') {
    const session = this.currentSession();
    if (session) {
      this.chatService.switchChatMode(session.id, mode);
    }
  }

  isOpen = computed(() => this.chatService.isOpenWidget());

  isBotTyping = computed(() => this.chatService.isBotTyping());

  quickPrompts = [
    '📖 Tư vấn chọn sách hay',
    '📦 Tra cứu đơn hàng gần đây',
    '🚚 Phí giao hàng & Freeship',
    '🎁 Mã giảm giá mới nhất',
    '💳 Phương thức thanh toán',
    '🏬 Địa chỉ & Giờ mở cửa',
    '🔄 Chính sách đổi trả 7 ngày',
    '👨‍💼 Live Chat với Admin CSKH'
  ];

  suggestedChips = computed(() => {
    const chips = this.currentSession()?.suggestedChips;
    if (chips && chips.length > 0) {
      const merged = Array.from(new Set([...chips, ...this.quickPrompts]));
      return merged.slice(0, 8);
    }
    return this.quickPrompts;
  });

  messages = computed(() => {
    const session = this.currentSession();
    if (!session) return [];
    return this.chatService.messages().filter((m) => m.sessionId === session.id);
  });

  unreadUserCount = computed(() => {
    const session = this.currentSession();
    return session ? session.unreadCountUser || 0 : 0;
  });

  constructor() {
    // Keep currentSession updated safely via effect
    effect(() => {
      const user = this.authService.currentUser();
      const allSessions = this.chatService.sessions();
      const activeSession = this.chatService.getOrCreateUserSession(user);

      untracked(() => {
        const cur = this.currentSession();
        const foundLatest = allSessions.find((s) => s.id === activeSession.id) || activeSession;
        if (!cur || cur.id !== foundLatest.id || JSON.stringify(cur) !== JSON.stringify(foundLatest)) {
          this.currentSession.set(foundLatest);
        }
      });
    });

    // Auto-scroll to bottom when messages update or widget opens
    effect(() => {
      const msgs = this.messages();
      const open = this.isOpen();
      if (open && msgs.length > 0) {
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
    return '/image/avatar.jpg';
  }

  onAvatarError(event: Event, fallbackName?: string) {
    const img = event.target as HTMLImageElement;
    if (img) {
      img.onerror = null;
      img.src = this.getAvatarUrl(undefined, fallbackName);
    }
  }

  toggleChat() {
    const open = !this.isOpen();
    this.chatService.toggleWidget(open);
    if (open) {
      const session = this.currentSession();
      if (session) {
        this.chatService.markAsReadByUser(session.id);
      }
      setTimeout(() => this.scrollToBottom(), 150);
    }
  }

  sendMessage(customText?: string) {
    const textToSend = customText || this.inputText;
    if (!textToSend || !textToSend.trim()) return;

    const user = this.authService.currentUser();
    const session = this.currentSession() || this.chatService.getOrCreateUserSession(user);

    const senderName = user ? (user.fullname || user.username) : 'Khách hàng';
    const senderAvatar = this.getAvatarUrl(user?.avatar, senderName);

    this.chatService.sendMessage(session.id, textToSend, 'user', senderName, senderAvatar);
    this.inputText = '';
    setTimeout(() => this.scrollToBottom(), 100);
  }

  handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendQuickPrompt(promptText: string) {
    this.sendMessage(promptText);
  }

  private scrollToBottom() {
    if (this.messagesContainer) {
      try {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      } catch (err) {}
    }
  }

  formatTime(isoString: string): string {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
}
