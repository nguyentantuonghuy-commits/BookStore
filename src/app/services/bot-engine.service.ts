import { Injectable, inject } from '@angular/core';
import { BookService } from './book.service';
import { CheckoutService } from './checkout.service';
import { CartService } from './cart.service';
import { PromotionService, Promotion } from './promotion.service';

export interface BotReply {
  replyText: string;
  suggestedChips?: string[];
  intent: string;
  isHandover?: boolean;
}

export interface ExtractedEntity {
  intent: 'HANDOVER_ADMIN' | 'TRACK_ORDER' | 'ORDER_CANCEL' | 'STORE_INFO' | 'SHIPPING_POLICY' | 'RETURN_POLICY' | 'PAYMENT_POLICY' | 'PROMOTION' | 'EBOOK_GUIDE' | 'RECOMMEND_BOOKS' | 'GREETING' | 'CART_INFO' | 'GENERAL_FALLBACK';
  orderCode?: string;
  maxPrice?: number;
  categories: string[];
  keywords: string[];
  isFollowUp?: boolean;
}

export interface ConversationMemory {
  lastIntent?: string;
  lastCategory?: string;
  lastMaxPrice?: number;
  lastOrderCode?: string;
  messages: { sender: string; text: string; timestamp: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class BotEngineService {
  private bookService = inject(BookService);
  private checkoutService = inject(CheckoutService);
  private cartService = inject(CartService);
  private promotionService = inject(PromotionService);

  private readonly defaultChips = [
    '📖 Tư vấn chọn sách hay',
    '📦 Tra cứu đơn hàng gần đây',
    '🛒 Xem giỏ hàng của tôi',
    '🎁 Mã giảm giá mới nhất',
    '🏆 Mã giảm giá giảm nhiều nhất',
    '🚚 Phí giao hàng & Freeship',
    '💳 Phương thức thanh toán',
    '👨‍💼 Live Chat với Admin CSKH'
  ];

  // Conversation Memory Store (Mục 10: Quản lý bộ nhớ ngữ cảnh hội thoại)
  private sessionMemories = new Map<string, ConversationMemory>();

  constructor() {
    this.promotionService.loadPublicPromotions().subscribe({
      error: () => {}
    });
  }

  /**
   * Enterprise Asynchronous Generation Entry Point:
   * 1. Attempts high-intelligence Gemini Pro via Express API (/api/ai-chat)
   * 2. Passes dynamic RAG database context (books, orders, cart, wishlist, profile, promotions)
   * 3. Seamlessly falls back to local Heuristic Engine if offline / key missing
   */
  async generateReplyAsync(userMessage: string, currentUser?: any, sessionId: string = 'default'): Promise<BotReply> {
    if (!userMessage || !userMessage.trim()) {
      return {
        replyText: '👋 **Xin chào!** Sachweb.vn rất hân hạnh được tư vấn hỗ trợ bạn. Bạn cần thông tin gì hôm nay ạ?',
        intent: 'GREETING',
        suggestedChips: this.defaultChips
      };
    }

    const rawText = userMessage.trim();
    const cleanText = this.removeVietnameseTones(rawText.toLowerCase());

    // Check for explicit live chat handover intent first
    if (this.containsAny(cleanText, ['gap nhan vien', 'tu van vien', 'gap admin', 'nguoi that', 'ket noi admin', 'gap cskh', 'live chat'])) {
      return {
        replyText: '👨‍💼 **Đã kết nối với Nhân viên CSKH Sachweb!**\nQuản trị viên đã nhận được thông báo yêu cầu Live Chat của bạn. Nhân viên CSKH sẽ phản hồi trực tiếp ngay trong giây lát. Vui lòng nhập sẵn câu hỏi nhé!',
        intent: 'HANDOVER_ADMIN',
        isHandover: true,
        suggestedChips: this.defaultChips
      };
    }

    // Prepare Dynamic RAG Context (Strictly isolated per account)
    const books = this.bookService.allBooks() || [];
    const userOrders = currentUser ? (this.checkoutService.userOrders() || []) : [];
    const userCartItems = currentUser ? (this.cartService.userCarts() || []) : (this.cartService.carts() || []);
    const wishlistIds = currentUser ? (this.bookService.wishlist() || []) : [];

    // Map Cart Context with full book titles, prices & total calculation
    let cartTotalAmount = 0;
    const cartItemsContext = userCartItems.map((item: any) => {
      const targetId = item.productId || item.bookId || item.id;
      const book = books.find((b: any) => String(b.id) === String(targetId));
      const title = item.title || (book ? book.title : 'Sách');
      const author = item.author || (book ? book.author : 'Sachweb');
      const qty = Number(item.quantity || 1);

      let unitPrice = 0;
      let lineTotal = 0;

      if (item.unitPrice && Number(item.unitPrice) > 0) {
        unitPrice = Number(item.unitPrice);
        lineTotal = item.price && Number(item.price) > unitPrice ? Number(item.price) : unitPrice * qty;
      } else if (item.price && Number(item.price) > 0) {
        const storedPrice = Number(item.price);
        if (qty > 1 && (book?.price ? storedPrice > book.price : true)) {
          lineTotal = storedPrice;
          unitPrice = lineTotal / qty;
        } else {
          unitPrice = storedPrice;
          lineTotal = unitPrice * qty;
        }
      } else if (book && book.price) {
        unitPrice = Number(book.price);
        lineTotal = unitPrice * qty;
      }

      cartTotalAmount += lineTotal;

      return {
        bookId: targetId,
        title: title,
        author: author,
        price: unitPrice,
        quantity: qty,
        itemTotal: lineTotal
      };
    });

    const cartContext = {
      items: cartItemsContext,
      totalItems: cartItemsContext.reduce((sum: number, i: any) => sum + i.quantity, 0),
      totalAmount: cartTotalAmount
    };

    // Load & prepare Dynamic Promotions Context (Active, Newest & Highest Discount)
    const allPromos = this.promotionService.publicPromotions() || [];
    const activePromos = (allPromos.length > 0 ? allPromos : [
      { id: '1', code: 'SACHWEB10', name: 'Mã chào mừng Sachweb', description: 'Giảm 10% cho toàn bộ đơn hàng', discountType: 'PERCENT', discountValue: 10, minOrderValue: 0, maxDiscount: 50000, isActive: true, createdAt: '2026-01-01' },
      { id: '2', code: 'FREESHIP', name: 'Mã miễn phí vận chuyển', description: 'Freeship đơn từ 200k', discountType: 'FIXED', discountValue: 20000, minOrderValue: 200000, maxDiscount: 20000, isActive: true, createdAt: '2026-01-02' }
    ] as Promotion[]).filter(p => p.isActive !== false);

    let latestPromo: Promotion | null = null;
    let highestDiscountPromo: Promotion | null = null;

    if (activePromos.length > 0) {
      const sortedLatest = [...activePromos].sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
      latestPromo = sortedLatest[0];

      const sortedHighest = [...activePromos].sort((a, b) => {
        const valA = a.discountType === 'PERCENT' ? (a.maxDiscount || a.discountValue * 5000) : a.discountValue;
        const valB = b.discountType === 'PERCENT' ? (b.maxDiscount || b.discountValue * 5000) : b.discountValue;
        return valB - valA;
      });
      highestDiscountPromo = sortedHighest[0];
    }

    const promotionsContext = {
      activePromotions: activePromos.map(p => ({
        code: p.code,
        name: p.name,
        description: p.description,
        discountType: p.discountType,
        discountValue: p.discountValue,
        minOrderValue: p.minOrderValue,
        maxDiscount: p.maxDiscount,
        endAt: p.endAt
      })),
      latestPromotion: latestPromo ? {
        code: latestPromo.code,
        name: latestPromo.name,
        discountValue: latestPromo.discountValue,
        discountType: latestPromo.discountType,
        minOrderValue: latestPromo.minOrderValue,
        maxDiscount: latestPromo.maxDiscount,
        description: latestPromo.description
      } : null,
      highestDiscountPromotion: highestDiscountPromo ? {
        code: highestDiscountPromo.code,
        name: highestDiscountPromo.name,
        discountValue: highestDiscountPromo.discountValue,
        discountType: highestDiscountPromo.discountType,
        minOrderValue: highestDiscountPromo.minOrderValue,
        maxDiscount: highestDiscountPromo.maxDiscount,
        description: highestDiscountPromo.description
      } : null
    };

    // Map Wishlist Context
    const wishlistContext = wishlistIds.map((id: string) => {
      const book = books.find((b: any) => String(b.id) === String(id));
      return {
        id: id,
        title: book ? book.title : 'Sách',
        author: book ? book.author : 'Sachweb',
        price: book ? book.price : 0,
        category: book ? book.category : 'Khác'
      };
    });

    // Map User Profile Context
    const userProfileContext = currentUser ? {
      fullname: currentUser.fullname || currentUser.name || currentUser.username || 'Thành viên',
      email: currentUser.email || '',
      phone: currentUser.phone || 'Chưa cập nhật',
      role: currentUser.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'
    } : null;

    const memory = this.getOrCreateMemory(sessionId);

    try {
      const response = await fetch('http://localhost:3000/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: rawText,
          currentUser,
          userProfileContext,
          cartContext,
          promotionsContext,
          wishlistContext,
          booksContext: books.map((b) => ({
            id: b.id,
            title: b.title,
            author: b.author,
            category: b.category,
            price: b.price,
            discount: b.discount,
            rating: (b as any).rating || 5,
            description: (b as any).description || ''
          })),
          ordersContext: userOrders.slice(0, 5).map((o: any) => ({
            id: o.id,
            orderCode: o.orderCode || o.id,
            totalAmount: o.totalAmount || o.total || 0,
            status: this.translateOrderStatus(o.status),
            createdAt: o.createdAt,
            items: (o.items || []).map((i: any) => ({
              title: i.title || i.name || i.bookTitle || 'Sách',
              quantity: i.quantity || i.qty || 1,
              price: i.price || 0
            }))
          })),
          userHistory: memory.messages.slice(-6)
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.replyText) {
          const reply: BotReply = {
            replyText: data.replyText,
            intent: 'GEMINI_PRO_AI',
            suggestedChips: data.suggestedChips || this.defaultChips
          };

          this.updateMemory(sessionId, { intent: 'GENERAL_FALLBACK', categories: [], keywords: [] }, rawText, reply.replyText);
          return reply;
        }
      }
    } catch (err) {
      console.warn('[BotEngineService] Gemini API unavailable, using local heuristic engine:', err);
    }

    // Fallback to Local Heuristic / Rule-based engine
    return this.generateReply(rawText, currentUser, sessionId);
  }

  /**
   * Local Synchronous Heuristic Engine Entry Point
   */
  generateReply(userMessage: string, currentUser?: any, sessionId: string = 'default'): BotReply {
    if (!userMessage || !userMessage.trim()) {
      return {
        replyText: '👋 **Xin chào!** Sachweb.vn rất hân hạnh được tư vấn hỗ trợ bạn. Bạn cần thông tin gì hôm nay ạ?',
        intent: 'GREETING',
        suggestedChips: this.defaultChips
      };
    }

    const memory = this.getOrCreateMemory(sessionId);
    const rawText = userMessage.trim();

    // 1. QUERY REWRITING (Mục 9: Viết lại câu hỏi dựa vào ngữ cảnh tin nhắn trước)
    const expandedText = this.rewriteQueryWithMemory(rawText, memory);
    const cleanText = this.removeVietnameseTones(expandedText.toLowerCase());

    // 2. INTENT CLASSIFICATION & STRUCTURED ENTITY EXTRACTION (Mục 8)
    const entity = this.extractIntentAndEntities(rawText, expandedText, cleanText);

    // 3. CANDIDATE RESPONSE GENERATION (RAG & Knowledge Search)
    let candidate = this.generateCandidateReply(rawText, cleanText, entity, currentUser, memory);

    // 4. SELF-CRITIQUE & VERIFICATION (Mục 11: Kiểm tra lại câu trả lời trước khi gửi)
    candidate = this.verifyAndRefineReply(candidate, rawText, entity);

    // 5. UPDATE CONVERSATION MEMORY
    this.updateMemory(sessionId, entity, rawText, candidate.replyText);

    return candidate;
  }

  // =========================================================================
  // 1. QUERY REWRITING & CONVERSATION MEMORY ENGINE
  // =========================================================================
  private rewriteQueryWithMemory(rawText: string, memory: ConversationMemory): string {
    const clean = this.removeVietnameseTones(rawText.toLowerCase());

    // Detect follow-up phrases like "còn cái khác không?", "cuốn này bao nhiêu?", "đơn đó thì sao?", "ship bao lâu?"
    const isShortFollowUp =
      clean.length < 25 &&
      (this.containsAny(clean, ['con cai khac', 'sach khac', 'cuon khac', 'con nua khac', 'con khong', 'bao nhieu', 'ship sao', 'khi nao nhan', 'don do']) ||
        clean.startsWith('con ') ||
        clean.startsWith('the con'));

    if (isShortFollowUp && memory.lastIntent) {
      if (memory.lastIntent === 'RECOMMEND_BOOKS' && memory.lastCategory) {
        return `${rawText} sách ${memory.lastCategory} ${memory.lastMaxPrice ? 'giá dưới ' + memory.lastMaxPrice : ''}`;
      }
      if (memory.lastIntent === 'TRACK_ORDER' && memory.lastOrderCode) {
        return `${rawText} đơn hàng ${memory.lastOrderCode}`;
      }
    }

    return rawText;
  }

  // =========================================================================
  // 2. INTENT & ENTITY EXTRACTION (Structured JSON Output)
  // =========================================================================
  private extractIntentAndEntities(rawText: string, expandedText: string, cleanText: string): ExtractedEntity {
    const maxPrice = this.extractPriceLimit(cleanText, expandedText);
    const isPriceExplicit = maxPrice > 0 || cleanText.includes('gia') || cleanText.includes('duoi') || cleanText.includes('sach');

    // Extract Order Code safely (NEVER match 100k / 150k as order codes)
    const ordMatch = !isPriceExplicit
      ? (expandedText.match(/\b(ORD|SW)[\w\d]+\b/i) || expandedText.match(/\b(mã đơn|đơn hàng|đơn số|đơn)\s*#?\s*(\d+)\b/i))
      : null;

    let orderCode = ordMatch ? ordMatch[0].replace('#', '').toUpperCase() : undefined;

    // Categories Extractor
    const categories: string[] = [];
    if (this.containsAny(cleanText, ['lich su', 'chinh tri', 'vua'])) categories.push('Lịch sử - Chính trị');
    if (this.containsAny(cleanText, ['kinh te', 'tai chinh', 'quan tri', 'khoi nghiep'])) categories.push('Kinh tế');
    if (this.containsAny(cleanText, ['ho chi minh', 'kgvh', 'van hoa'])) categories.push('KGVH Hồ Chí Minh');
    if (this.containsAny(cleanText, ['thieu nhi'])) categories.push('Thiếu nhi');
    if (this.containsAny(cleanText, ['giao trinh'])) categories.push('Giáo trình');
    if (this.containsAny(cleanText, ['suc khoe', 'cuoc song'])) categories.push('Sức khỏe & Cuộc sống');
    if (this.containsAny(cleanText, ['van hoc', 'tieu thuyet', 'truyen'])) categories.push('Văn hóa xã hội');

    // Intent Classifier Score Matrix
    let scoreHandover = 0;
    let scoreOrderTrack = 0;
    let scoreOrderCancel = 0;
    let scoreStoreInfo = 0;
    let scoreShipping = 0;
    let scoreReturn = 0;
    let scorePayment = 0;
    let scorePromotion = 0;
    let scoreEbook = 0;
    let scoreBookSearch = 0;
    let scoreGreeting = 0;
    let scoreCartInfo = 0;

    if (this.containsAny(cleanText, ['gap nhan vien', 'tu van vien', 'gap admin', 'nguoi that', 'ket noi admin', 'gap cskh', 'live chat', 'tro ly me', 'nhan vien cskh'])) {
      scoreHandover += 12;
    }

    if (this.containsAny(cleanText, ['gio hang', 'trong gio', 'tong tien gio', 'gio hang cua toi', 'sach trong gio', 'bao nhieu tien gio', 'gio hang bao nhieu'])) {
      scoreCartInfo += 12;
    }

    if (orderCode) scoreOrderTrack += 10;
    if (
      this.containsAny(cleanText, [
        'tra cuu don',
        'khi nao nhan',
        'kiem tra don',
        'tinh trang don',
        'don hang cua toi',
        'don me',
        'don gan nhat',
        'don moi nhat',
        'don vua dat'
      ]) ||
      (cleanText.includes('don hang') && !cleanText.includes('sach'))
    ) {
      scoreOrderTrack += 7;
    }

    if (this.containsAny(cleanText, ['huy don', 'sua dia chi', 'doi dia chi', 'doi sdt', 'nham dia chi', 'sua don'])) {
      scoreOrderCancel += 8;
    }

    if (this.containsAny(cleanText, ['dia chi', 'cua hang', 'o dau', 'hotline', 'so dien thoai', 'email', 'gio mo cua', 'gio lam viec', 'lien he', 'chi nhanh'])) {
      scoreStoreInfo += 7;
    }

    if (this.containsAny(cleanText, ['phi ship', 'phi van chuyen', 'giao hang', 'bao lau', 'freeship', 'ship bao nhieu', 'hoa toc', 'giao trong ngay', 'ship tinh', 'noi thanh'])) {
      scoreShipping += 7;
    }

    if (this.containsAny(cleanText, ['doi tra', 'sach loi', 'hong', 'mop bia', 'hoan tien', 'doi sach', 'rach', 'bao hanh'])) {
      scoreReturn += 7;
    }

    if (this.containsAny(cleanText, ['thanh toan', 'chuyen khoan', 'momo', 'vnpay', 'vietqr', 'cod', 'tien mat', 'tra tien', 'hoa don', 'vat', 'xuat hoa don'])) {
      scorePayment += 7;
    }

    if (this.containsAny(cleanText, ['ma giam gia', 'khuyen mai', 'voucher', 'giam gia', 'uu dai', 'ma freeship', 'code', 'ma moi', 'ma giam nhieu nhat', 'ma hoi nhat'])) {
      scorePromotion += 7;
    }

    if (this.containsAny(cleanText, ['ebook', 'doc online', 'tai pdf', 'sach dien tu', 'sach giay', 'tu sach'])) {
      scoreEbook += 7;
    }

    if (
      this.containsAny(cleanText, [
        'sach',
        'tim',
        'goi y',
        'ban chay',
        'moi nhat',
        'gia',
        'duoi',
        'the loai',
        'lich su',
        'tam ly',
        'kinh te',
        'quan tri',
        'van hoc',
        'tieu thuyet',
        'thieu nhi',
        'ho chi minh',
        'tac gia',
        're',
        'sale',
        'khoi nghiep',
        'ky nang'
      ]) ||
      isPriceExplicit
    ) {
      scoreBookSearch += 10;
    }

    if (this.containsAny(cleanText, ['chao', 'hi', 'hello', 'xin chao', 'chao shop', 'alo'])) {
      scoreGreeting += 3;
    }

    const maxScore = Math.max(
      scoreHandover,
      scoreCartInfo,
      scoreOrderTrack,
      scoreOrderCancel,
      scoreStoreInfo,
      scoreShipping,
      scoreReturn,
      scorePayment,
      scorePromotion,
      scoreEbook,
      scoreBookSearch,
      scoreGreeting
    );

    let intent: ExtractedEntity['intent'] = 'GENERAL_FALLBACK';
    if (scoreHandover >= 8 || maxScore === scoreHandover) intent = 'HANDOVER_ADMIN';
    else if (scoreCartInfo >= 5 && maxScore === scoreCartInfo) intent = 'CART_INFO';
    else if ((scoreBookSearch >= 4 && maxScore === scoreBookSearch) || isPriceExplicit) intent = 'RECOMMEND_BOOKS';
    else if (scoreOrderTrack >= 5 && maxScore === scoreOrderTrack) intent = 'TRACK_ORDER';
    else if (scoreOrderCancel >= 6 && maxScore === scoreOrderCancel) intent = 'ORDER_CANCEL';
    else if (scoreStoreInfo >= 5 && maxScore === scoreStoreInfo) intent = 'STORE_INFO';
    else if (scoreShipping >= 5 && scoreShipping === maxScore) intent = 'SHIPPING_POLICY';
    else if (scoreReturn >= 5 && scoreReturn === maxScore) intent = 'RETURN_POLICY';
    else if (scorePayment >= 5 && scorePayment === maxScore) intent = 'PAYMENT_POLICY';
    else if (scorePromotion >= 5 && scorePromotion === maxScore) intent = 'PROMOTION';
    else if (scoreEbook >= 5 && scoreEbook === maxScore) intent = 'EBOOK_GUIDE';
    else if (scoreGreeting >= 2 && maxScore === scoreGreeting) intent = 'GREETING';

    return {
      intent,
      orderCode,
      maxPrice: maxPrice > 0 ? maxPrice : undefined,
      categories,
      keywords: cleanText.split(' ').filter((w) => w.length > 2)
    };
  }

  // =========================================================================
  // 3. GENERATE CANDIDATE REPLY (RAG Hybrid Search over Products & Knowledge)
  // =========================================================================
  private generateCandidateReply(
    rawText: string,
    cleanText: string,
    entity: ExtractedEntity,
    currentUser: any,
    memory: ConversationMemory
  ): BotReply {
    switch (entity.intent) {
      case 'HANDOVER_ADMIN':
        return {
          replyText: '👨‍💼 **Đã kết nối với Nhân viên CSKH Sachweb!**\nQuản trị viên đã nhận được thông báo yêu cầu Live Chat của bạn. Nhân viên CSKH sẽ phản hồi trực tiếp ngay trong giây lát. Vui lòng nhập sẵn câu hỏi nhé!',
          intent: 'HANDOVER_ADMIN',
          isHandover: true,
          suggestedChips: this.defaultChips
        };

      case 'RECOMMEND_BOOKS': {
        const matchedBooks = this.findMatchingBooksHybrid(cleanText, entity.maxPrice, entity.categories);
        if (matchedBooks.length > 0) {
          let responseStr = '📖 **Gợi ý sách hay chuẩn yêu cầu dành cho bạn**:\n\n';
          matchedBooks.forEach((b: any, idx) => {
            const priceStr = b.price ? b.price.toLocaleString('vi-VN') + 'đ' : 'Miễn phí';
            const discountStr = b.discount ? ` (Giảm ${b.discount})` : '';
            const ratingStr = b.rating ? ` | ⭐ ${b.rating}/5` : '';
            responseStr += `${idx + 1}. **${b.title}** - *${b.author || 'Sachweb'}*\n   👉 Giá: **${priceStr}**${discountStr}${ratingStr}\n   📁 Danh mục: ${b.category || 'Ebook'}\n\n`;
          });
          responseStr += 'Bạn có thể gõ tên tác giả hoặc chọn các thể loại bên dưới để Sachweb tìm thêm cho bạn nhé!';

          return {
            replyText: responseStr,
            intent: 'RECOMMEND_BOOKS',
            suggestedChips: this.defaultChips
          };
        }
        break;
      }

      case 'TRACK_ORDER': {
        const allOrders = this.checkoutService.orders() || [];

        if (entity.orderCode) {
          const foundOrder = allOrders.find(
            (o: any) =>
              (o.orderCode && o.orderCode.toUpperCase().includes(entity.orderCode!)) ||
              (o.id && String(o.id).toUpperCase() === entity.orderCode!)
          );

          if (foundOrder) {
            const statusText = this.translateOrderStatus(foundOrder.status);
            const totalAmt = (foundOrder.totalAmount || foundOrder.total || 0).toLocaleString('vi-VN');
            const dateStr = foundOrder.createdAt ? new Date(foundOrder.createdAt).toLocaleDateString('vi-VN') : 'Mới đây';
            const itemsCount = foundOrder.items ? foundOrder.items.length : 1;

            return {
              replyText: `📦 **Thông tin Đơn hàng #${foundOrder.orderCode || foundOrder.id}**:\n• **Ngày đặt**: ${dateStr}\n• **Số sản phẩm**: ${itemsCount} cuốn\n• **Tổng thanh toán**: **${totalAmt}đ**\n• **Trạng thái**: ${statusText}\n• **Dự kiến giao**: 1 - 3 ngày làm việc.\n\n*Nếu bạn muốn hỗ trợ thay đổi địa chỉ hoặc hủy đơn, vui lòng nhấn "Live Chat với Admin CSKH" bên dưới nhé!*`,
              intent: 'TRACK_ORDER',
              suggestedChips: ['👨‍💼 Live Chat với Admin CSKH', '🚚 Phí giao hàng & Freeship', '🔄 Chính sách đổi trả 7 ngày']
            };
          }
        }

        // Check user orders (ALWAYS SORT DESCENDING BY CREATED AT TO GET NEWEST FIRST!)
        const userOrders = (this.checkoutService.userOrders() || []).length > 0
          ? (this.checkoutService.userOrders() || [])
          : allOrders;

        if (userOrders.length > 0) {
          const sortedOrders = [...userOrders].sort((a: any, b: any) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (typeof a.id === 'number' ? a.id : Number(String(a.id).replace(/\D/g, '')) || 0);
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (typeof b.id === 'number' ? b.id : Number(String(b.id).replace(/\D/g, '')) || 0);
            return timeB - timeA;
          });

          const latest = sortedOrders[0];
          const code = latest.orderCode || '#' + (latest.id || 'N/A');
          const statusText = this.translateOrderStatus(latest.status);
          const totalAmt = (latest.totalAmount || latest.total || 0).toLocaleString('vi-VN');
          const dateStr = latest.createdAt ? new Date(latest.createdAt).toLocaleDateString('vi-VN') : 'Gần đây';

          return {
            replyText: `📦 **Đơn hàng MỚI NHẤT của bạn (${code})**:\n• **Ngày đặt**: ${dateStr}\n• **Tổng tiền**: **${totalAmt}đ**\n• **Trạng thái**: ${statusText}\n\n👉 Bạn có thể gõ mã đơn cụ thể (ví dụ: *ORD17859*) để Sachweb tra cứu chi tiết nhé!`,
            intent: 'TRACK_ORDER',
            suggestedChips: ['👨‍💼 Live Chat với Admin CSKH', '🚚 Phí giao hàng & Freeship', '🎁 Mã giảm giá mới nhất']
          };
        }

        return {
          replyText: '📦 **Tra cứu đơn hàng**:\nBạn chưa có đơn hàng nào vừa đặt hoặc vui lòng nhập mã đơn hàng (ví dụ: *ORD17859*) để Sachweb tra cứu ngay cho bạn nhé!',
          intent: 'TRACK_ORDER',
          suggestedChips: ['👨‍💼 Live Chat với Admin CSKH', '📖 Tư vấn chọn sách hay']
        };
      }

      case 'ORDER_CANCEL':
        return {
          replyText: '🛠️ **Hỗ trợ Hủy / Đổi thông tin đơn hàng**:\n• Đơn mới đặt ở trạng thái *"Chờ xác nhận"* có thể hủy hoặc đổi địa chỉ trực tiếp tại **Tài khoản -> Đơn hàng của tôi**.\n• Nếu đơn đã chuyển sang trạng thái *"Đang đóng gói/Vận chuyển"*, vui lòng nhấn **"Live Chat với Admin CSKH"** bên dưới để nhân viên can thiệp xử lý ngay!',
          intent: 'ORDER_CANCEL',
          suggestedChips: ['👨‍💼 Live Chat với Admin CSKH', '📦 Tra cứu đơn hàng gần đây']
        };

      case 'STORE_INFO':
        return {
          replyText: '🏬 **Thông tin cửa hàng & Liên hệ Sachweb.vn**:\n• **Địa chỉ**: Tòa nhà Sachweb Building, Q. 1, TP. Hồ Chí Minh.\n• **Hotline hỗ trợ**: **1900 6789** (8h00 - 21h00 hằng ngày).\n• **Email**: cskh@sachweb.vn\n• **Giờ mở cửa**: 8h00 - 21h00 (Thứ 2 - Chủ Nhật).',
          intent: 'STORE_INFO',
          suggestedChips: ['👨‍💼 Live Chat với Admin CSKH', '🚚 Phí giao hàng & Freeship', '📖 Tư vấn chọn sách hay']
        };

      case 'SHIPPING_POLICY':
        return {
          replyText: '🚚 **Chính sách giao hàng của Sachweb.vn**:\n• **MIỄN PHÍ SHIP 100%**: Áp dụng cho đơn hàng từ **300.000đ** trở lên.\n• **Phí ship cố định**: **20.000đ** (Nội thành TP.HCM) và **30.000đ** (Các tỉnh thành khác).\n• **Giao hỏa tốc**: Hỗ trợ giao 2-4h nội thành khi liên hệ hotline.\n• **Thời gian giao tiêu chuẩn**: 1 - 3 ngày làm việc.',
          intent: 'SHIPPING_POLICY',
          suggestedChips: ['🎁 Mã giảm giá mới nhất', '📦 Tra cứu đơn hàng gần đây', '📖 Tư vấn chọn sách hay']
        };

      case 'RETURN_POLICY':
        return {
          replyText: '🔄 **Chính sách đổi trả Sachweb.vn**:\n• Sachweb hỗ trợ **1 ĐỔI 1 MIỄN PHÍ TRONG 7 NGÀY** nếu sách bị lỗi in ấn, rách trang hoặc móp góc bìa do vận chuyển.\n• Khách hàng chỉ cần chụp hình gửi qua Live Chat, Sachweb sẽ cử bưu tá mang sách mới đến đổi tận nhà!',
          intent: 'RETURN_POLICY',
          suggestedChips: ['👨‍💼 Live Chat với Admin CSKH', '🚚 Phí giao hàng & Freeship']
        };

      case 'PAYMENT_POLICY':
        return {
          replyText: '💳 **Hình thức thanh toán & Hóa đơn VAT**:\n1. **COD**: Thanh toán tiền mặt khi nhận hàng.\n2. **Ví điện tử**: MoMo & VNPay quét mã bảo mật.\n3. **Chuyển khoản VietQR**: Xác nhận tự động trong 3 giây.\n• **Hóa đơn điện tử (VAT)**: Sachweb có xuất hóa đơn VAT cho cá nhân và doanh nghiệp khi yêu cầu.',
          intent: 'PAYMENT_POLICY',
          suggestedChips: ['🎁 Mã giảm giá mới nhất', '👨‍💼 Live Chat với Admin CSKH']
        };

      case 'CART_INFO': {
        const books = this.bookService.allBooks() || [];
        const userCartItems = currentUser ? (this.cartService.userCarts() || []) : (this.cartService.carts() || []);

        if (userCartItems.length === 0) {
          return {
            replyText: '🛒 **Giỏ hàng của bạn hiện đang trống!**\nBạn chưa thêm sản phẩm nào vào giỏ hàng. Hãy lướt xem các danh mục sách hay và bấm *"Thêm vào giỏ"* nhé!',
            intent: 'CART_INFO',
            suggestedChips: ['📖 Tư vấn chọn sách hay', '🎁 Mã giảm giá mới nhất', '🚚 Phí giao hàng & Freeship']
          };
        }

        let cartTotalAmt = 0;
        let cartItemsCount = 0;
        let itemsListStr = '';

        userCartItems.forEach((item: any, idx: number) => {
          const targetId = item.productId || item.bookId || item.id;
          const book = books.find((b: any) => String(b.id) === String(targetId));
          const title = item.title || (book ? book.title : 'Cuốn sách');
          const qty = Number(item.quantity || 1);

          let unitPrice = 0;
          let lineTotal = 0;
          if (item.unitPrice && Number(item.unitPrice) > 0) {
            unitPrice = Number(item.unitPrice);
            lineTotal = item.price && Number(item.price) > unitPrice ? Number(item.price) : unitPrice * qty;
          } else if (item.price && Number(item.price) > 0) {
            const storedPrice = Number(item.price);
            if (qty > 1 && (book?.price ? storedPrice > book.price : true)) {
              lineTotal = storedPrice;
              unitPrice = lineTotal / qty;
            } else {
              unitPrice = storedPrice;
              lineTotal = unitPrice * qty;
            }
          } else if (book && book.price) {
            unitPrice = Number(book.price);
            lineTotal = unitPrice * qty;
          }

          cartTotalAmt += lineTotal;
          cartItemsCount += qty;
          itemsListStr += `${idx + 1}. 📖 **"${title}"** - Số lượng: **${qty}** | Đơn giá: ${unitPrice.toLocaleString('vi-VN')}đ ➔ Thành tiền: **${lineTotal.toLocaleString('vi-VN')}đ**\n`;
        });

        return {
          replyText: `🛒 **Thông tin Giỏ hàng hiện tại của bạn (${cartItemsCount} sản phẩm / ${userCartItems.length} loại sách)**:\n\n${itemsListStr}\n💳 **TỔNG TIỀN GIỎ HÀNG**: **${cartTotalAmt.toLocaleString('vi-VN')}đ**\n\n👉 *Bạn có thể nhập mã giảm giá tại bước Thanh toán để nhận thêm ưu đãi tiết kiệm nhé!*`,
          intent: 'CART_INFO',
          suggestedChips: ['🎁 Mã giảm giá mới nhất', '🏆 Mã giảm giá giảm nhiều nhất', '💳 Phương thức thanh toán']
        };
      }

      case 'PROMOTION': {
        const allPromos = this.promotionService.publicPromotions() || [];
        const activePromos = (allPromos.length > 0 ? allPromos : [
          { id: '1', code: 'SACHWEB10', name: 'Mã chào mừng Sachweb', description: 'Giảm 10% cho toàn bộ đơn hàng', discountType: 'PERCENT', discountValue: 10, minOrderValue: 0, maxDiscount: 50000, isActive: true, createdAt: '2026-01-01' },
          { id: '2', code: 'FREESHIP', name: 'Mã miễn phí vận chuyển', description: 'Freeship đơn từ 200k', discountType: 'FIXED', discountValue: 20000, minOrderValue: 200000, maxDiscount: 20000, isActive: true, createdAt: '2026-01-02' }
        ] as Promotion[]).filter(p => p.isActive !== false);

        const isNewestQuery = this.containsAny(cleanText, ['moi nhat', 'ma moi', 'voucher moi', 'code moi']);
        const isHighestQuery = this.containsAny(cleanText, ['giam nhieu nhat', 'hoi nhat', 'giam sau nhat', 'lon nhat', 'uu dai nhat']);

        let sortedLatest = [...activePromos].sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        const latest = sortedLatest[0];

        let sortedHighest = [...activePromos].sort((a, b) => {
          const valA = a.discountType === 'PERCENT' ? (a.maxDiscount || a.discountValue * 5000) : a.discountValue;
          const valB = b.discountType === 'PERCENT' ? (b.maxDiscount || b.discountValue * 5000) : b.discountValue;
          return valB - valA;
        });
        const highest = sortedHighest[0];

        if (isNewestQuery && latest) {
          const disc = latest.discountType === 'PERCENT' ? `Giảm ${latest.discountValue}%` : `Giảm ${(latest.discountValue || 0).toLocaleString('vi-VN')}đ`;
          const minOrd = latest.minOrderValue ? ` (Đơn từ ${latest.minOrderValue.toLocaleString('vi-VN')}đ)` : '';
          return {
            replyText: `🔥 **MÃ GIẢM GIÁ MỚI NHẤT TẠI SACHWEB**:\n\n• Mã: **${latest.code}**\n• Nội dung: ${latest.name || latest.description}\n• Ưu đãi: **${disc}**${minOrd}\n\n👉 *Nhập mã **${latest.code}** ở trang Thanh toán để nhận ngay ưu đãi nhé!*`,
            intent: 'PROMOTION',
            suggestedChips: ['🏆 Mã giảm giá giảm nhiều nhất', '🛒 Xem giỏ hàng của tôi', '📖 Tư vấn chọn sách hay']
          };
        }

        if (isHighestQuery && highest) {
          const disc = highest.discountType === 'PERCENT'
            ? `Giảm ${highest.discountValue}% (Tối đa ${(highest.maxDiscount || 0).toLocaleString('vi-VN')}đ)`
            : `Giảm ${(highest.discountValue || 0).toLocaleString('vi-VN')}đ`;
          const minOrd = highest.minOrderValue ? ` (Đơn từ ${highest.minOrderValue.toLocaleString('vi-VN')}đ)` : '';
          return {
            replyText: `🏆 **MÃ GIẢM GIÁ GIẢM NHIỀU NHẤT / HỜI NHẤT**:\n\n• Mã: **${highest.code}**\n• Nội dung: ${highest.name || highest.description}\n• Mức giảm: **${disc}**${minOrd}\n\n👉 *Hãy áp dụng mã **${highest.code}** để tiết kiệm chi phí tối đa cho đơn hàng nhé!*`,
            intent: 'PROMOTION',
            suggestedChips: ['🎁 Mã giảm giá mới nhất', '🛒 Xem giỏ hàng của tôi', '📖 Tư vấn chọn sách hay']
          };
        }

        let promoListText = activePromos.map((p, idx) => {
          const disc = p.discountType === 'PERCENT' ? `Giảm ${p.discountValue}%` : `Giảm ${(p.discountValue || 0).toLocaleString('vi-VN')}đ`;
          const minOrd = p.minOrderValue ? ` (Đơn từ ${p.minOrderValue.toLocaleString('vi-VN')}đ)` : '';
          return `${idx + 1}. Mã **${p.code}**: ${p.name || p.description} -> **${disc}**${minOrd}`;
        }).join('\n');

        let extraNote = '';
        if (latest) {
          const disc = latest.discountType === 'PERCENT' ? `${latest.discountValue}%` : `${latest.discountValue.toLocaleString('vi-VN')}đ`;
          extraNote += `\n🔥 **Mã mới nhất**: **${latest.code}** (${disc})`;
        }
        if (highest) {
          const disc = highest.discountType === 'PERCENT' ? `${highest.discountValue}% (tối đa ${(highest.maxDiscount || 0).toLocaleString('vi-VN')}đ)` : `${highest.discountValue.toLocaleString('vi-VN')}đ`;
          extraNote += `\n🏆 **Mã giảm sâu nhất**: **${highest.code}** (${disc})`;
        }

        return {
          replyText: `🎁 **Danh sách Mã Giảm Giá đang áp dụng tại Sachweb**:\n\n${promoListText}\n${extraNote}\n\n*(Nhập mã ở bước Thanh toán để nhận ưu đãi tự động nhé!)*`,
          intent: 'PROMOTION',
          suggestedChips: ['🔥 Mã giảm giá mới nhất', '🏆 Mã giảm giá giảm nhiều nhất', '🛒 Xem giỏ hàng của tôi']
        };
      }

      case 'EBOOK_GUIDE':
        return {
          replyText: '📚 **Ebook & Sách giấy tại Sachweb**:\n• **Ebook**: Đọc ngay sau khi mua tại mục **Tủ sách Ebook của tôi** trên trình duyệt/điện thoại.\n• **Sách giấy**: Đóng gói hộp chỉn chu và bưu tá giao hàng tận nơi.',
          intent: 'EBOOK_GUIDE',
          suggestedChips: ['📖 Tư vấn chọn sách hay', '🚚 Phí giao hàng & Freeship']
        };

      case 'GREETING': {
        const name = currentUser ? (currentUser.fullname || currentUser.username || 'bạn') : 'bạn';
        return {
          replyText: `👋 **Xin chào ${name}!** Sachweb rất hân hạnh được tư vấn hỗ trợ bạn.\n\nBạn cần Sachweb tư vấn về vấn đề gì ạ?\n1. 📖 Gợi ý & Tìm kiếm sách hay\n2. 📦 Tra cứu đơn hàng gần nhất\n3. 🚚 Phí giao hàng & Mã giảm giá\n4. 👨‍💼 Kết nối Live Chat với Admin CSKH`,
          intent: 'GREETING',
          suggestedChips: this.defaultChips
        };
      }
    }

    return {
      replyText: `🤖 **Sachweb AI Assistant**:\nCảm ơn câu hỏi của bạn! Để Sachweb tư vấn đúng nhất trọng tâm, bạn có thể gõ từ khóa chủ đề (ví dụ: *sách lịch sử, sách kinh tế, giá dưới 100k, phí ship, tra cứu đơn hàng*) hoặc chọn các nút gợi ý nhanh bên dưới nhé!\n\nNếu cần hỗ trợ riêng biệt, bạn bấm **"Live Chat với Admin CSKH"** để gặp trực tiếp nhân viên quản trị nhé!`,
      intent: 'GENERAL_FALLBACK',
      suggestedChips: this.defaultChips
    };
  }

  // =========================================================================
  // 4. SELF-CRITIQUE & VERIFICATION scoring (Mục 11)
  // =========================================================================
  private verifyAndRefineReply(candidate: BotReply, rawText: string, entity: ExtractedEntity): BotReply {
    const textClean = this.removeVietnameseTones(rawText.toLowerCase());

    // Verification check: If user asked for books or prices, BUT candidate gave order tracking: REJECT and FORCE book recommendation!
    const isBookOrPriceQuery =
      this.containsAny(textClean, ['sach', 'duoi', 'gia', 'khuyen mai', 're', 'sale', 'the loai', 'lich su', 'kinh te', 'tam ly', 'quan tri', 'van hoc']) ||
      (entity.maxPrice !== undefined && entity.maxPrice > 0);

    if (isBookOrPriceQuery && candidate.intent === 'TRACK_ORDER') {
      const books = this.findMatchingBooksHybrid(textClean, entity.maxPrice, entity.categories);
      if (books.length > 0) {
        let responseStr = '📖 **Gợi ý sách hay chuẩn yêu cầu dành cho bạn**:\n\n';
        books.forEach((b, idx) => {
          const priceStr = b.price ? b.price.toLocaleString('vi-VN') + 'đ' : 'Miễn phí';
          const discountStr = b.discount ? ` (Giảm ${b.discount})` : '';
          responseStr += `${idx + 1}. **${b.title}** - *${b.author || 'Sachweb'}*\n   👉 Giá: **${priceStr}**${discountStr}\n   📁 Danh mục: ${b.category || 'Ebook'}\n\n`;
        });
        responseStr += 'Bạn có thể gõ tên tác giả hoặc thể loại yêu thích để Sachweb tìm thêm cho bạn nhé!';

        return {
          replyText: responseStr,
          intent: 'RECOMMEND_BOOKS',
          suggestedChips: this.defaultChips
        };
      }
    }

    return candidate;
  }

  // =========================================================================
  // HYBRID RAG SEARCH OVER BOOKS (BM25 + Vector-like Matching & Reranking)
  // =========================================================================
  private findMatchingBooksHybrid(cleanQuery: string, maxPrice?: number, requestedCategories: string[] = []): any[] {
    const books = this.bookService.allBooks() || [];
    if (!books.length) return [];

    let filtered = books;

    // Filter by price limit if present
    if (maxPrice && maxPrice > 0) {
      filtered = filtered.filter((b) => (b.price || 0) <= maxPrice);
    }

    // Category match
    if (requestedCategories.length > 0) {
      filtered = filtered.filter((b) => {
        const cat = this.removeVietnameseTones((b.category || '').toLowerCase());
        const title = this.removeVietnameseTones((b.title || '').toLowerCase());
        return requestedCategories.some((tag) => {
          const tagClean = this.removeVietnameseTones(tag.toLowerCase());
          return cat.includes(tagClean) || title.includes(tagClean);
        });
      });
    }

    // BM25 / Reranking Score Calculation for each book
    const words = cleanQuery
      .split(' ')
      .filter((w) => w.length > 2 && !['sach', 'tim', 'cho', 'minh', 'muon', 'ban', 'co', 'duoi', '100k', '150k', '200k', '50k', '80k', '120k'].includes(w));

    if (words.length > 0) {
      const scoredBooks = (filtered.length > 0 ? filtered : books).map((b) => {
        let score = 0;
        const titleClean = this.removeVietnameseTones((b.title || '').toLowerCase());
        const authorClean = this.removeVietnameseTones((b.author || '').toLowerCase());
        const catClean = this.removeVietnameseTones((b.category || '').toLowerCase());

        words.forEach((w) => {
          if (titleClean.includes(w)) score += 3;
          if (authorClean.includes(w)) score += 2;
          if (catClean.includes(w)) score += 1;
        });

        if ((b as any).rating) score += (b as any).rating * 0.5;
        return { book: b, score };
      });

      scoredBooks.sort((a, b) => b.score - a.score);
      const topScored = scoredBooks.filter((sb) => sb.score > 0).map((sb) => sb.book);
      if (topScored.length > 0) {
        return topScored.slice(0, 3);
      }
    }

    return filtered.length > 0 ? filtered.slice(0, 3) : books.slice(0, 3);
  }

  private extractPriceLimit(cleanQuery: string, rawQuery: string): number {
    const matchK = rawQuery.match(/\b(\d+)\s*k\b/i);
    if (matchK) {
      const val = parseInt(matchK[1], 10);
      if (val > 0 && val < 5000) return val * 1000;
    }

    const matchDot = rawQuery.match(/\b(\d{2,3})\.000\b/);
    if (matchDot) {
      const val = parseInt(matchDot[1], 10);
      if (val > 0) return val * 1000;
    }

    if (cleanQuery.includes('duoi 50k') || cleanQuery.includes('50k')) return 50000;
    if (cleanQuery.includes('duoi 100k') || cleanQuery.includes('100k')) return 100000;
    if (cleanQuery.includes('duoi 150k') || cleanQuery.includes('150k')) return 150000;
    if (cleanQuery.includes('duoi 200k') || cleanQuery.includes('200k')) return 200000;
    if (cleanQuery.includes('duoi 300k') || cleanQuery.includes('300k')) return 300000;

    return 0;
  }

  private translateOrderStatus(status: string): string {
    if (!status) return '⚙️ Đang xử lý';
    const s = status.toLowerCase();
    if (s.includes('pending') || s.includes('cho') || s.includes('xac nhan')) return '⏳ Đang chờ xác nhận';
    if (s.includes('processing') || s.includes('xu ly') || s.includes('dong goi')) return '⚙️ Đang đóng gói xử lý';
    if (s.includes('shipped') || s.includes('van chuyen') || s.includes('giao')) return '🚚 Đang vận chuyển';
    if (s.includes('completed') || s.includes('hoan thanh') || s.includes('thanh cong')) return '✅ Đã giao thành công';
    if (s.includes('cancel') || s.includes('huy')) return '❌ Đã hủy đơn';
    return status;
  }

  private containsAny(text: string, keywords: string[]): boolean {
    return keywords.some((k) => text.includes(k));
  }

  private removeVietnameseTones(str: string): string {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  private getOrCreateMemory(sessionId: string): ConversationMemory {
    if (!this.sessionMemories.has(sessionId)) {
      this.sessionMemories.set(sessionId, { messages: [] });
    }
    return this.sessionMemories.get(sessionId)!;
  }

  private updateMemory(sessionId: string, entity: ExtractedEntity, userText: string, botText: string) {
    const mem = this.getOrCreateMemory(sessionId);
    mem.lastIntent = entity.intent;
    if (entity.categories.length > 0) mem.lastCategory = entity.categories[0];
    if (entity.maxPrice) mem.lastMaxPrice = entity.maxPrice;
    if (entity.orderCode) mem.lastOrderCode = entity.orderCode;

    mem.messages.push(
      { sender: 'user', text: userText, timestamp: new Date().toISOString() },
      { sender: 'bot', text: botText, timestamp: new Date().toISOString() }
    );

    // Keep short-term memory to 10 messages max
    if (mem.messages.length > 10) {
      mem.messages = mem.messages.slice(-10);
    }
  }
}
