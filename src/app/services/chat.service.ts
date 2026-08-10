import { Injectable, signal, computed, inject } from '@angular/core';
import { StorageService } from './storage.service';
import { AuthService } from './auth.service';
import { BotEngineService } from './bot-engine.service';

export interface ChatMessage {
  id: string;
  sessionId: string;
  sender: 'user' | 'admin' | 'system';
  senderName: string;
  senderAvatar?: string;
  text: string;
  timestamp: string;
  isRead: boolean;
}

export interface ChatSession {
  id: string;
  userId?: string;
  userName: string;
  userEmail?: string;
  userAvatar?: string;
  isGuest: boolean;
  status: 'active' | 'closed';
  chatMode: 'ai' | 'live';
  lastMessage: string;
  lastMessageTime: string;
  unreadCountAdmin: number;
  unreadCountUser: number;
  assignedAdminName?: string;
  createdAt: string;
  updatedAt: string;
  isBotActive?: boolean;
  suggestedChips?: string[];
}

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session_demo_01',
    userId: 'cus1',
    userName: 'Nguyễn Văn An',
    userEmail: 'an.nguyen@gmail.com',
    userAvatar: '/image/commentor-item1.jpg',
    isGuest: false,
    status: 'active',
    chatMode: 'live',
    lastMessage: 'Dạ shop ơi, em muốn hỏi thời gian giao hàng sách Vua chúa Việt tới Đà Nẵng ạ?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    unreadCountAdmin: 1,
    unreadCountUser: 0,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  }
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg_demo_01',
    sessionId: 'session_demo_01',
    sender: 'system',
    senderName: 'Sachweb Bot',
    text: 'Chào mừng bạn đến với Sachweb.vn! Vui lòng gửi thắc mắc của bạn, đội ngũ hỗ trợ sẽ phản hồi trong giây lát.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    isRead: true
  },
  {
    id: 'msg_demo_02',
    sessionId: 'session_demo_01',
    sender: 'user',
    senderName: 'Nguyễn Văn An',
    senderAvatar: '/image/customer1.jpg',
    text: 'Dạ shop ơi, em muốn hỏi thời gian giao hàng sách Vua chúa Việt tới Đà Nẵng ạ?',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    isRead: false
  }
];

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private storageService = inject(StorageService);
  private authService = inject(AuthService);
  private botEngine = inject(BotEngineService);

  private sessionsKey = 'chat_sessions_v1';
  private messagesKey = 'chat_messages_v1';

  sessions = signal<ChatSession[]>([]);
  messages = signal<ChatMessage[]>([]);
  activeSessionId = signal<string | null>(null);
  isOpenWidget = signal<boolean>(false);
  isBotTyping = signal<boolean>(false);

  // Compute total unread messages for Admin
  unreadAdminTotal = computed(() => {
    return this.sessions().reduce((total, s) => total + (s.unreadCountAdmin || 0), 0);
  });

  // Current session messages
  activeMessages = computed(() => {
    const activeId = this.activeSessionId();
    if (!activeId) return [];
    return this.messages().filter((m) => m.sessionId === activeId);
  });

  constructor() {
    this.loadData();
    this.syncWithServer();

    if (typeof window !== 'undefined') {
      // Listen to storage events for real-time sync across browser tabs
      window.addEventListener('storage', (event) => {
        if (event.key === this.sessionsKey || event.key === this.messagesKey || event.key === '_secure_db') {
          this.loadData();
        }
      });

      // Poll server every 1.5 seconds for real-time live chat message delivery
      setInterval(() => {
        this.loadData();
        this.syncWithServer();
      }, 1500);
    }
  }

  public loadData() {
    const loadedSessions = this.storageService.getOrCreate<ChatSession[]>(this.sessionsKey, INITIAL_SESSIONS);
    const loadedMessages = this.storageService.getOrCreate<ChatMessage[]>(this.messagesKey, INITIAL_MESSAGES);

    if (JSON.stringify(this.sessions()) !== JSON.stringify(loadedSessions)) {
      this.sessions.set(loadedSessions);
    }
    if (JSON.stringify(this.messages()) !== JSON.stringify(loadedMessages)) {
      this.messages.set(loadedMessages);
    }
  }

  public syncWithServer() {
    if (typeof window === 'undefined') return;
    fetch('http://localhost:3000/api/chat/sync')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.success) {
          const serverSessions: ChatSession[] = data.sessions || [];
          const serverMessages: ChatMessage[] = data.messages || [];

          if (serverSessions.length > 0) {
            const currentSessions = this.sessions();
            const mergedMap = new Map<string, ChatSession>();
            serverSessions.forEach((s) => mergedMap.set(s.id, s));
            currentSessions.forEach((s) => {
              if (!mergedMap.has(s.id)) {
                mergedMap.set(s.id, s);
              } else {
                // Keep whichever has higher unread count or newer timestamp
                const serverItem = mergedMap.get(s.id)!;
                if ((s.unreadCountAdmin || 0) > (serverItem.unreadCountAdmin || 0)) {
                  serverItem.unreadCountAdmin = s.unreadCountAdmin;
                }
                if ((s.unreadCountUser || 0) > (serverItem.unreadCountUser || 0)) {
                  serverItem.unreadCountUser = s.unreadCountUser;
                }
              }
            });

            const mergedSessions = Array.from(mergedMap.values());
            if (JSON.stringify(this.sessions()) !== JSON.stringify(mergedSessions)) {
              this.sessions.set(mergedSessions);
              this.storageService.set(this.sessionsKey, mergedSessions);
            }
          }

          if (serverMessages.length > 0) {
            const currentMessages = this.messages();
            const mergedMap = new Map<string, ChatMessage>();
            serverMessages.forEach((m) => mergedMap.set(m.id, m));
            currentMessages.forEach((m) => {
              if (!mergedMap.has(m.id)) {
                mergedMap.set(m.id, m);
              }
            });

            const mergedMessages = Array.from(mergedMap.values());
            if (JSON.stringify(this.messages()) !== JSON.stringify(mergedMessages)) {
              this.messages.set(mergedMessages);
              this.storageService.set(this.messagesKey, mergedMessages);
            }
          }
        }
      })
      .catch(() => {});
  }

  public saveData() {
    const s = this.sessions();
    const m = this.messages();
    this.storageService.set(this.sessionsKey, s);
    this.storageService.set(this.messagesKey, m);

    // Sync directly to central Node server
    if (typeof window !== 'undefined') {
      fetch('http://localhost:3000/api/chat/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessions: s, messages: m })
      }).catch(() => {});
    }
  }

  toggleWidget(open?: boolean) {
    if (open !== undefined) {
      this.isOpenWidget.set(open);
    } else {
      this.isOpenWidget.update((v) => !v);
    }
  }

  public resetActiveUserSession() {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('chat_tab_session_id');
      localStorage.removeItem('chat_guest_session_id');
    }
  }

  // Get or create session for the user viewing the store with strict account isolation
  getOrCreateUserSession(currentUser?: any): ChatSession {
    const sessions = this.sessions();

    // 1. Logged in user path (strictly match user's own email/id)
    if (currentUser && (currentUser.email || currentUser.id)) {
      const userEmail = currentUser.email ? currentUser.email.trim().toLowerCase() : '';
      const userId = currentUser.id ? String(currentUser.id) : '';

      const existing = sessions.find(
        (s) =>
          (userId && s.userId && String(s.userId) === userId) ||
          (userEmail && s.userEmail && s.userEmail.toLowerCase() === userEmail)
      );

      if (existing) {
        if (currentUser.name || currentUser.fullname) {
          existing.userName = currentUser.name || currentUser.fullname;
        }
        if (userEmail) existing.userEmail = userEmail;
        if (currentUser.avatar) existing.userAvatar = currentUser.avatar;
        existing.isGuest = false;
        return existing;
      }

      // Create new dedicated session for THIS logged-in user
      const userSessionId = 'session_u_' + (userId || userEmail.replace(/[^a-z0-9]/g, '')) + '_' + Date.now();
      const displayName = currentUser.fullname || currentUser.name || currentUser.username || (userEmail ? userEmail.split('@')[0] : 'Thành viên');

      const newUserSession: ChatSession = {
        id: userSessionId,
        userId: userId || undefined,
        userName: displayName,
        userEmail: userEmail || undefined,
        userAvatar: currentUser.avatar || undefined,
        isGuest: false,
        status: 'active',
        chatMode: 'ai',
        lastMessage: 'Bắt đầu cuộc trò chuyện mới',
        lastMessageTime: new Date().toISOString(),
        unreadCountAdmin: 0,
        unreadCountUser: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const welcomeMsg: ChatMessage = {
        id: 'msg_' + Date.now(),
        sessionId: userSessionId,
        sender: 'system',
        senderName: 'Sachweb Support Bot',
        text: `Xin chào ${displayName}! Sachweb hân hạnh được hỗ trợ bạn. Bạn đang cần tư vấn thông tin gì ạ?`,
        timestamp: new Date().toISOString(),
        isRead: true
      };

      setTimeout(() => {
        const exists = this.sessions().some((s) => s.id === userSessionId);
        if (!exists) {
          this.sessions.update((list) => [newUserSession, ...list]);
          this.messages.update((list) => [...list, welcomeMsg]);
          this.saveData();
        }
      }, 0);

      return newUserSession;
    }

    // 2. Guest user path (strictly isolated for non-logged in users)
    let guestSessionId = typeof window !== 'undefined'
      ? (sessionStorage.getItem('chat_tab_session_id') || localStorage.getItem('chat_guest_session_id'))
      : null;

    if (guestSessionId) {
      const existingGuest = sessions.find((s) => s.id === guestSessionId && s.isGuest);
      if (existingGuest) return existingGuest;
    }

    const newGuestSessionId = 'session_g_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('chat_tab_session_id', newGuestSessionId);
      localStorage.setItem('chat_guest_session_id', newGuestSessionId);
    }

    const newGuestSession: ChatSession = {
      id: newGuestSessionId,
      userName: 'Khách vãng lai',
      isGuest: true,
      status: 'active',
      chatMode: 'ai',
      lastMessage: 'Bắt đầu cuộc trò chuyện mới',
      lastMessageTime: new Date().toISOString(),
      unreadCountAdmin: 0,
      unreadCountUser: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const welcomeMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sessionId: newGuestSessionId,
      sender: 'system',
      senderName: 'Sachweb Support Bot',
      text: 'Xin chào Khách vãng lai! Sachweb hân hạnh được hỗ trợ bạn. Bạn đang cần tư vấn thông tin gì ạ?',
      timestamp: new Date().toISOString(),
      isRead: true
    };

    setTimeout(() => {
      const exists = this.sessions().some((s) => s.id === newGuestSessionId);
      if (!exists) {
        this.sessions.update((list) => [newGuestSession, ...list]);
        this.messages.update((list) => [...list, welcomeMsg]);
        this.saveData();
      }
    }, 0);

    return newGuestSession;
  }

  // Send a message (from User or Admin)
  sendMessage(sessionId: string, text: string, sender: 'user' | 'admin', senderName: string, senderAvatar?: string) {
    if (!text || !text.trim()) return;

    const trimmedText = text.trim();
    const newMsg: ChatMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      sessionId,
      sender,
      senderName,
      senderAvatar,
      text: trimmedText,
      timestamp: new Date().toISOString(),
      isRead: false
    };

    this.messages.update((list) => [...list, newMsg]);

    const textClean = trimmedText.toLowerCase();
    const isLiveChatRequest = textClean.includes('live chat') || textClean.includes('admin') || textClean.includes('nguoi that') || textClean.includes('nhan vien') || textClean.includes('cskh');

    this.sessions.update((list) =>
      list.map((s) => {
        if (s.id === sessionId) {
          const isUser = sender === 'user';
          const shouldBeLiveMode = s.chatMode === 'live' || sender === 'admin' || (isUser && isLiveChatRequest);

          return {
            ...s,
            status: 'active',
            chatMode: shouldBeLiveMode ? 'live' : (s.chatMode || 'ai'),
            lastMessage: trimmedText,
            lastMessageTime: newMsg.timestamp,
            updatedAt: newMsg.timestamp,
            unreadCountAdmin: isUser ? (s.unreadCountAdmin || 0) + 1 : s.unreadCountAdmin,
            unreadCountUser: !isUser ? (s.unreadCountUser || 0) + 1 : s.unreadCountUser,
            // If admin replies or user requests live chat, pause AI bot for this session
            isBotActive: sender === 'admin' || isLiveChatRequest ? false : (s.isBotActive !== false)
          };
        }
        return s;
      })
    );

    this.saveData();

    // Trigger AI Bot smart reply if user sent a message, session is in 'ai' mode, and bot is active
    if (sender === 'user') {
      const session = this.sessions().find((s) => s.id === sessionId);
      const isAiMode = session?.chatMode === 'ai';
      if (isAiMode && session?.isBotActive !== false && !isLiveChatRequest) {
        this.triggerBotReply(sessionId, trimmedText);
      }
    }
  }

  switchChatMode(sessionId: string, mode: 'ai' | 'live') {
    const session = this.sessions().find((s) => s.id === sessionId);
    if (!session) return;

    if (session.chatMode === mode) return;

    const modeText = mode === 'live'
      ? '🔴 **Đã kết nối trực tiếp với Admin CSKH**. Quản trị viên cửa hàng đã nhận được thông báo và sẽ trả lời bạn ngay!'
      : '🤖 **Đã chuyển sang Trợ Lý AI Sachweb (Tự động 24/7)**. Bạn có thể hỏi về sách, đơn hàng, phí ship!';

    const sysMsg: ChatMessage = {
      id: 'msg_sys_' + Date.now(),
      sessionId,
      sender: 'system',
      senderName: 'Hệ Thống Sachweb',
      text: modeText,
      timestamp: new Date().toISOString(),
      isRead: true
    };

    this.messages.update((list) => [...list, sysMsg]);

    this.sessions.update((list) =>
      list.map((s) => {
        if (s.id === sessionId) {
          return {
            ...s,
            chatMode: mode,
            isBotActive: mode === 'ai',
            lastMessage: modeText,
            lastMessageTime: sysMsg.timestamp,
            updatedAt: sysMsg.timestamp,
            unreadCountAdmin: mode === 'live' ? (s.unreadCountAdmin || 0) + 1 : s.unreadCountAdmin
          };
        }
        return s;
      })
    );

    this.saveData();
  }

  private async triggerBotReply(sessionId: string, text: string) {
    this.isBotTyping.set(true);
    const user = this.authService.currentUser();

    try {
      const botReply = await this.botEngine.generateReplyAsync(text, user, sessionId);

      const botMsg: ChatMessage = {
        id: 'msg_bot_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        sessionId,
        sender: 'admin',
        senderName: 'Sachweb Bot CSKH',
        senderAvatar: '/image/danhmuc3.png',
        text: botReply.replyText,
        timestamp: new Date().toISOString(),
        isRead: true
      };

      this.messages.update((list) => [...list, botMsg]);

      this.sessions.update((list) =>
        list.map((s) => {
          if (s.id === sessionId) {
            return {
              ...s,
              lastMessage: botReply.replyText,
              lastMessageTime: botMsg.timestamp,
              updatedAt: botMsg.timestamp,
              suggestedChips: botReply.suggestedChips,
              isBotActive: botReply.isHandover ? false : (s.isBotActive !== false)
            };
          }
          return s;
        })
      );
    } catch (error) {
      console.error('[ChatService] Error triggering bot reply:', error);
    } finally {
      this.isBotTyping.set(false);
      this.saveData();
    }
  }

  markAsReadByAdmin(sessionId: string) {
    const session = this.sessions().find((s) => s.id === sessionId);
    if (!session) return;

    const hasUnreadMessages = this.messages().some(
      (m) => m.sessionId === sessionId && m.sender === 'user' && !m.isRead
    );

    if ((session.unreadCountAdmin || 0) === 0 && !hasUnreadMessages) {
      return; // Already read, do nothing to prevent signal re-evaluation loop
    }

    this.sessions.update((list) =>
      list.map((s) => (s.id === sessionId ? { ...s, unreadCountAdmin: 0 } : s))
    );
    this.messages.update((list) =>
      list.map((m) => (m.sessionId === sessionId && m.sender === 'user' ? { ...m, isRead: true } : m))
    );
    this.saveData();
  }

  markAsReadByUser(sessionId: string) {
    const session = this.sessions().find((s) => s.id === sessionId);
    if (!session) return;

    const hasUnreadMessages = this.messages().some(
      (m) => m.sessionId === sessionId && m.sender === 'admin' && !m.isRead
    );

    if ((session.unreadCountUser || 0) === 0 && !hasUnreadMessages) {
      return; // Already read, do nothing to prevent signal re-evaluation loop
    }

    this.sessions.update((list) =>
      list.map((s) => (s.id === sessionId ? { ...s, unreadCountUser: 0 } : s))
    );
    this.messages.update((list) =>
      list.map((m) => (m.sessionId === sessionId && m.sender === 'admin' ? { ...m, isRead: true } : m))
    );
    this.saveData();
  }

  closeSession(sessionId: string) {
    this.sessions.update((list) =>
      list.map((s) => (s.id === sessionId ? { ...s, status: 'closed', updatedAt: new Date().toISOString() } : s))
    );
    const systemMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      sessionId,
      sender: 'system',
      senderName: 'System',
      text: 'Phiên hỗ trợ này đã kết thúc bởi Chăm sóc khách hàng. Nếu cần thêm hỗ trợ, bạn vui lòng gửi tin nhắn mới!',
      timestamp: new Date().toISOString(),
      isRead: true
    };
    this.messages.update((list) => [...list, systemMsg]);
    this.saveData();
  }

  reopenSession(sessionId: string) {
    this.sessions.update((list) =>
      list.map((s) => (s.id === sessionId ? { ...s, status: 'active', updatedAt: new Date().toISOString() } : s))
    );
    this.saveData();
  }

  deleteSession(sessionId: string) {
    this.sessions.update((list) => list.filter((s) => s.id !== sessionId));
    this.messages.update((list) => list.filter((m) => m.sessionId !== sessionId));
    if (this.activeSessionId() === sessionId) {
      this.activeSessionId.set(null);
    }
    this.saveData();
  }
}
