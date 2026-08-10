const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Làm gọn log và che dữ liệu nhạy cảm trước khi in ra Terminal.
function sanitizeLogData(value, key = '') {
  const lowerKey = String(key).toLowerCase();
  const hiddenKeys = new Set([
    'password',
    'oldpassword',
    'newpassword',
    'confirmpassword',
    'otp',
    'apppassword',
    'token',
    'accesstoken',
    'refreshtoken'
  ]);

  if (hiddenKeys.has(lowerKey)) return '[ĐÃ ẨN]';
  if (lowerKey === 'db') {
    return `[DỮ LIỆU ĐÃ MÃ HÓA - ${String(value || '').length} ký tự]`;
  }
  if (typeof value === 'string' && value.startsWith('data:image')) {
    return `[ẢNH BASE64 - ${value.length} ký tự]`;
  }
  if (typeof value === 'string' && value.length > 500) {
    return `[DỮ LIỆU DÀI - ${value.length} ký tự]`;
  }
  if (Array.isArray(value)) {
    return value.map(item => sanitizeLogData(item));
  }
  if (value !== null && typeof value === 'object') {
    const safeObject = {};
    Object.keys(value).forEach(objectKey => {
      safeObject[objectKey] = sanitizeLogData(value[objectKey], objectKey);
    });
    return safeObject;
  }
  return value;
}

app.use((req, res, next) => {
  if (req.path === '/api/secure-db') {
    return next();
  }
  console.log(`[Request] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('[Request Body]', JSON.stringify(sanitizeLogData(req.body), null, 2));
  }

  const originalSend = res.send;
  res.send = function(body) {
    console.log(`[Response] ${res.statusCode} to ${req.method} ${req.path}`);
    if (res.statusCode >= 400) {
      let safeBody = body;
      try {
        safeBody = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (_) {
        safeBody = body;
      }
      console.log('[Response Body]', sanitizeLogData(safeBody));
    }
    return originalSend.apply(this, arguments);
  };
  next();
});

// Serve static files for uploaded avatars
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

const UPLOADS_DIR = path.join(__dirname, 'public/uploads/avatars');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function decrypt(data) {
  if (!data) return data;
  const trimmed = data.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return data;
  }
  try {
    const key = 'sachweb_secret_key_2026';
    const binary = Buffer.from(data, 'base64').toString('binary');
    const xorBytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      xorBytes[i] = binary.charCodeAt(i);
    }
    const keyBytes = Buffer.from(key, 'utf8');
    const dataBytes = new Uint8Array(xorBytes.length);
    for (let i = 0; i < xorBytes.length; i++) {
      dataBytes[i] = xorBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    return Buffer.from(dataBytes).toString('utf8');
  } catch (e) {
    console.error('Decryption error:', e);
    return data;
  }
}

function encrypt(data) {
  try {
    const key = 'sachweb_secret_key_2026';
    const dataBytes = Buffer.from(data, 'utf8');
    const keyBytes = Buffer.from(key, 'utf8');
    const xorBytes = new Uint8Array(dataBytes.length);
    for (let i = 0; i < dataBytes.length; i++) {
      xorBytes[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
    }
    let binary = '';
    for (let i = 0; i < xorBytes.length; i++) {
      binary += String.fromCharCode(xorBytes[i]);
    }
    return Buffer.from(binary, 'binary').toString('base64');
  } catch (e) {
    console.error('Encryption error:', e);
    return data;
  }
}

function saveBase64Image(base64Str, prefix, id) {
  if (!base64Str || !base64Str.startsWith('data:image')) {
    return base64Str;
  }
  try {
    const matches = base64Str.match(/^data:image\/([A-Za-z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Str;
    }
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const dataBuffer = Buffer.from(matches[2], 'base64');

    // Clean ID to avoid path traversal
    const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
    const filename = `${prefix}_${safeId}_${Date.now()}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);

    fs.writeFileSync(filePath, dataBuffer);
    return `http://localhost:3000/uploads/avatars/${filename}`;
  } catch (error) {
    console.error('Error saving base64 image:', error);
    return base64Str;
  }
}

const PORT = 3000;
const CONFIG_PATH = path.join(__dirname, 'config.json');

// Đọc cấu hình
function readConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.error('Error parsing config.json:', e);
    }
  }
  return {
    senderEmail: 'YOUR_GMAIL_HERE@gmail.com',
    appPassword: 'rclm hzyd sfow sswf',
    geminiApiKey: ''
  };
}

// =========================================================================
// REAL-TIME LIVE CHAT CENTRALIZED SYNC API
// =========================================================================
app.get('/api/chat/sync', (req, res) => {
  try {
    const canonicalDb = readJsonFileSafe(CANONICAL_DB_PATH);
    const sessions = Array.isArray(canonicalDb.chat_sessions_v1) ? canonicalDb.chat_sessions_v1 : [];
    const messages = Array.isArray(canonicalDb.chat_messages_v1) ? canonicalDb.chat_messages_v1 : [];
    return res.status(200).json({ success: true, sessions, messages });
  } catch (err) {
    return res.status(500).json({ success: false, sessions: [], messages: [] });
  }
});

app.post('/api/chat/sync', (req, res) => {
  try {
    const { sessions, messages } = req.body;
    const canonicalDb = readJsonFileSafe(CANONICAL_DB_PATH);

    if (Array.isArray(sessions) && sessions.length > 0) {
      canonicalDb.chat_sessions_v1 = sessions;
    }
    if (Array.isArray(messages) && messages.length > 0) {
      canonicalDb.chat_messages_v1 = messages;
    }

    fs.writeFileSync(CANONICAL_DB_PATH, JSON.stringify(canonicalDb, null, 2), 'utf8');
    mirrorCanonicalDatabase();

    return res.status(200).json({
      success: true,
      sessions: canonicalDb.chat_sessions_v1,
      messages: canonicalDb.chat_messages_v1
    });
  } catch (err) {
    console.error('[Chat Sync Post Error]:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =========================================================================
// API CHATBOT GEMINI PRO ENTERPRISE SERVICE
// =========================================================================
app.post('/api/ai-chat', async (req, res) => {
  try {
    const { userMessage, currentUser, userProfileContext, cartContext, wishlistContext, booksContext, ordersContext, userHistory } = req.body;
    if (!userMessage || !userMessage.trim()) {
      return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được để trống.' });
    }

    const config = readConfig();
    const apiKey = (config.geminiApiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!apiKey) {
      return res.status(200).json({
        success: false,
        useFallback: true,
        message: 'Chưa cấu hình geminiApiKey trong email-server/config.json'
      });
    }

    // 1. Build Rich Books Context
    let booksSummary = 'Chưa có thông tin sách.';
    if (Array.isArray(booksContext) && booksContext.length > 0) {
      booksSummary = booksContext
        .slice(0, 35) // Top 35 books catalog
        .map((b, i) => `${i + 1}. "${b.title}" - Tác giả: ${b.author || 'Sachweb'} | Thể loại: ${b.category || 'Khác'} | Giá: ${(b.price || 0).toLocaleString('vi-VN')}đ ${b.discount ? '(Giảm ' + b.discount + ')' : ''} | Đánh giá: ${b.rating || 5}/5 ⭐ | Mô tả: ${b.description ? b.description.substring(0, 100) + '...' : 'Không có'}`)
        .join('\n');
    }

    // 2. Build Orders Context
    let ordersSummary = 'Khách hàng chưa có đơn hàng nào hoặc chưa đăng nhập.';
    if (Array.isArray(ordersContext) && ordersContext.length > 0) {
      ordersSummary = ordersContext
        .slice(0, 5)
        .map((o) => {
          const itemsStr = Array.isArray(o.items) && o.items.length > 0
            ? o.items.map((i) => `"${i.title}" (x${i.quantity || 1})`).join(', ')
            : 'Không có chi tiết sản phẩm';
          return `• Mã đơn: #${o.orderCode || o.id} | Ngày đặt: ${o.createdAt ? new Date(o.createdAt).toLocaleDateString('vi-VN') : 'Gần đây'} | Tổng tiền: ${(o.totalAmount || o.total || 0).toLocaleString('vi-VN')}đ | Trạng thái: ${o.status || 'Đang xử lý'} | Các sách trong đơn: [${itemsStr}]`;
        })
        .join('\n');
    }

    // 3. Build Cart Context
    let cartSummary = 'Giỏ hàng của khách đang trống.';
    if (cartContext) {
      const itemsListArr = Array.isArray(cartContext.items) ? cartContext.items : (Array.isArray(cartContext) ? cartContext : []);
      if (itemsListArr.length > 0) {
        let calculatedTotal = 0;
        const formattedItems = itemsListArr.map((item, i) => {
          const qty = item.quantity || 1;
          const unitPrice = item.price || 0;
          const lineTotal = item.itemTotal || (unitPrice * qty);
          calculatedTotal += lineTotal;
          return `${i + 1}. "${item.title || 'Sách'}" - Tác giả: ${item.author || 'Sachweb'} | Số lượng: ${qty} | Đơn giá: ${unitPrice.toLocaleString('vi-VN')}đ | Thành tiền: ${lineTotal.toLocaleString('vi-VN')}đ`;
        }).join('\n');

        const grandTotal = (cartContext.totalAmount !== undefined ? cartContext.totalAmount : calculatedTotal).toLocaleString('vi-VN');
        const totalCount = cartContext.totalItems || itemsListArr.reduce((acc, it) => acc + (it.quantity || 1), 0);
        cartSummary = `• TỔNG SỐ SẢN PHẨM TRONG GIỎ: ${totalCount} cuốn\n• TỔNG TIỀN GIỎ HÀNG: ${grandTotal}đ\n• Danh sách chi tiết các cuốn sách trong giỏ:\n${formattedItems}`;
      }
    }

    // 4. Build Wishlist / Collection Context
    let wishlistSummary = 'Bộ sưu tập sách yêu thích của khách đang trống.';
    if (Array.isArray(wishlistContext) && wishlistContext.length > 0) {
      wishlistSummary = wishlistContext
        .map((item, i) => `${i + 1}. "${item.title}" - Tác giả: ${item.author || 'Sachweb'} | Thể loại: ${item.category || 'Khác'} | Giá: ${(item.price || 0).toLocaleString('vi-VN')}đ`)
        .join('\n');
    }

    // 5. Build User Profile Summary
    let userProfileSummary = 'Khách chưa đăng nhập (Khách vãng lai)';
    if (userProfileContext) {
      userProfileSummary = `• Họ tên: ${userProfileContext.fullname}\n• Email: ${userProfileContext.email}\n• Số điện thoại: ${userProfileContext.phone}\n• Cấp độ tài khoản: ${userProfileContext.role}`;
    }

    // 6. Build Rich Dynamic Promotions Summary (Mã mới nhất & giảm nhiều nhất)
    const { promotionsContext } = req.body;
    let promotionsSummary = 'Các mã giảm giá hiện có tại Sachweb.vn:\n• SACHWEB10: Giảm 10% cho mọi đơn hàng\n• FREESHIP: Miễn phí vận chuyển cho đơn hàng từ 200.000đ';
    if (promotionsContext) {
      const activeList = Array.isArray(promotionsContext.activePromotions) ? promotionsContext.activePromotions : [];
      let listStr = '';
      if (activeList.length > 0) {
        listStr = activeList.map((p, i) => {
          const disc = p.discountType === 'PERCENT'
            ? `Giảm ${p.discountValue}% (tối đa ${(p.maxDiscount || 0).toLocaleString('vi-VN')}đ)`
            : `Giảm ${(p.discountValue || 0).toLocaleString('vi-VN')}đ`;
          const minVal = p.minOrderValue ? ` | Đơn từ ${(p.minOrderValue).toLocaleString('vi-VN')}đ` : '';
          return `${i + 1}. Mã **${p.code}**: ${p.name || p.description} -> ${disc}${minVal}`;
        }).join('\n');
      }

      let latestStr = '';
      if (promotionsContext.latestPromotion) {
        const lp = promotionsContext.latestPromotion;
        const disc = lp.discountType === 'PERCENT' ? `Giảm ${lp.discountValue}%` : `Giảm ${(lp.discountValue || 0).toLocaleString('vi-VN')}đ`;
        latestStr = `🔥 MÃ GIẢM GIÁ MỚI NHẤT: Mã **${lp.code}** (${lp.name} - ${disc})`;
      }

      let highestStr = '';
      if (promotionsContext.highestDiscountPromotion) {
        const hp = promotionsContext.highestDiscountPromotion;
        const disc = hp.discountType === 'PERCENT'
          ? `Giảm ${hp.discountValue}% (tối đa ${(hp.maxDiscount || 0).toLocaleString('vi-VN')}đ)`
          : `Giảm ${(hp.discountValue || 0).toLocaleString('vi-VN')}đ`;
        highestStr = `🏆 MÃ GIẢM GIÁ GIẢM NHIỀU NHẤT / HỜI NHẤT: Mã **${hp.code}** (${hp.name} - ${disc})`;
      }

      promotionsSummary = `${latestStr ? latestStr + '\n' : ''}${highestStr ? highestStr + '\n' : ''}\nDANH SÁCH TẤT CẢ MÃ GIẢM GIÁ ĐANG ÁP DỤNG:\n${listStr || '• Mã SACHWEB10: Giảm 10%\n• Mã FREESHIP: Miễn ship đơn từ 200k'}`;
    }

    const userName = userProfileContext ? userProfileContext.fullname : (currentUser ? (currentUser.fullname || currentUser.username || 'Khách hàng') : 'Khách hàng');

    const systemInstruction = `Bạn là Trợ Lý AI Chuyên Gia Tư Vấn Bán Sách & CSKH Cao Cấp của Hệ Thống Nhà Sách Sachweb.vn.
Nhiệm vụ của bạn:
1. Tư vấn chọn sách tận tâm, lịch sự, am hiểu sâu sắc về tâm lý đọc sách, độ tuổi và nhu cầu độc giả.
2. CHỈ ĐƯỢC GỢI Ý các cuốn sách CÓ THỰC trong DỮ LIỆU KHO SÁCH bên dưới. Không được tự bịa ra sách không có trong danh sách.
3. Khi khách hỏi về GIỎ HÀNG hoặc TỔNG TIỀN GIỎ HÀNG, hãy trả lời chính xác số lượng sản phẩm, từng cuốn sách và TỔNG TIỀN GIỎ HÀNG từ dữ liệu bên dưới.
4. Khi khách hỏi về MÃ GIẢM GIÁ MỚI NHẤT hoặc MÃ GIẢM GIÁ GIẢM NHIỀU NHẤT / HỜI NHẤT, hãy trả lời chính xác thông tin từ DỮ LIỆU MÃ GIẢM GIÁ bên dưới.
5. Khi khách hỏi về THÔNG TIN TÀI KHOẢN, BỘ SƯU TẬP YÊU THÍCH hay ĐƠN HÀNG, hãy tra cứu dữ liệu cá nhân của chính tài khoản (${userName}) bên dưới để trả lời chính xác 100%.
6. Trả lời bằng tiếng Việt chuẩn, định dạng Markdown đẹp mắt (bôi đậm, danh sách bullet point, dùng emoji 📖, 🛒, ❤️, 📦, 🚚, 💳, ⭐, 🎁, 🔥, 🏆).
7. Cuối câu trả lời, chủ động gợi ý khách chọn thêm thể loại hoặc nhắn "Live Chat với Admin" nếu cần gặp người thật.

--- THÔNG TIN TÀI KHOẢN NGUYÊN BẢN CỦA KHÁCH (${userName}) ---
${userProfileSummary}

--- GIỎ HÀNG & TỔNG TIỀN HIỆN TẠI CỦA KHÁCH ---
${cartSummary}

--- DỮ LIỆU MÃ GIẢM GIÁ & ƯU ĐÃI (MỚI NHẤT & GIẢM NHIỀU NHẤT) ---
${promotionsSummary}

--- BỘ SƯU TẬP SÁCH YÊU THÍCH (WISHLIST) CỦA KHÁCH ---
${wishlistSummary}

--- LỊCH SỬ ĐƠN HÀNG CỦA KHÁCH ---
${ordersSummary}

--- DỮ LIỆU KHO SÁCH THỰC TẾ (SACHWEB.VN) ---
${booksSummary}

--- THÔNG TIN CỬA HÀNG & CHÍNH SÁCH ---
• Địa chỉ: Tòa nhà Sachweb Building, Q. 1, TP. Hồ Chí Minh
• Hotline: 1900 6789 (8h00 - 21h00)
• Phí ship: FREESHIP cho đơn từ 300.000đ. Phí ship HCM 20k, Tỉnh khác 30k.
• Đổi trả: 1 đổi 1 miễn phí trong 7 ngày nếu lỗi in ấn, hư hỏng.`;

    // Candidate Gemini Models list (try best working models first)
    const models = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash-lite', 'gemini-pro-latest', 'gemini-2.0-flash'];
    let geminiResponseText = null;
    let lastError = null;

    // Chat history conversion
    const formattedHistory = Array.isArray(userHistory)
      ? userHistory.slice(-6).map((h) => ({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        }))
      : [];

    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: userMessage }]
      }
    ];

    for (const modelName of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const fetchResp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            contents,
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048
            }
          })
        });

        if (fetchResp.ok) {
          const data = await fetchResp.json();
          if (data.candidates && data.candidates[0] && data.candidates[0].content && Array.isArray(data.candidates[0].content.parts)) {
            const fullText = data.candidates[0].content.parts.map((p) => p.text || '').join('');
            if (fullText && fullText.trim().length > 0) {
              geminiResponseText = fullText.trim();
              console.log(`[Gemini AI Success] Responded using model: ${modelName} (${geminiResponseText.length} chars)`);
              break;
            }
          }
        } else {
          const errData = await fetchResp.text();
          console.warn(`[Gemini Model ${modelName} Warning]:`, fetchResp.status, errData);
          lastError = errData;
        }
      } catch (err) {
        console.error(`[Gemini Call Exception ${modelName}]:`, err.message);
        lastError = err.message;
      }
    }

    if (geminiResponseText) {
      return res.status(200).json({
        success: true,
        replyText: geminiResponseText,
        suggestedChips: [
          '📖 Tư vấn chọn sách hay',
          '📦 Tra cứu đơn hàng gần đây',
          '🚚 Phí giao hàng & Freeship',
          '🎁 Mã giảm giá mới nhất',
          '👨‍💼 Live Chat với Admin CSKH'
        ]
      });
    }

    return res.status(200).json({
      success: false,
      useFallback: true,
      error: lastError || 'Không thể kết nối dịch vụ Gemini AI API.'
    });
  } catch (error) {
    console.error('[AI Chat Route Error]:', error);
    return res.status(500).json({ success: false, useFallback: true, message: error.message });
  }
});

app.post('/api/send-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email và mã OTP là bắt buộc.' });
  }

  const config = readConfig();
  if (!config.senderEmail || config.senderEmail.includes('YOUR_GMAIL_HERE')) {
    return res.status(500).json({
      success: false,
      message: 'Cấu hình Email gửi chưa được thiết lập. Vui lòng cập nhật email của bạn trong file email-server/config.json!'
    });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.senderEmail,
      pass: config.appPassword
    }
  });

  const mailOptions = {
    from: `"Sachweb.vn Support" <${config.senderEmail}>`,
    to: email,
    subject: 'Mã xác thực đặt lại mật khẩu - Sachweb.vn',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #121212; margin: 0;">SACHWEB.VN</h2>
          <p style="color: #c5a880; font-size: 14px; margin: 5px 0 0 0; font-weight: bold; letter-spacing: 1px;">HỆ THỐNG PHỤC HỒI MẬT KHẨU</p>
        </div>
        <div style="border-top: 3px solid #c5a880; padding-top: 20px; color: #1e293b; line-height: 1.6;">
          <p>Xin chào,</p>
          <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với địa chỉ email này trên hệ thống <strong>Sachweb.vn</strong>.</p>
          <p>Dưới đây là mã xác thực OTP của bạn. Mã này có hiệu lực trong vòng <strong>5 phút</strong>:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #121212; letter-spacing: 8px; background-color: #f5f4f0; padding: 12px 24px; border-radius: 8px; border: 1px dashed #c5a880;">
              ${otp}
            </span>
          </div>
          <p>Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này hoặc liên hệ với bộ phận hỗ trợ khách hàng của chúng tôi để bảo vệ tài khoản.</p>
          <br>
          <p style="margin: 0;">Trân trọng,</p>
          <p style="font-weight: bold; color: #121212; margin: 5px 0 0 0;">Đội ngũ hỗ trợ Sachweb.vn</p>
        </div>
        <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
          <p>Đây là email tự động, vui lòng không trả lời trực tiếp email này.</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Success] OTP ${otp} sent successfully to ${email}`);
    res.status(200).json({ success: true, message: 'Đã gửi mã OTP thành công!' });
  } catch (error) {
    console.error('[Error] Send mail failed:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể gửi email. Chi tiết lỗi: ' + error.message
    });
  }
});

app.post('/api/send-reply', async (req, res) => {
  const { email, fullName, subject, originalMessage, replyContent } = req.body;
  if (!email || !replyContent) {
    return res.status(400).json({ success: false, message: 'Email người nhận và nội dung phản hồi là bắt buộc.' });
  }

  const config = readConfig();
  if (!config.senderEmail || config.senderEmail.includes('YOUR_GMAIL_HERE')) {
    return res.status(500).json({
      success: false,
      message: 'Cấu hình Email gửi chưa được thiết lập. Vui lòng cập nhật email của bạn trong file email-server/config.json!'
    });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.senderEmail,
      pass: config.appPassword
    }
  });

  const mailOptions = {
    from: `"Sachweb Support" <${config.senderEmail}>`,
    to: email,
    subject: `[Sachweb] Phản hồi liên hệ: ${subject || 'Hỗ trợ khách hàng'}`,
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center; margin-bottom: 25px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px;">
          <h2 style="color: #121212; margin: 0; font-size: 24px; letter-spacing: 2px;">SACHWEB</h2>
          <p style="color: #c5a880; font-size: 12px; margin: 5px 0 0 0; font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">Hộp thư hỗ trợ & chăm sóc khách hàng</p>
        </div>
        <div style="color: #334155; line-height: 1.6; font-size: 15px;">
          <p>Kính gửi <strong>${fullName || 'Quý khách'}</strong>,</p>
          <p>Cảm ơn bạn đã gửi ý kiến đóng góp thông qua hòm thư hỗ trợ của Sachweb. Chúng tôi xin phản hồi về liên hệ của bạn như sau:</p>
          
          <div style="background-color: #faf9f6; border-left: 4px solid #c5a880; padding: 16px; border-radius: 6px; margin: 20px 0; font-style: italic; color: #1e293b; font-weight: 500;">
            "${replyContent}"
          </div>
          
          <div style="font-size: 13px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 15px; margin-top: 20px;">
            <strong style="display: block; margin-bottom: 5px; color: #475569;">Nội dung bạn đã gửi:</strong>
            <blockquote style="margin: 0; padding-left: 12px; border-left: 2px solid #cbd5e1; font-style: italic;">
              "${originalMessage || ''}"
            </blockquote>
          </div>
          
          <br>
          <p style="margin: 0;">Trân trọng,</p>
          <p style="font-weight: bold; color: #121212; margin: 5px 0 0 0;">Đội ngũ CSKH Sachweb</p>
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">Email: support@sachweb.vn | Hotline: 1900-8888</p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Success] Reply email sent successfully to ${email}`);
    res.status(200).json({ success: true, message: 'Đã gửi email phản hồi thành công!' });
  } catch (error) {
    console.error('[Error] Reply email sending failed:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể gửi email phản hồi. Chi tiết lỗi: ' + error.message
    });
  }
});

// POST /emails - Intercept json-server's /emails to actually send a real email
app.post('/emails', async (req, res, next) => {
  const { toEmail, recipientName, subject, htmlContent } = req.body;
  if (!toEmail) {
    return next(); // Let json-server handle validation or default behavior
  }

  const config = readConfig();
  if (!config.senderEmail || config.senderEmail.includes('YOUR_GMAIL_HERE')) {
    console.warn('[Warning] Email sender config is not set. Skipping real email sending.');
    req.body.status = 'Thất bại';
    return next();
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.senderEmail,
      pass: config.appPassword
    }
  });

  const mailOptions = {
    from: `"Sachweb.vn Bookstore" <${config.senderEmail}>`,
    to: toEmail,
    subject: subject || 'Thông tin từ Sachweb.vn',
    html: htmlContent
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[Success] Real email successfully sent to ${toEmail}`);
    req.body.status = 'Thành công';
  } catch (error) {
    console.error('[Error] Real email sending failed:', error);
    req.body.status = 'Thất bại';
  }

  // Continue to json-server so it is stored in db.json
  next();
});


const DB_FILE_PATH = path.join(__dirname, 'secure_db.txt');

const CANONICAL_DB_PATH = path.resolve(__dirname, '..', 'db.json');
const LEGACY_DB_PATH = path.join(__dirname, 'db.json');

function readJsonFileSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8').trim();
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error(`[Database] Không thể đọc ${filePath}:`, error);
    return {};
  }
}

function getRecordKey(resourceName, item, index) {
  if (resourceName === 'orders' && item?.orderCode) {
    return `orderCode:${String(item.orderCode)}`;
  }
  if (item && item.id !== undefined && item.id !== null) {
    return `id:${String(item.id)}`;
  }
  if (item?.email) {
    return `email:${String(item.email).trim().toLowerCase()}`;
  }
  return `index:${index}:${JSON.stringify(item)}`;
}

function mergeResourceArrays(resourceName, first = [], second = []) {
  const merged = new Map();
  [...first, ...second].forEach((item, index) => {
    merged.set(getRecordKey(resourceName, item, index), item);
  });
  return Array.from(merged.values());
}

function normalizeLegacyOrders(db) {
  const customers = Array.isArray(db.customers) ? db.customers : [];
  const orders = Array.isArray(db.orders) ? db.orders : [];

  const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

  orders.forEach((order) => {
    const accountEmail = normalizeEmail(order.accountEmail);
    const shippingEmail = normalizeEmail(order.email);
    const currentUserId = String(order.userId ?? order.customerId ?? '');

    let customer = customers.find((item) => String(item.id) === currentUserId);
    if (!customer && accountEmail) {
      customer = customers.find((item) => normalizeEmail(item.email) === accountEmail);
    }
    if (!customer && shippingEmail) {
      customer = customers.find((item) => normalizeEmail(item.email) === shippingEmail);
    }

    if (customer) {
      order.userId = String(customer.id);
      order.customerId = String(customer.id);
      order.accountEmail = normalizeEmail(customer.email);
    } else if (!accountEmail && shippingEmail) {
      // Dữ liệu đơn cũ chưa có accountEmail: dùng email đặt hàng làm khóa dự phòng.
      order.accountEmail = shippingEmail;
    }
  });
}

function prepareCanonicalDatabase() {
  const rootDb = readJsonFileSafe(CANONICAL_DB_PATH);
  const legacyDb = readJsonFileSafe(LEGACY_DB_PATH);
  const merged = {};
  const keys = new Set([...Object.keys(rootDb), ...Object.keys(legacyDb)]);

  keys.forEach((key) => {
    const rootValue = rootDb[key];
    const legacyValue = legacyDb[key];
    if (Array.isArray(rootValue) || Array.isArray(legacyValue)) {
      // File db.json ở thư mục gốc là nguồn dữ liệu chính.
      // Dữ liệu legacy chỉ bổ sung các bản ghi còn thiếu, tuyệt đối không được
      // ghi đè mật khẩu/thông tin mới hơn trong nguồn chính khi khởi động lại server.
      merged[key] = mergeResourceArrays(
        key,
        Array.isArray(legacyValue) ? legacyValue : [],
        Array.isArray(rootValue) ? rootValue : []
      );
    } else {
      merged[key] = legacyValue !== undefined ? legacyValue : rootValue;
    }
  });

  // Bảo đảm các tài nguyên cốt lõi luôn tồn tại.
  ['books', 'users', 'employees', 'customers', 'orders', 'carts', 'wishlist', 'emails', 'promotions', 'promotionUsages'].forEach((key) => {
    if (!Array.isArray(merged[key])) merged[key] = [];
  });
  if (!Array.isArray(merged.cart)) merged.cart = [];

  normalizeLegacyOrders(merged);

  fs.writeFileSync(CANONICAL_DB_PATH, JSON.stringify(merged, null, 2), 'utf8');
  fs.writeFileSync(LEGACY_DB_PATH, JSON.stringify(merged, null, 2), 'utf8');

  console.log(`[Database] Nguồn dữ liệu chính: ${CANONICAL_DB_PATH}`);
  console.log(`[Database] Đã đồng bộ bản sao: ${LEGACY_DB_PATH}`);
}

function mirrorCanonicalDatabase() {
  try {
    if (!fs.existsSync(CANONICAL_DB_PATH)) return;
    fs.copyFileSync(CANONICAL_DB_PATH, LEGACY_DB_PATH);
  } catch (error) {
    console.error('[Database] Không thể đồng bộ bản sao db.json:', error);
  }
}

// GET secure database string
app.get('/api/secure-db', (req, res) => {
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const data = fs.readFileSync(DB_FILE_PATH, 'utf8');
      return res.status(200).json({ success: true, db: data });
    } catch (e) {
      console.error('Error reading secure_db.txt:', e);
      return res.status(500).json({ success: false, message: 'Lỗi đọc database file.' });
    }
  }
  return res.status(200).json({ success: true, db: '' });
});

//Post thêm dữ liệu vào secure_db.txt
app.post('/api/secure-db', (req, res) => {
  const { db } = req.body;
  if (db === undefined) {
    return res.status(400).json({ success: false, message: 'Dữ liệu db trống.' });
  }
  try {
    const decrypted = decrypt(db);
    const parsedDb = JSON.parse(decrypted);
    let modified = false;

    if (parsedDb.customer) {
      parsedDb.customer.forEach(customer => {
        if (customer.avatar && customer.avatar.startsWith('data:image')) {
          customer.avatar = saveBase64Image(customer.avatar, 'customer', customer.id);
          modified = true;
        }
      });
    }

    if (parsedDb.currentUser) {
      if (parsedDb.currentUser.avatar && parsedDb.currentUser.avatar.startsWith('data:image')) {
        parsedDb.currentUser.avatar = saveBase64Image(parsedDb.currentUser.avatar, 'current_user', parsedDb.currentUser.id);
        modified = true;
      }
    }

    if (parsedDb.employees) {
      parsedDb.employees.forEach(employee => {
        if (employee.image && employee.image.startsWith('data:image')) {
          employee.image = saveBase64Image(employee.image, 'employee', employee.id);
          modified = true;
        }
      });
    }

    const orderListSecure = parsedDb.order || parsedDb.orders;
    if (orderListSecure && Array.isArray(orderListSecure)) {
      orderListSecure.forEach(order => {
        if (order.paymentReceipt && order.paymentReceipt.startsWith('data:image')) {
          order.paymentReceipt = saveBase64Image(order.paymentReceipt, 'receipt', order.orderCode || order.id || 'upload');
          modified = true;
        }
      });
    }

    const finalDb = modified ? encrypt(JSON.stringify(parsedDb)) : db;
    fs.writeFileSync(DB_FILE_PATH, finalDb, 'utf8');
    return res.status(200).json({ success: true, message: 'Đã lưu database thành công!' });
  } catch (e) {
    console.error('Error writing secure_db.txt:', e);
    try {
      fs.writeFileSync(DB_FILE_PATH, db, 'utf8');
      return res.status(200).json({ success: true, message: 'Đã lưu database thành công!' });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Lỗi ghi database file.' });
    }
  }
});

// Run database migration to clean up base64 image strings from db.json and secure_db.txt
runMigration();

// Hợp nhất dữ liệu cũ và chuyển toàn bộ hệ thống về đúng một nguồn dữ liệu.
prepareCanonicalDatabase();

// Import và thêm jsonserver
const jsonServer = require('json-server');
const jsonRouter = jsonServer.router(CANONICAL_DB_PATH);


const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const cloneState = (state) => JSON.parse(JSON.stringify(state));

function getNextOrderId(orders) {
  const maxId = orders.reduce((max, order) => {
    const numericId = Number(order.id);
    return Number.isFinite(numericId) ? Math.max(max, numericId) : max;
  }, 0);
  return maxId + 1;
}

function findOrderById(orders, rawId) {
  const id = String(rawId);
  return orders.find((order) => String(order.id) === id);
}

function persistDatabaseState(state) {
  jsonRouter.db.setState(state).write();
  mirrorCanonicalDatabase();
}

/**
 * Xóa chính xác một bản ghi theo id mà KHÔNG dùng cơ chế cascade của json-server.
 *
 * json-server 0.17 tự quét toàn bộ database sau mỗi DELETE. Các đơn khách hàng
 * có userId dạng cus7/cus8 bị hiểu nhầm là khóa ngoại đến bảng users, nên khi
 * xóa một đơn nó có thể xóa thêm toàn bộ các đơn khách hàng khác. Hàm này chỉ
 * splice đúng một phần tử rồi ghi lại database chính và bản sao.
 */
function deleteSingleRecordSafely(resourceName, rawId) {
  const state = cloneState(jsonRouter.db.getState());
  const collection = state[resourceName];

  if (!Array.isArray(collection)) {
    return { found: false, reason: 'RESOURCE_NOT_FOUND' };
  }

  const targetId = String(rawId);
  const index = collection.findIndex(item => String(item?.id) === targetId);
  if (index === -1) {
    return { found: false, reason: 'RECORD_NOT_FOUND' };
  }

  const beforeCount = collection.length;
  const [deletedRecord] = collection.splice(index, 1);

  // Bảo vệ chống lỗi lập trình khiến nhiều bản ghi bị xóa ngoài ý muốn.
  if (collection.length !== beforeCount - 1) {
    throw new Error(`Safe delete validation failed for ${resourceName}/${targetId}.`);
  }

  persistDatabaseState(state);

  const persistedCollection = jsonRouter.db.getState()[resourceName];
  if (!Array.isArray(persistedCollection) || persistedCollection.length !== beforeCount - 1) {
    throw new Error(`Database verification failed after deleting ${resourceName}/${targetId}.`);
  }

  return { found: true, deletedRecord };
}

function findCustomerRecord(state, rawId, rawEmail) {
  const customers = Array.isArray(state.customers) ? state.customers : [];
  const id = String(rawId || '').trim();
  const email = normalizeEmail(rawEmail);

  if (id) {
    const byId = customers.find(customer => String(customer.id) === id);
    if (byId) return byId;
  }

  if (email) {
    return customers.find(customer => normalizeEmail(customer.email) === email) || null;
  }

  return null;
}

function nextCustomerId(customers) {
  let max = 0;
  customers.forEach(customer => {
    const match = String(customer.id || '').match(/^cus(\d+)$/i);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `cus${max + 1}`;
}

function syncCustomersToSecureDb(customers) {
  try {
    let secureDb = {};
    if (fs.existsSync(DB_FILE_PATH)) {
      const raw = fs.readFileSync(DB_FILE_PATH, 'utf8').trim();
      if (raw) secureDb = JSON.parse(decrypt(raw));
    }
    secureDb.customer = customers;
    delete secureDb.customers;
    fs.writeFileSync(DB_FILE_PATH, encrypt(JSON.stringify(secureDb)), 'utf8');
  } catch (error) {
    // secure_db chỉ là bộ nhớ tương thích cũ; lỗi đồng bộ ở đây không được
    // phép làm hỏng nguồn dữ liệu chính db.json.
    console.error('[Customers] Không thể đồng bộ secure_db.txt:', error);
  }
}

function persistCustomerState(state) {
  persistDatabaseState(state);
  syncCustomersToSecureDb(state.customers || []);
}

function customerResponse(customer) {
  return { success: true, customer };
}

function repairCustomerFlags(state) {
  state.customers = Array.isArray(state.customers) ? state.customers : [];
  let changed = false;

  state.customers.forEach(customer => {
    // Lỗi cũ từng đánh dấu tài khoản thường là Google nhưng vẫn còn mật khẩu.
    // Có mật khẩu cục bộ đồng nghĩa đây không phải tài khoản Google-only.
    if (customer.isGoogleAccount === true && String(customer.password || '').length > 0) {
      customer.isGoogleAccount = false;
      changed = true;
    }
  });

  if (changed) persistCustomerState(state);
}

repairCustomerFlags(cloneState(jsonRouter.db.getState()));

app.get('/api/customers/health', (req, res) => {
  const state = jsonRouter.db.getState();
  return res.status(200).json({
    success: true,
    version: 'customers-canonical-v4',
    database: CANONICAL_DB_PATH,
    customers: Array.isArray(state.customers) ? state.customers.length : 0
  });
});

app.get('/api/customers/account', (req, res) => {
  const state = jsonRouter.db.getState();
  const customer = findCustomerRecord(state, req.query.id, req.query.email);
  if (!customer) {
    return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản khách hàng.' });
  }
  return res.status(200).json(customerResponse(customer));
});

app.post('/api/customers/register', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.customers = Array.isArray(state.customers) ? state.customers : [];

    const email = normalizeEmail(req.body.email);
    const username = String(req.body.username || email.split('@')[0] || '').trim();
    const password = String(req.body.password || '');

    if (!email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Email, tên đăng nhập và mật khẩu là bắt buộc.' });
    }

    const duplicate = state.customers.find(customer =>
      normalizeEmail(customer.email) === email ||
      String(customer.username || '').trim().toLowerCase() === username.toLowerCase()
    );
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Email hoặc tên đăng nhập này đã được đăng ký sử dụng!' });
    }

    const customer = {
      id: nextCustomerId(state.customers),
      username,
      password,
      fullname: String(req.body.fullname || req.body.name || 'Khách hàng').trim(),
      email,
      phone: String(req.body.phone || '').trim(),
      address: String(req.body.address || '').trim(),
      role: 'customer',
      islocked: false,
      isGoogleAccount: false,
      gender: req.body.gender || 'nam',
      dob: req.body.dob || '',
      avatar: req.body.avatar || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.customers.push(customer);
    persistCustomerState(state);
    return res.status(201).json(customerResponse(customer));
  } catch (error) {
    console.error('[Customers] Lỗi đăng ký:', error);
    return res.status(500).json({ success: false, message: 'Không thể lưu tài khoản khách hàng.' });
  }
});

app.post('/api/customers/google-login', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.customers = Array.isArray(state.customers) ? state.customers : [];
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || 'Người dùng Google').trim();

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email Google không hợp lệ.' });
    }

    let customer = findCustomerRecord(state, null, email);
    if (customer) {
      if (customer.islocked) {
        return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa.' });
      }

      // Quan trọng: đăng nhập Google bằng email đã có KHÔNG được xóa mật khẩu,
      // KHÔNG được đổi isGoogleAccount của tài khoản đăng ký thông thường.
      return res.status(200).json(customerResponse(customer));
    }

    customer = {
      id: nextCustomerId(state.customers),
      username: email.split('@')[0],
      password: '',
      fullname: name,
      email,
      phone: '',
      address: '',
      role: 'customer',
      islocked: false,
      isGoogleAccount: true,
      gender: 'nam',
      dob: '',
      avatar: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    state.customers.push(customer);
    persistCustomerState(state);
    return res.status(201).json(customerResponse(customer));
  } catch (error) {
    console.error('[Customers] Lỗi đăng nhập Google:', error);
    return res.status(500).json({ success: false, message: 'Không thể lưu tài khoản Google.' });
  }
});

app.patch('/api/customers/:id/profile', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    const customer = findCustomerRecord(state, req.params.id, req.body.email);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản khách hàng.' });
    }

    const allowedFields = ['fullname', 'phone', 'address', 'gender', 'dob', 'avatar'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) customer[field] = req.body[field];
    });

    if (typeof customer.avatar === 'string' && customer.avatar.startsWith('data:image')) {
      customer.avatar = saveBase64Image(customer.avatar, 'customer', customer.id);
    }

    customer.updatedAt = new Date().toISOString();
    persistCustomerState(state);
    return res.status(200).json(customerResponse(customer));
  } catch (error) {
    console.error('[Customers] Lỗi cập nhật hồ sơ:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật thông tin cá nhân.' });
  }
});

app.post('/api/customers/change-password', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    const customer = findCustomerRecord(state, req.body.customerId, req.body.email);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản khách hàng.' });
    }
    if (customer.islocked) {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa.' });
    }
    if (customer.isGoogleAccount === true) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản Google không thể đổi mật khẩu tại Sachweb. Vui lòng đổi mật khẩu tại Google.'
      });
    }

    const oldPassword = String(req.body.oldPassword || '');
    const newPassword = String(req.body.newPassword || '');
    if (!oldPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Thông tin mật khẩu không hợp lệ.' });
    }
    if (String(customer.password || '') !== oldPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu cũ không chính xác.' });
    }
    if (newPassword === oldPassword) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải khác mật khẩu cũ.' });
    }

    customer.password = newPassword;
    customer.updatedAt = new Date().toISOString();
    persistCustomerState(state);

    return res.status(200).json(customerResponse(customer));
  } catch (error) {
    console.error('[Customers] Lỗi đổi mật khẩu:', error);
    return res.status(500).json({ success: false, message: 'Không thể đổi mật khẩu. Vui lòng thử lại.' });
  }
});

app.post('/api/customers/reset-password', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    const customer = findCustomerRecord(state, req.body.customerId, req.body.email);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản khách hàng.' });
    }
    if (customer.islocked) {
      return res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa.' });
    }
    if (customer.isGoogleAccount === true) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản Google không thể đặt lại mật khẩu tại Sachweb. Vui lòng đổi mật khẩu tại Google.'
      });
    }

    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
    }

    customer.password = newPassword;
    customer.updatedAt = new Date().toISOString();
    persistCustomerState(state);

    return res.status(200).json(customerResponse(customer));
  } catch (error) {
    console.error('[Customers] Lỗi đặt lại mật khẩu:', error);
    return res.status(500).json({ success: false, message: 'Không thể đặt lại mật khẩu.' });
  }
});

app.post('/api/customers/admin', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.customers = Array.isArray(state.customers) ? state.customers : [];
    const email = normalizeEmail(req.body.email);
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email khách hàng không hợp lệ.' });
    }
    if (state.customers.some(customer => normalizeEmail(customer.email) === email)) {
      return res.status(409).json({ success: false, message: 'Email khách hàng đã tồn tại.' });
    }

    const customer = {
      ...req.body,
      id: req.body.id || nextCustomerId(state.customers),
      email,
      role: 'customer',
      islocked: !!req.body.islocked,
      isGoogleAccount: !!req.body.isGoogleAccount,
      createdAt: req.body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (customer.isGoogleAccount && !customer.password) customer.password = '';

    state.customers.push(customer);
    persistCustomerState(state);
    return res.status(201).json(customerResponse(customer));
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể thêm khách hàng.' });
  }
});

app.patch('/api/customers/:id/admin', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    const customer = findCustomerRecord(state, req.params.id, null);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng.' });
    }

    const protectedFields = new Set(['id', 'createdAt']);
    Object.keys(req.body || {}).forEach(key => {
      if (!protectedFields.has(key) && req.body[key] !== undefined) customer[key] = req.body[key];
    });
    customer.email = normalizeEmail(customer.email);
    customer.role = 'customer';
    customer.updatedAt = new Date().toISOString();

    if (typeof customer.avatar === 'string' && customer.avatar.startsWith('data:image')) {
      customer.avatar = saveBase64Image(customer.avatar, 'customer', customer.id);
    }
    if (String(customer.password || '').length > 0 && req.body.isGoogleAccount === undefined) {
      customer.isGoogleAccount = false;
    }

    persistCustomerState(state);
    return res.status(200).json(customerResponse(customer));
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể cập nhật khách hàng.' });
  }
});


// ==================== PROMOTIONS / COUPONS CANONICAL API ====================
function normalizePromotionCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9_-]/g, '');
}

function getNextPrefixedId(items, prefix) {
  let max = 0;
  (items || []).forEach(item => {
    const match = String(item?.id || '').match(new RegExp(`^${prefix}(\\d+)$`, 'i'));
    if (match) max = Math.max(max, Number(match[1]));
  });
  return `${prefix}${max + 1}`;
}

function getPromotionCustomerKey(rawId, rawEmail) {
  const id = String(rawId || '').trim();
  const email = normalizeEmail(rawEmail);
  return id ? `id:${id}` : (email ? `email:${email}` : '');
}

// Giá bán phải được tính từ dữ liệu sách trên server, không tin giá do trình duyệt gửi lên.
// Công thức này đồng nhất với CartService.discountPrice ở Angular.
function getCanonicalBookSalePrice(book) {
  const originalPrice = Math.max(0, Number(book?.price || 0));
  const discountPercent = Number.parseFloat(String(book?.discount || '0').replace('%', ''));
  const safeDiscount = Number.isFinite(discountPercent)
    ? Math.min(100, Math.max(0, discountPercent))
    : 0;
  return Math.round(originalPrice * (1 - safeDiscount / 100));
}

function normalizePromotionItems(state, rawItems) {
  const items = [];
  let subtotal = 0;

  for (const rawItem of Array.isArray(rawItems) ? rawItems : []) {
    const productId = String(rawItem?.productId ?? rawItem?.bookId ?? rawItem?.id ?? '').trim();
    const quantity = Number(rawItem?.quantity || 0);
    const book = (state.books || []).find(item => String(item.id) === productId);

    if (!productId || !book) {
      return { error: `Không tìm thấy sản phẩm "${rawItem?.title || productId}" để áp dụng khuyến mãi.` };
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: `Số lượng của sản phẩm "${book.title}" không hợp lệ.` };
    }

    const safeUnitPrice = getCanonicalBookSalePrice(book);
    const lineTotal = safeUnitPrice * quantity;

    items.push({
      productId,
      quantity,
      unitPrice: safeUnitPrice,
      lineTotal,
      category: String(book.category || ''),
      title: rawItem?.title || book.title
    });
    subtotal += lineTotal;
  }

  return { items, subtotal };
}

function promotionEligibleSubtotal(promotion, normalizedItems, subtotal) {
  if (promotion.applicableScope === 'CATEGORY') {
    return normalizedItems
      .filter(item => String(item.category) === String(promotion.applicableCategory || ''))
      .reduce((sum, item) => sum + item.lineTotal, 0);
  }

  if (promotion.applicableScope === 'PRODUCT') {
    const ids = new Set((promotion.applicableProductIds || []).map(String));
    return normalizedItems
      .filter(item => ids.has(String(item.productId)))
      .reduce((sum, item) => sum + item.lineTotal, 0);
  }

  return subtotal;
}

function validatePromotion(state, promotion, context) {
  if (!promotion) return { error: 'Mã giảm giá không tồn tại.' };
  if (!promotion.isActive) return { error: 'Mã giảm giá hiện đang tạm ngưng.' };

  const now = Date.now();
  const startAt = new Date(promotion.startAt).getTime();
  const endAt = new Date(promotion.endAt).getTime();

  if (!Number.isFinite(startAt) || !Number.isFinite(endAt)) {
    return { error: 'Thời gian áp dụng của mã giảm giá không hợp lệ.' };
  }
  if (now < startAt) return { error: 'Mã giảm giá chưa đến thời gian áp dụng.' };
  if (now > endAt) return { error: 'Mã giảm giá đã hết hạn.' };

  const subtotal = Math.max(0, Number(context.subtotal || 0));
  const minOrderValue = Math.max(0, Number(promotion.minOrderValue || 0));
  if (subtotal < minOrderValue) {
    return { error: `Đơn hàng phải đạt tối thiểu ${minOrderValue.toLocaleString('vi-VN')} đ để sử dụng mã này.` };
  }

  const usages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];
  const activeUsages = usages.filter(usage =>
    String(usage.promotionId) === String(promotion.id) && usage.status !== 'CANCELLED'
  );
  const usageLimit = Math.max(0, Number(promotion.usageLimit || 0));
  if (usageLimit > 0 && activeUsages.length >= usageLimit) {
    return { error: 'Mã giảm giá đã hết lượt sử dụng.' };
  }

  const customerKey = String(context.customerKey || '');
  const perUserLimit = Math.max(0, Number(promotion.perUserLimit || 0));
  if (perUserLimit > 0 && customerKey) {
    const userUsedCount = activeUsages.filter(usage => String(usage.customerKey) === customerKey).length;
    if (userUsedCount >= perUserLimit) {
      return { error: `Tài khoản của bạn đã sử dụng hết ${perUserLimit} lượt cho mã này.` };
    }
  }

  const eligibleSubtotal = promotionEligibleSubtotal(promotion, context.items || [], subtotal);
  if (eligibleSubtotal <= 0) {
    if (promotion.applicableScope === 'CATEGORY') {
      return { error: 'Giỏ hàng không có sản phẩm thuộc danh mục được áp dụng.' };
    }
    if (promotion.applicableScope === 'PRODUCT') {
      return { error: 'Giỏ hàng không có sản phẩm được áp dụng mã giảm giá này.' };
    }
    return { error: 'Không có giá trị đơn hàng phù hợp để áp dụng mã.' };
  }

  const discountValue = Math.max(0, Number(promotion.discountValue || 0));
  let discountAmount = promotion.discountType === 'FIXED'
    ? discountValue
    : eligibleSubtotal * discountValue / 100;

  const maxDiscount = Math.max(0, Number(promotion.maxDiscount || 0));
  if (promotion.discountType === 'PERCENT' && maxDiscount > 0) {
    discountAmount = Math.min(discountAmount, maxDiscount);
  }

  discountAmount = Math.max(0, Math.min(eligibleSubtotal, Math.round(discountAmount)));
  if (discountAmount <= 0) return { error: 'Mã giảm giá không tạo ra giá trị giảm hợp lệ.' };

  return {
    quote: {
      promotionId: String(promotion.id),
      code: promotion.code,
      name: promotion.name,
      description: promotion.description || '',
      discountType: promotion.discountType,
      discountValue,
      discountAmount,
      eligibleSubtotal,
      subtotal,
      subtotalAfterDiscount: Math.max(0, subtotal - discountAmount),
      maxDiscount,
      endAt: promotion.endAt
    }
  };
}

function syncPromotionUsedCounts(state) {
  state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
  state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];
  state.promotions.forEach(promotion => {
    promotion.usedCount = state.promotionUsages.filter(usage =>
      String(usage.promotionId) === String(promotion.id) && usage.status !== 'CANCELLED'
    ).length;
  });
}

function sanitizePromotionPayload(payload, existingPromotion, state) {
  const code = normalizePromotionCode(payload.code ?? existingPromotion?.code);
  const name = String(payload.name ?? existingPromotion?.name ?? '').trim();
  const description = String(payload.description ?? existingPromotion?.description ?? '').trim();
  const discountType = payload.discountType === 'FIXED' ? 'FIXED' : 'PERCENT';
  const discountValue = Number(payload.discountValue ?? existingPromotion?.discountValue ?? 0);
  const minOrderValue = Number(payload.minOrderValue ?? existingPromotion?.minOrderValue ?? 0);
  const maxDiscount = Number(payload.maxDiscount ?? existingPromotion?.maxDiscount ?? 0);
  const usageLimit = Number(payload.usageLimit ?? existingPromotion?.usageLimit ?? 0);
  const perUserLimit = Number(payload.perUserLimit ?? existingPromotion?.perUserLimit ?? 0);
  const applicableScope = ['ALL', 'CATEGORY', 'PRODUCT'].includes(payload.applicableScope)
    ? payload.applicableScope
    : (existingPromotion?.applicableScope || 'ALL');
  const applicableCategory = String(payload.applicableCategory ?? existingPromotion?.applicableCategory ?? '').trim();
  const applicableProductIds = Array.from(new Set(
    (Array.isArray(payload.applicableProductIds)
      ? payload.applicableProductIds
      : (existingPromotion?.applicableProductIds || [])).map(String)
  ));
  const isActive = payload.isActive !== undefined ? !!payload.isActive : (existingPromotion?.isActive ?? true);
  const startAt = new Date(payload.startAt ?? existingPromotion?.startAt ?? Date.now());
  const endAt = new Date(payload.endAt ?? existingPromotion?.endAt ?? Date.now());

  if (code.length < 3 || code.length > 30) return { error: 'Mã giảm giá phải có từ 3 đến 30 ký tự.' };
  if (!name) return { error: 'Tên chương trình khuyến mãi là bắt buộc.' };
  if (!Number.isFinite(discountValue) || discountValue <= 0) return { error: 'Giá trị giảm phải lớn hơn 0.' };
  if (discountType === 'PERCENT' && discountValue > 100) return { error: 'Mức giảm phần trăm không được vượt quá 100%.' };
  if ([minOrderValue, maxDiscount, usageLimit, perUserLimit].some(value => !Number.isFinite(value) || value < 0)) {
    return { error: 'Các giới hạn và điều kiện tiền không được âm.' };
  }
  if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()) || endAt <= startAt) {
    return { error: 'Thời gian kết thúc phải sau thời gian bắt đầu.' };
  }
  if (applicableScope === 'CATEGORY' && !applicableCategory) return { error: 'Vui lòng chọn danh mục áp dụng.' };
  if (applicableScope === 'PRODUCT' && applicableProductIds.length === 0) return { error: 'Vui lòng chọn ít nhất một sản phẩm áp dụng.' };

  const duplicate = (state.promotions || []).find(item =>
    normalizePromotionCode(item.code) === code && String(item.id) !== String(existingPromotion?.id || '')
  );
  if (duplicate) return { error: 'Mã giảm giá này đã tồn tại.' };
  if (existingPromotion?.usedCount > 0 && code !== existingPromotion.code) {
    return { error: 'Không thể đổi code của mã đã phát sinh lượt sử dụng.' };
  }
  if (usageLimit > 0 && usageLimit < Number(existingPromotion?.usedCount || 0)) {
    return { error: 'Tổng lượt sử dụng không thể nhỏ hơn số lượt đã dùng.' };
  }

  return {
    promotion: {
      ...(existingPromotion || {}),
      code,
      name,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscount: discountType === 'FIXED' ? 0 : maxDiscount,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      usageLimit,
      perUserLimit,
      applicableScope,
      applicableCategory: applicableScope === 'CATEGORY' ? applicableCategory : '',
      applicableProductIds: applicableScope === 'PRODUCT' ? applicableProductIds : [],
      isActive,
      usedCount: Number(existingPromotion?.usedCount || 0),
      updatedAt: new Date().toISOString()
    }
  };
}

function releasePromotionUsageForOrder(state, orderId, removeUsage = false) {
  state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];
  const targetId = String(orderId);
  if (removeUsage) {
    state.promotionUsages = state.promotionUsages.filter(usage => String(usage.orderId) !== targetId);
  } else {
    state.promotionUsages.forEach(usage => {
      if (String(usage.orderId) === targetId && usage.status !== 'CANCELLED') {
        usage.status = 'CANCELLED';
        usage.cancelledAt = new Date().toISOString();
      }
    });
  }
  syncPromotionUsedCounts(state);
}

function restorePromotionUsageForOrder(state, order) {
  if (!order?.promotion?.id) return { success: true };
  state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
  state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];

  const promotion = state.promotions.find(item => String(item.id) === String(order.promotion.id));
  const usage = state.promotionUsages.find(item =>
    String(item.orderId) === String(order.id) && String(item.promotionId) === String(order.promotion.id)
  );
  if (!promotion || !usage) return { error: 'Không tìm thấy lịch sử sử dụng mã để phục hồi đơn hàng.' };

  const activeUsages = state.promotionUsages.filter(item =>
    String(item.promotionId) === String(promotion.id) && item.status !== 'CANCELLED' && String(item.id) !== String(usage.id)
  );
  if (promotion.usageLimit > 0 && activeUsages.length >= promotion.usageLimit) {
    return { error: 'Không thể phục hồi đơn vì mã giảm giá đã hết tổng lượt sử dụng.' };
  }
  if (promotion.perUserLimit > 0) {
    const userCount = activeUsages.filter(item => String(item.customerKey) === String(usage.customerKey)).length;
    if (userCount >= promotion.perUserLimit) {
      return { error: 'Không thể phục hồi đơn vì tài khoản đã đạt giới hạn sử dụng mã.' };
    }
  }

  usage.status = 'ACTIVE';
  usage.restoredAt = new Date().toISOString();
  delete usage.cancelledAt;
  syncPromotionUsedCounts(state);
  return { success: true };
}

function repairPromotionState() {
  const state = cloneState(jsonRouter.db.getState());
  state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
  state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];
  syncPromotionUsedCounts(state);
  persistDatabaseState(state);
}

repairPromotionState();

app.get('/api/promotions/health', (req, res) => {
  const state = jsonRouter.db.getState();
  return res.status(200).json({
    success: true,
    version: 'promotions-canonical-v1',
    promotions: Array.isArray(state.promotions) ? state.promotions.length : 0,
    usages: Array.isArray(state.promotionUsages) ? state.promotionUsages.length : 0
  });
});

app.get('/api/promotions/public', (req, res) => {
  const state = jsonRouter.db.getState();
  const now = Date.now();
  const promotions = (Array.isArray(state.promotions) ? state.promotions : [])
    .filter(promotion => {
      const startAt = new Date(promotion.startAt).getTime();
      const endAt = new Date(promotion.endAt).getTime();
      const usageLimit = Math.max(0, Number(promotion.usageLimit || 0));
      const usedCount = Math.max(0, Number(promotion.usedCount || 0));
      return promotion.isActive === true &&
        Number.isFinite(startAt) && Number.isFinite(endAt) &&
        startAt <= now && now <= endAt &&
        (usageLimit === 0 || usedCount < usageLimit);
    })
    .map(promotion => ({
      id: promotion.id,
      code: promotion.code,
      name: promotion.name,
      description: promotion.description || '',
      discountType: promotion.discountType,
      discountValue: Number(promotion.discountValue || 0),
      minOrderValue: Number(promotion.minOrderValue || 0),
      maxDiscount: Number(promotion.maxDiscount || 0),
      startAt: promotion.startAt,
      endAt: promotion.endAt,
      usageLimit: Number(promotion.usageLimit || 0),
      usedCount: Number(promotion.usedCount || 0),
      perUserLimit: Number(promotion.perUserLimit || 0),
      applicableScope: promotion.applicableScope || 'ALL',
      applicableCategory: promotion.applicableCategory || '',
      applicableProductIds: [...(promotion.applicableProductIds || [])],
      isActive: true,
      createdAt: promotion.createdAt || '',
      updatedAt: promotion.updatedAt || ''
    }))
    .sort((a, b) => new Date(a.endAt).getTime() - new Date(b.endAt).getTime());

  return res.status(200).json({ success: true, promotions });
});

app.get('/api/promotions', (req, res) => {
  const state = jsonRouter.db.getState();
  const promotions = [...(Array.isArray(state.promotions) ? state.promotions : [])]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return res.status(200).json({ success: true, promotions });
});

app.post('/api/promotions/validate', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.books = Array.isArray(state.books) ? state.books : [];
    state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
    state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];

    const code = normalizePromotionCode(req.body?.code);
    const normalized = normalizePromotionItems(state, req.body?.items || []);
    if (normalized.error) return res.status(400).json({ success: false, message: normalized.error });
    if (!code) return res.status(400).json({ success: false, message: 'Vui lòng nhập mã giảm giá.' });

    const customerKey = getPromotionCustomerKey(req.body?.accountId, req.body?.accountEmail);
    if (!customerKey) return res.status(401).json({ success: false, message: 'Vui lòng đăng nhập để sử dụng mã giảm giá.' });

    const promotion = state.promotions.find(item => normalizePromotionCode(item.code) === code);
    const validation = validatePromotion(state, promotion, {
      subtotal: normalized.subtotal,
      items: normalized.items,
      customerKey
    });
    if (validation.error) return res.status(400).json({ success: false, message: validation.error });

    return res.status(200).json({ success: true, quote: validation.quote });
  } catch (error) {
    console.error('[Promotions] Lỗi kiểm tra mã:', error);
    return res.status(500).json({ success: false, message: 'Không thể kiểm tra mã giảm giá.' });
  }
});

app.post('/api/promotions/admin', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
    state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];

    const sanitized = sanitizePromotionPayload(req.body || {}, null, state);
    if (sanitized.error) return res.status(400).json({ success: false, message: sanitized.error });

    const promotion = {
      ...sanitized.promotion,
      id: getNextPrefixedId(state.promotions, 'promo'),
      createdAt: new Date().toISOString()
    };
    state.promotions.push(promotion);
    persistDatabaseState(state);
    return res.status(201).json({ success: true, promotion });
  } catch (error) {
    console.error('[Promotions] Lỗi tạo mã:', error);
    return res.status(500).json({ success: false, message: 'Không thể tạo mã giảm giá.' });
  }
});

app.patch('/api/promotions/:id/admin', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
    const promotion = state.promotions.find(item => String(item.id) === String(req.params.id));
    if (!promotion) return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá.' });

    const sanitized = sanitizePromotionPayload(req.body || {}, promotion, state);
    if (sanitized.error) return res.status(400).json({ success: false, message: sanitized.error });

    Object.assign(promotion, sanitized.promotion);
    syncPromotionUsedCounts(state);
    persistDatabaseState(state);
    return res.status(200).json({ success: true, promotion });
  } catch (error) {
    console.error('[Promotions] Lỗi cập nhật mã:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật mã giảm giá.' });
  }
});

app.patch('/api/promotions/:id/toggle', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
    const promotion = state.promotions.find(item => String(item.id) === String(req.params.id));
    if (!promotion) return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá.' });
    promotion.isActive = !!req.body?.isActive;
    promotion.updatedAt = new Date().toISOString();
    persistDatabaseState(state);
    return res.status(200).json({ success: true, promotion });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể đổi trạng thái mã giảm giá.' });
  }
});

app.delete('/api/promotions/:id/admin', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
    state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];
    const index = state.promotions.findIndex(item => String(item.id) === String(req.params.id));
    if (index === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy mã giảm giá.' });

    const promotion = state.promotions[index];
    const hasUsage = state.promotionUsages.some(usage => String(usage.promotionId) === String(promotion.id));
    if (hasUsage || Number(promotion.usedCount || 0) > 0) {
      return res.status(409).json({
        success: false,
        message: 'Mã đã phát sinh lịch sử sử dụng nên không thể xóa. Hãy chuyển sang trạng thái Tạm ngưng.'
      });
    }

    state.promotions.splice(index, 1);
    persistDatabaseState(state);
    return res.status(200).json({ success: true, message: 'Đã xóa mã giảm giá.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Không thể xóa mã giảm giá.' });
  }
});

// ================== END PROMOTIONS / COUPONS CANONICAL API ==================

app.get('/api/orders/health', (req, res) => {
  const state = jsonRouter.db.getState();
  return res.status(200).json({
    success: true,
    version: 'orders-canonical-v6-promotions-safe-delete',
    database: CANONICAL_DB_PATH,
    orders: Array.isArray(state.orders) ? state.orders.length : 0
  });
});

/**
 * Tạo đơn hàng theo một giao dịch duy nhất:
 * kiểm tra kho -> trừ kho -> tạo đơn -> ghi db.json -> trả kết quả.
 * Nếu bất kỳ bước nào lỗi thì không xóa giỏ và không tạo đơn giả.
 */
app.post('/api/orders/checkout', (req, res) => {
  try {
    const payload = req.body || {};
    const rawItems = Array.isArray(payload.items) ? payload.items : [];

    if (rawItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Giỏ hàng thanh toán đang trống.' });
    }

    const state = cloneState(jsonRouter.db.getState());
    state.orders = Array.isArray(state.orders) ? state.orders : [];
    state.books = Array.isArray(state.books) ? state.books : [];
    state.customers = Array.isArray(state.customers) ? state.customers : [];
    state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
    state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];

    const requestedCode = String(payload.orderCode || '').trim();
    if (requestedCode) {
      const existingOrder = state.orders.find(order => String(order.orderCode || '') === requestedCode);
      if (existingOrder) {
        // Idempotency: gửi lại cùng mã đơn không tạo thêm đơn và không tăng lượt coupon.
        return res.status(200).json({ success: true, order: existingOrder, duplicated: true });
      }
    }

    const accountEmail = normalizeEmail(
      payload.accountEmail || payload.currentUser?.email || payload.loginEmail
    );
    const requestedUserId = String(
      payload.accountId || payload.currentUser?.id || payload.userId || ''
    ).trim();

    let customer = null;
    if (accountEmail) {
      customer = state.customers.find(item => normalizeEmail(item.email) === accountEmail) || null;
    }
    if (!customer && requestedUserId) {
      customer = state.customers.find(item => String(item.id) === requestedUserId) || null;
    }

    const canonicalUserId = String(customer?.id || requestedUserId || accountEmail);
    const canonicalAccountEmail = normalizeEmail(customer?.email || accountEmail);
    const promotionCustomerKey = getPromotionCustomerKey(canonicalUserId, canonicalAccountEmail);

    if (!canonicalUserId && !canonicalAccountEmail) {
      return res.status(401).json({ success: false, message: 'Không xác định được tài khoản đang đặt hàng.' });
    }

    const normalizedItems = [];
    const promotionItems = [];
    let subtotal = 0;

    for (const rawItem of rawItems) {
      const productId = String(rawItem.productId ?? rawItem.bookId ?? rawItem.id ?? '');
      const quantity = Number(rawItem.quantity);
      const book = state.books.find(item => String(item.id) === productId);

      if (!book) {
        return res.status(400).json({
          success: false,
          message: `Không tìm thấy sản phẩm "${rawItem.title || productId}" trong hệ thống.`
        });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ success: false, message: `Số lượng của "${book.title}" không hợp lệ.` });
      }

      const currentStock = Number(book.stock || 0);
      if (currentStock < quantity) {
        return res.status(409).json({
          success: false,
          message: `Sách "${book.title}" chỉ còn ${currentStock} cuốn, không đủ số lượng ${quantity} cuốn.`
        });
      }

      // Giá được lấy từ book trong db.json để ngăn sửa giá ở DevTools/request.
      const safeUnitPrice = getCanonicalBookSalePrice(book);
      const lineTotal = safeUnitPrice * quantity;

      normalizedItems.push({
        ...rawItem,
        productId,
        title: rawItem.title || book.title,
        unitPrice: safeUnitPrice,
        price: lineTotal,
        quantity,
        userId: canonicalUserId,
        active: true
      });

      promotionItems.push({
        productId,
        quantity,
        unitPrice: safeUnitPrice,
        lineTotal,
        category: String(book.category || ''),
        title: rawItem.title || book.title
      });

      subtotal += lineTotal;
      // Chỉ thay đổi tồn kho trên bản sao state. Nếu coupon hoặc bước sau lỗi, state không được ghi.
      book.stock = currentStock - quantity;
    }

    let discountAmount = 0;
    let promotionSnapshot = null;
    let selectedPromotion = null;
    const promotionCode = normalizePromotionCode(payload.promotionCode);

    if (promotionCode) {
      selectedPromotion = state.promotions.find(item => normalizePromotionCode(item.code) === promotionCode) || null;
      const validation = validatePromotion(state, selectedPromotion, {
        subtotal,
        items: promotionItems,
        customerKey: promotionCustomerKey
      });
      if (validation.error) {
        return res.status(400).json({ success: false, message: validation.error });
      }

      discountAmount = validation.quote.discountAmount;
      promotionSnapshot = {
        id: String(selectedPromotion.id),
        code: selectedPromotion.code,
        name: selectedPromotion.name,
        discountType: selectedPromotion.discountType,
        discountValue: Number(selectedPromotion.discountValue || 0),
        discountAmount,
        applicableScope: selectedPromotion.applicableScope,
        applicableCategory: selectedPromotion.applicableCategory || '',
        applicableProductIds: [...(selectedPromotion.applicableProductIds || [])]
      };
    }

    const shippingCost = Math.max(0, Number(payload.shippingCost || 0));
    const paymentMethod = payload.paymentMethod === 'BANK_TRANSFER' ? 'BANK_TRANSFER' : 'COD';
    const orderId = getNextOrderId(state.orders);
    const orderCode = requestedCode || `SW${String(Date.now()).slice(-6)}`;
    let paymentReceipt = payload.paymentReceipt || '';

    if (typeof paymentReceipt === 'string' && paymentReceipt.startsWith('data:image')) {
      paymentReceipt = saveBase64Image(paymentReceipt, 'receipt', orderCode);
    }

    const order = {
      id: orderId,
      orderCode,
      userId: canonicalUserId,
      customerId: customer ? String(customer.id) : canonicalUserId,
      accountEmail: canonicalAccountEmail,
      fullname: String(payload.fullname || customer?.fullname || '').trim(),
      phone: String(payload.phone || customer?.phone || '').trim(),
      email: normalizeEmail(payload.email || customer?.email || canonicalAccountEmail),
      address: String(payload.address || customer?.address || '').trim(),
      items: normalizedItems,
      subtotal,
      discountAmount,
      promotion: promotionSnapshot,
      shippingCost,
      total: Math.max(0, subtotal - discountAmount + shippingCost),
      status: 'Đang xử lý',
      paymentMethod,
      paymentStatus: paymentMethod === 'BANK_TRANSFER' ? 'Chờ xác nhận' : 'Chưa thanh toán',
      paymentReceipt,
      isNew: true,
      createdAt: payload.createdAt || new Date().toISOString()
    };

    state.orders.push(order);

    if (selectedPromotion && promotionSnapshot) {
      state.promotionUsages.push({
        id: getNextPrefixedId(state.promotionUsages, 'pu'),
        promotionId: String(selectedPromotion.id),
        code: selectedPromotion.code,
        customerKey: promotionCustomerKey,
        customerId: canonicalUserId,
        accountEmail: canonicalAccountEmail,
        orderId: String(orderId),
        orderCode,
        discountAmount,
        status: 'ACTIVE',
        usedAt: new Date().toISOString()
      });
      syncPromotionUsedCounts(state);
    }

    // Đơn hàng, tồn kho và lượt dùng coupon được ghi trong cùng một state duy nhất.
    persistDatabaseState(state);

    return res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('[Orders] Lỗi tạo đơn hàng:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể lưu đơn hàng vào db.json. ' + error.message
    });
  }
});
/** Cập nhật trạng thái đơn hàng và tồn kho trong cùng một lần ghi. */
app.patch('/api/orders/:id', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.orders = Array.isArray(state.orders) ? state.orders : [];
    state.books = Array.isArray(state.books) ? state.books : [];
    state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
    state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];

    const order = findOrderById(state.orders, req.params.id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng.' });
    }

    const oldStatus = order.status;
    const newStatus = req.body.status ?? oldStatus;
    const items = Array.isArray(order.items) ? order.items : [];

    if (oldStatus !== 'Hủy đơn hàng' && newStatus === 'Hủy đơn hàng') {
      items.forEach((item) => {
        const book = state.books.find((entry) => String(entry.id) === String(item.productId));
        if (book) book.stock = Number(book.stock || 0) + Number(item.quantity || 0);
      });
      // Đơn bị hủy sẽ trả lại lượt sử dụng coupon cho khách hàng.
      releasePromotionUsageForOrder(state, order.id, false);
    }

    if (oldStatus === 'Hủy đơn hàng' && newStatus !== 'Hủy đơn hàng') {
      for (const item of items) {
        const book = state.books.find((entry) => String(entry.id) === String(item.productId));
        const quantity = Number(item.quantity || 0);
        if (!book || Number(book.stock || 0) < quantity) {
          return res.status(409).json({
            success: false,
            message: `Không đủ tồn kho để phục hồi sản phẩm "${item.title || item.productId}".`
          });
        }
      }
      const restorePromotion = restorePromotionUsageForOrder(state, order);
      if (restorePromotion.error) {
        return res.status(409).json({ success: false, message: restorePromotion.error });
      }

      items.forEach((item) => {
        const book = state.books.find((entry) => String(entry.id) === String(item.productId));
        if (book) book.stock = Number(book.stock || 0) - Number(item.quantity || 0);
      });
    }

    const allowedFields = ['status', 'paymentStatus', 'isNew'];
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) order[field] = req.body[field];
    });

    if (order.paymentMethod !== 'BANK_TRANSFER' && order.status === 'Đã giao hàng') {
      order.paymentStatus = 'Đã thanh toán';
    }

    order.updatedAt = new Date().toISOString();
    persistDatabaseState(state);

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('[Orders] Lỗi cập nhật đơn hàng:', error);
    return res.status(500).json({ success: false, message: 'Không thể cập nhật đơn hàng: ' + error.message });
  }
});

/**
 * Xóa đúng một đơn hàng.
 * Không gọi DELETE /orders/:id của json-server vì json-server 0.17 có cơ chế
 * cascade làm mất các đơn khác có userId khách hàng dạng cus... .
 */
app.delete('/api/orders/:id', (req, res) => {
  try {
    const state = cloneState(jsonRouter.db.getState());
    state.orders = Array.isArray(state.orders) ? state.orders : [];
    state.promotions = Array.isArray(state.promotions) ? state.promotions : [];
    state.promotionUsages = Array.isArray(state.promotionUsages) ? state.promotionUsages : [];

    const index = state.orders.findIndex(order => String(order.id) === String(req.params.id));
    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn hàng cần xóa.' });
    }

    const beforeCount = state.orders.length;
    const [deletedOrder] = state.orders.splice(index, 1);
    if (state.orders.length !== beforeCount - 1) {
      throw new Error('Safe delete validation failed for order.');
    }

    // Xóa lịch sử sử dụng coupon gắn với đơn bị xóa và tính lại usedCount.
    releasePromotionUsageForOrder(state, deletedOrder.id, true);
    persistDatabaseState(state);

    const persistedOrders = jsonRouter.db.getState().orders;
    if (!Array.isArray(persistedOrders) || persistedOrders.length !== beforeCount - 1) {
      throw new Error('Database verification failed after deleting order.');
    }

    return res.status(200).json({
      success: true,
      message: 'Đã xóa đúng một đơn hàng.',
      deletedOrder
    });
  } catch (error) {
    console.error('[Orders] Lỗi xóa đơn hàng:', error);
    return res.status(500).json({
      success: false,
      message: 'Không thể xóa đơn hàng an toàn: ' + error.message
    });
  }
});

app.post('/api/reset-json-server', (req, res) => {
  try {
    jsonRouter.db.set('cart', []).write();
    jsonRouter.db.set('wishlist', []).write();
    return res.status(200).json({ success: true, message: 'JSON Server reset successfully.' });
  } catch (e) {
    console.error('Reset JSON Server failed:', e);
    return res.status(500).json({ success: false, message: 'Reset failed: ' + e.message });
  }
});

app.post('/api/sync-user-data', (req, res) => {
  try {
    const { cart, wishlist } = req.body;
    if (cart !== undefined) {
      jsonRouter.db.set('cart', cart).write();
    }
    if (wishlist !== undefined) {
      jsonRouter.db.set('wishlist', wishlist).write();
    }
    return res.status(200).json({ success: true, message: 'User data synced successfully.' });
  } catch (e) {
    console.error('Sync user data failed:', e);
    return res.status(500).json({ success: false, message: 'Sync failed: ' + e.message });
  }
});

// Router hiển thị các tài nguyên có trong db.json
app.get('/', (req, res) => {
  try {
    const dbState = jsonRouter.db.getState();
    const resources = Object.keys(dbState).map(key => {
      const data = dbState[key];
      const count = Array.isArray(data) ? data.length : (data ? 1 : 0);
      return { name: key, count };
    });

    const resourceHtml = resources.map(r => `
      <div class="resource-item">
        <a href="/${r.name}">/${r.name}</a>
        <span class="resource-count">${r.count} items</span>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>json-server</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #2e3440;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
    }
    .container {
      width: 100%;
      max-width: 600px;
      margin-top: 80px;
      padding: 20px;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 15px;
      border-bottom: 1px solid #eceff4;
    }
    header h1 {
      font-size: 15px;
      font-weight: normal;
      margin: 0;
      color: #2e3440;
    }
    header a {
      font-size: 14px;
      color: #4c566a;
      text-decoration: none;
    }
    header a:hover {
      text-decoration: underline;
    }
    .subtitle {
      font-size: 14px;
      color: #4c566a;
      margin-top: 20px;
      margin-bottom: 35px;
    }
    h2 {
      font-size: 15px;
      font-weight: bold;
      margin-top: 0;
      margin-bottom: 20px;
      color: #2e3440;
    }
    .resources-list {
      margin-bottom: 45px;
    }
    .resource-item {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 14px;
    }
    .resource-item a {
      color: #5e81ac;
      text-decoration: none;
    }
    .resource-item a:hover {
      color: #81a1c1;
      text-decoration: underline;
    }
    .resource-count {
      color: #4c566a;
    }
    footer {
      border-top: 1px solid #eceff4;
      padding-top: 20px;
      font-size: 13px;
      color: #4c566a;
    }
    code {
      background: #e5e9f0;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>json-server</h1>
      <a href="https://github.com/typicode/json-server" target="_blank">README</a>
    </header>
    <div class="subtitle">Available REST resources from db.json</div>
    
    <h2>Resources</h2>
    <div class="resources-list">
      ${resourceHtml}
    </div>
    
    <footer>
      To replace this page, create <code>public/index.html</code>.
    </footer>
  </div>
</body>
</html>`;
    res.send(html);
  } catch (error) {
    res.status(500).send('Error rendering dashboard');
  }
});

function runMigration() {
  // 1. Migrate db.json
  const dbJsonPath = path.join(__dirname, 'db.json');
  if (fs.existsSync(dbJsonPath)) {
    try {
      const db = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
      let modified = false;

      // Support both singular 'customer' and plural 'customers'
      const customerList = db.customer || db.customers;
      if (customerList && Array.isArray(customerList)) {
        customerList.forEach(customer => {
          if (customer.avatar && customer.avatar.startsWith('data:image')) {
            customer.avatar = saveBase64Image(customer.avatar, 'customer', customer.id);
            modified = true;
            console.log(`[Migration] Migrated db.json customer ${customer.id} avatar to file URL.`);
          }
        });
      }

      // Support both singular 'employee' and plural 'employees'
      const employeeList = db.employee || db.employees;
      if (employeeList && Array.isArray(employeeList)) {
        employeeList.forEach(employee => {
          if (employee.image && employee.image.startsWith('data:image')) {
            employee.image = saveBase64Image(employee.image, 'employee', employee.id);
            modified = true;
            console.log(`[Migration] Migrated db.json employee ${employee.id} image to file URL.`);
          }
        });
      }

      const orderList = db.order || db.orders;
      if (orderList && Array.isArray(orderList)) {
        orderList.forEach(order => {
          if (order.paymentReceipt && order.paymentReceipt.startsWith('data:image')) {
            order.paymentReceipt = saveBase64Image(order.paymentReceipt, 'receipt', order.orderCode || order.id || 'upload');
            modified = true;
            console.log(`[Migration] Migrated db.json order ${order.id || order.orderCode} paymentReceipt to file URL.`);
          }
        });
      }

      if (modified) {
        fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), 'utf8');
      }
    } catch (e) {
      console.error('[Migration] Failed to migrate db.json:', e);
    }
  }

  // 2. Migrate secure_db.txt
  if (fs.existsSync(DB_FILE_PATH)) {
    try {
      const encrypted = fs.readFileSync(DB_FILE_PATH, 'utf8');
      const decrypted = decrypt(encrypted);
      const secureDb = JSON.parse(decrypted);
      let modified = false;

      // Support both singular 'customer' and plural 'customers'
      const customerList = secureDb.customer || secureDb.customers;
      if (customerList && Array.isArray(customerList)) {
        customerList.forEach(customer => {
          if (customer.avatar && customer.avatar.startsWith('data:image')) {
            customer.avatar = saveBase64Image(customer.avatar, 'customer', customer.id);
            modified = true;
            console.log(`[Migration] Migrated secure_db.txt customer ${customer.id} avatar to file URL.`);
          }
        });
      }

      // Support both singular 'employee' and plural 'employees'
      const employeeList = secureDb.employee || secureDb.employees;
      if (employeeList && Array.isArray(employeeList)) {
        employeeList.forEach(employee => {
          if (employee.image && employee.image.startsWith('data:image')) {
            employee.image = saveBase64Image(employee.image, 'employee', employee.id);
            modified = true;
            console.log(`[Migration] Migrated secure_db.txt employee ${employee.id} image to file URL.`);
          }
        });
      }

      if (secureDb.currentUser) {
        if (secureDb.currentUser.avatar && secureDb.currentUser.avatar.startsWith('data:image')) {
          secureDb.currentUser.avatar = saveBase64Image(secureDb.currentUser.avatar, 'current_user', secureDb.currentUser.id);
          modified = true;
          console.log(`[Migration] Migrated secure_db.txt currentUser avatar to file URL.`);
        }
      }

      const orderListSecure = secureDb.order || secureDb.orders;
      if (orderListSecure && Array.isArray(orderListSecure)) {
        orderListSecure.forEach(order => {
          if (order.paymentReceipt && order.paymentReceipt.startsWith('data:image')) {
            order.paymentReceipt = saveBase64Image(order.paymentReceipt, 'receipt', order.orderCode || order.id || 'upload');
            modified = true;
            console.log(`[Migration] Migrated secure_db.txt order ${order.id || order.orderCode} paymentReceipt to file URL.`);
          }
        });
      }

      if (modified) {
        const reEncrypted = encrypt(JSON.stringify(secureDb));
        fs.writeFileSync(DB_FILE_PATH, reEncrypted, 'utf8');
      }
    } catch (e) {
      console.error('[Migration] Failed to migrate secure_db.txt:', e);
    }
  }
}

/**
 * Xóa hàng loạt email theo danh sách ID bằng giao dịch ghi đơn lẻ.
 */
app.post('/api/emails/bulk-delete', (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, message: 'Danh sách ID không hợp lệ.' });
    }

    const state = cloneState(jsonRouter.db.getState());
    state.emails = Array.isArray(state.emails) ? state.emails : [];

    const beforeCount = state.emails.length;
    const idsSet = new Set(ids.map(String));
    
    state.emails = state.emails.filter(e => !idsSet.has(String(e.id)));
    const deletedCount = beforeCount - state.emails.length;

    persistDatabaseState(state);

    return res.status(200).json({
      success: true,
      message: `Đã xóa thành công ${deletedCount} email.`,
      deletedCount
    });
  } catch (error) {
    console.error('[Emails] Lỗi xóa bulk-delete:', error);
    return res.status(500).json({ success: false, message: 'Không thể xóa các email: ' + error.message });
  }
});

/**
 * Tự động dọn dẹp các email cũ hơn số ngày chỉ định bằng giao dịch ghi đơn lẻ.
 */
app.post('/api/emails/clean-up', (req, res) => {
  try {
    const days = Number(req.body.days);
    if (isNaN(days) || days <= 0) {
      return res.status(400).json({ success: false, message: 'Số ngày không hợp lệ.' });
    }

    const state = cloneState(jsonRouter.db.getState());
    state.emails = Array.isArray(state.emails) ? state.emails : [];

    const beforeCount = state.emails.length;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    state.emails = state.emails.filter(e => {
      if (!e.sentAt) return true;
      const d = new Date(e.sentAt);
      if (isNaN(d.getTime())) return true;
      return d >= cutoff;
    });

    const deletedCount = beforeCount - state.emails.length;

    if (deletedCount > 0) {
      persistDatabaseState(state);
    }

    return res.status(200).json({
      success: true,
      message: `Đã dọn dẹp thành công ${deletedCount} email cũ hơn ${days} ngày.`,
      deletedCount
    });
  } catch (error) {
    console.error('[Emails] Lỗi dọn dẹp email:', error);
    return res.status(500).json({ success: false, message: 'Không thể dọn dẹp các email: ' + error.message });
  }
});

/**
 * Chặn toàn bộ DELETE dạng /resource/:id trước jsonRouter.
 * Nhờ vậy việc xóa sách, khách hàng, nhân viên, email... cũng không kích hoạt
 * cascade toàn database của json-server và không thể làm mất đơn hàng khác.
 */
app.delete('/:resource/:id', (req, res, next) => {
  try {
    const resourceName = String(req.params.resource || '');
    const currentState = jsonRouter.db.getState();

    // Chỉ xử lý tài nguyên mảng thật sự có trong db.json; route khác để middleware sau xử lý.
    if (!Array.isArray(currentState[resourceName])) return next();

    const result = deleteSingleRecordSafely(resourceName, req.params.id);
    if (!result.found) {
      return res.status(404).json({ success: false, message: `Không tìm thấy bản ghi ${resourceName}/${req.params.id}.` });
    }

    return res.status(200).json({});
  } catch (error) {
    console.error('[Database] Lỗi safe delete:', error);
    return res.status(500).json({ success: false, message: 'Không thể xóa dữ liệu an toàn: ' + error.message });
  }
});

// Middleware to save base64 images as physical files and store their URL instead
app.use((req, res, next) => {
  if (req.body) {
    const id = req.body.id || req.body.orderCode || req.params.id || 'upload';
    let prefix = 'image';
    if (req.path.includes('customers')) {
      prefix = 'customer';
    } else if (req.path.includes('employees')) {
      prefix = 'employee';
    } else if (req.path.includes('orders')) {
      prefix = 'receipt';
    }

    if (req.body.avatar && req.body.avatar.startsWith('data:image')) {
      console.log(`[Upload] Intercepted customer avatar base64 upload, saving to disk...`);
      req.body.avatar = saveBase64Image(req.body.avatar, prefix, id);
      console.log(`[Upload] Saved avatar path: ${req.body.avatar}`);
    }
    if (req.body.image && req.body.image.startsWith('data:image')) {
      console.log(`[Upload] Intercepted image base64 upload, saving to disk...`);
      req.body.image = saveBase64Image(req.body.image, prefix, id);
      console.log(`[Upload] Saved image path: ${req.body.image}`);
    }
    if (req.body.paymentReceipt && req.body.paymentReceipt.startsWith('data:image')) {
      console.log(`[Upload] Intercepted payment receipt base64 upload, saving to disk...`);
      req.body.paymentReceipt = saveBase64Image(req.body.paymentReceipt, prefix, id);
      console.log(`[Upload] Saved receipt path: ${req.body.paymentReceipt}`);
    }
  }
  next();
});

// Đồng bộ mọi thay đổi CRUD thông thường từ db.json chính sang bản sao email-server/db.json.
app.use((req, res, next) => {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (isMutation) {
    res.on('finish', () => {
      if (res.statusCode < 400) {
        mirrorCanonicalDatabase();
      }
    });
  }
  next();
});

// Mount the json-server defaults and router at the root level
app.use(jsonServer.defaults({ noCors: true })); // noCors to let Express's cors middleware handle it
app.use(jsonRouter);



app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Order API health: http://localhost:${PORT}/api/orders/health`);
  console.log(`Customer API health: http://localhost:${PORT}/api/customers/health`);
});

