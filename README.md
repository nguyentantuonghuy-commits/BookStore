# 📚 Online Bookstore Management System (Hệ Thống Quản Lý & Bán Sách Trực Tuyến)

[![Angular](https://img.shields.io/badge/Angular-21.2-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)](https://getbootstrap.com/)
[![RxJS](https://img.shields.io/badge/RxJS-7.8-B7178C?style=for-the-badge&logo=reactivex&logoColor=white)](https://rxjs.dev/)
[![Vitest](https://img.shields.io/badge/Vitest-4.0-6E9F18?style=for-the-badge&logo=vitest&logoColor=white)](https://vitest.dev/)

---

## 📌 Giới Thiệu Dự Án (Project Overview)

**Bookstore Application** là một hệ thống thương mại điện tử chuyên nghiệp phục vụ việc kinh doanh sách trực tuyến và quản trị hệ thống toàn diện. Dự án được xây dựng với kiến trúc Frontend hiện đại sử dụng **Angular 21 (Standalone Components)** kết hợp với Backend **Node.js/Express API** và **JSON Server**.

Dự án cung cấp 2 phân hệ chính:
1. **Phân hệ Khách hàng (Customer Portal)**: Trải nghiệm mua sắm trực quan, tìm kiếm & lọc sách thông minh, giỏ hàng, áp dụng mã giảm giá, thanh toán đa phương thức, theo dõi đơn hàng và tương tác với Trợ lý Chat AI/Live Support.
2. **Phân hệ Quản trị (Admin & Staff Portal)**: Dashboard báo cáo doanh thu, quản lý danh mục sách, đơn hàng, khách hàng, nhân viên, mã khuyến mãi, bài viết tin tức, cùng hệ thống **Phân quyền nâng cao (RBAC - Role-Based Access Control)** và **Live Chat trực ca**.

Dự án được thiết kế chuẩn mực, phù hợp làm **Đồ án môn học / Dự án tốt nghiệp / Sản phẩm Portfolio trong hồ sơ ứng tuyển thực tập (Internship Resume)**.

---

## 🚀 Tính Năng Nổi Bật (Key Features)

### 🛒 1. Phân Hệ Khách Hàng (Customer Features)
* **Trang chủ & Banner Carousel**: Hiển thị sách bán chạy, sách mới phát hành, bộ sưu tập nổi bật và các chương trình khuyến mãi hot.
* **Catalog Sách & Tìm kiếm nâng cao**:
  * Tìm kiếm theo từ khóa thực tế (Tên sách, tác giả, mô tả).
  * Lọc đa tiêu chí: Danh mục, khoảng giá, số sao đánh giá (Rating), loại sách (Giấy / E-book).
  * Sắp xếp linh hoạt (Mới nhất, Giá tăng/giảm, Bán chạy nhất) và Phân trang (Pagination).
* **Trang Chi Tiết Sách (Book Detail)**:
  * Xem thông tin chi tiết, hình ảnh bìa, tác giả, nhà xuất bản, tình trạng kho.
  * Đọc trước E-book (Preview sample) / Tải tài liệu đính kèm.
  * Xem và gửi đánh giá, bình luận (Reviews & Rating).
  * Gợi ý danh sách sách liên quan (Related Books).
* **Giỏ Hàng & Thanh Toán (Cart & Checkout)**:
  * Thêm/Xóa/Sửa số lượng sản phẩm, lưu trữ trạng thái giỏ hàng.
  * Áp dụng Mã giảm giá / Voucher ưu đãi (Promotions).
  * Điền thông tin giao hàng và chọn phương thức thanh toán: COD (Thanh toán khi nhận hàng), Chuyển khoản ngân hàng (Banking), Ví điện tử (MoMo / ZaloPay).
* **Theo Dõi Đơn Hàng (Order History & Tracking)**:
  * Xem danh sách đơn hàng cá nhân.
  * Theo dõi chi tiết lộ trình trạng thái: *Chờ xử lý $\rightarrow$ Đang xử lý $\rightarrow$ Đang giao $\rightarrow$ Đã hoàn thành / Đã hủy*.
* **Tài Khoản Cá Nhân & Bảo Mật**:
  * Đăng ký, Đăng nhập, Đăng xuất với Auth Guards (`authGuard`, `guestGuard`).
  * Cập nhật profile thông tin cá nhân.
  * Đổi mật khẩu & Khôi phục mật khẩu qua **Mã OTP gửi về Email thực tế**.
  * Bộ sưu tập yêu thích (Wishlist).
* **Trợ Lý Chat Widget (AI Bot & Live Support)**:
  * Bot tự động trả lời thắc mắc phổ biến về chính sách giao hàng, thanh toán, khuyến mãi.
  * Chuyển đổi linh hoạt sang chat trực tiếp với Nhân viên hỗ trợ.

---

### 🛡️ 2. Phân Hệ Quản Trị (Admin & Staff Features - `/dashboard`)
* **Dashboard Báo Cáo & Thống Kê**:
  * Tổng quan chỉ số doanh thu, số lượng đơn hàng, số khách hàng mới, sách bán chạy nhất.
  * Biểu đồ theo dõi xu hướng phát triển kinh doanh.
* **Quản Lý Đơn Hàng (Order Management)**:
  * Xem danh sách tất cả đơn hàng hệ thống.
  * Cập nhật trạng thái xử lý đơn hàng và trạng thái thanh toán.
* **Quản Lý Sản Phẩm & E-Book**:
  * Thêm mới, chỉnh sửa, xóa thông tin sách.
  * Cập nhật giá bán, số lượng kho, danh mục, file E-book.
* **Quản Lý Khách Hàng & Nhân Viên**:
  * Quản lý danh sách người dùng, kích hoạt / khóa tài khoản.
  * Tạo mới và quản lý hồ sơ nhân viên.
* **Hệ Thống Phân Quyền Chi Tiết (RBAC - Role-Based Access Control)**:
  * Quản lý Vai trò (`role-permissions`) và Ma trận Quyền hạn (`permissions`).
  * Phân quyền truy cập theo từng chức năng (Xem, Thêm, Sửa, Xóa) cho từng nhóm nhân viên.
* **Trực Ca Live Chat (Chat Management)**:
  * Giao diện nhận cuộc hội thoại từ khách hàng realtime.
  * Nhân viên tư vấn có thể phản hồi trực tiếp ngay trên Admin Dashboard.
* **Quản Lý Khuyến Mãi (Vouchers / Promotions)**:
  * Tạo mã discount code, cài đặt mức giảm (theo % hoặc số tiền cố định), điều kiện áp dụng và thời gian hiệu lực.
* **Quản Lý Đánh Giá, Tin Tức & Liên Hệ**:
  * Phê duyệt / Ẩn các đánh giá không phù hợp.
  * CMS bài viết tin tức (News), quản lý yêu cầu tư vấn từ trang Contact.
* **Email System Log & Config**:
  * Quản lý cấu hình Email Server và theo dõi lịch sử gửi Mail thông báo.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### **Frontend**
* **Framework**: Angular 21.2 (Standalone Components Architecture)
* **Language**: TypeScript 5.9
* **State & Data Flow**: RxJS 7.8, Angular Signals, Reactive Forms
* **Routing**: Angular Router với Route Guards (`authGuard`, `guestGuard`, `adminGuard`)
* **UI & Styling**: Bootstrap 5.3, Bootstrap Icons, CSS Custom Utility Classes
* **Testing**: Vitest 4.0

### **Backend & Data Layer**
* **Server Runtime**: Node.js & Express 4.19
* **REST API**: `json-server` 0.17 (Mock REST API Service)
* **Email Service**: Nodemailer 6.9 (SMTP Integration cho gửi mã OTP & thông báo)
* **Security & Utility**: Custom CORS middleware, Encrypted DB Decryption Utility (`decrypt_secure_db.js`)
* **Task Automation**: `concurrently` (Chạy đồng thời Frontend & Backend trong 1 câu lệnh)

---

## 📂 Cấu Trúc Thư Mục (Directory Structure)

```text
BookStrore/
├── email-server/               # Backend Express & Email API Server
│   ├── server.js               # Express Server logic & Nodemailer API routes
│   ├── config.json             # Server & SMTP configurations
│   ├── db.json                 # Backend server database store
│   └── package.json            # Dependencies cho Node.js backend
├── src/
│   ├── app/
│   │   ├── components/         # Giao diện người dùng & Admin
│   │   │   ├── admin/          # Các Sub-components cho Admin Dashboard
│   │   │   │   ├── chat-manage/# Quản lý Live Chat trực ca
│   │   │   │   ├── customers/  # Quản lý khách hàng
│   │   │   │   ├── dashboard/  # Báo cáo thống kê
│   │   │   │   ├── ebook/      # Quản lý E-book
│   │   │   │   ├── employees/  # Quản lý nhân viên
│   │   │   │   ├── orderlist/  # Quản lý đơn hàng
│   │   │   │   ├── permissions/# Quản lý ma trận phân quyền
│   │   │   │   └── ...
│   │   │   ├── book-detail/    # Trang chi tiết sách
│   │   │   ├── cart/           # Trang giỏ hàng
│   │   │   ├── checkout/       # Trang thanh toán
│   │   │   ├── chat-widget/    # Widget Chat AI/Live Support
│   │   │   ├── home/           # Trang chủ
│   │   │   ├── orderuser/      # Trang đơn hàng của tôi
│   │   │   ├── products/       # Trang danh mục sản phẩm
│   │   │   ├── profile/        # Trang thông tin cá nhân
│   │   │   └── ...
│   │   ├── guards/             # Auth Guards bảo vệ tuyến đường
│   │   ├── interfaces/         # TypeScript Models & Interfaces
│   │   ├── services/           # Angular Services (Auth, Cart, Chat, Book, RBAC...)
│   │   └── utils/              # Helper utilities
│   ├── public/                 # Static assets (Hình ảnh sách, banners, avatars)
│   └── main.ts                 # File khởi chạy ứng dụng Angular
├── db.json                     # Database chính (JSON Server: Books, Users, Orders, Vouchers...)
├── package.json                # Dependencies Frontend & Npm Scripts
├── angular.json                # Cấu hình Angular CLI
└── README.md                   # Tài liệu hướng dẫn dự án
```

---

## ⚡ Hướng Dẫn Cài Đặt & Khởi Chạy (Getting Started)

### **1. Yêu cầu tiên quyết (Prerequisites)**
* **Node.js**: phiên bản `>= 18.x` (Khuyên dùng LTS)
* **npm**: phiên bản `>= 9.x`

### **2. Cài đặt Dependencies**

Cài đặt gói phụ thuộc cho Frontend:
```bash
npm install
```

Cài đặt gói phụ thuộc cho Backend Email Server:
```bash
cd email-server
npm install
cd ..
```

---

### **3. Khởi chạy Ứng dụng (Development Mode)**

Dự án đã tích hợp gói `concurrently` cho phép bạn khởi chạy cả **Angular Client** và **Backend Express Server** chỉ với **1 lệnh duy nhất**:

```bash
npm start
```

Sau khi chạy thành công:
* **Frontend Web App**: Truy cập tại `http://localhost:4200`
* **Backend Express API & Email Server**: Chạy tại `http://localhost:3000`

> **Lưu ý phụ**: Nếu bạn muốn khởi chạy riêng lẻ từng dịch vụ:
> - Chỉ chạy Web Frontend: `npm run start:web`
> - Chỉ chạy Backend Server: `npm run start:server`

---

## 🧪 Kiểm Thử (Testing)

Khởi chạy hệ thống Unit Tests với runner Vitest:

```bash
npm run test
```

Đóng gói sản phẩm cho môi trường Production:

```bash
npm run build
```

---

## 🎯 Điểm Cộng Dành Cho Nhà Tuyển Dụng (Highlights for Recruiters)

1. **Kiến trúc Modern Angular 21**: Sử dụng **Standalone Components**, tối ưu hóa bundle size, loại bỏ boilerplate của NgModule truyền thống.
2. **Quy trình Thương mại Điện tử Hoàn chỉnh**: Xử lý trọn vẹn luồng từ Tìm kiếm sách $\rightarrow$ Xem chi tiết $\rightarrow$ Giỏ hàng $\rightarrow$ Áp Voucher $\rightarrow$ Thanh toán $\rightarrow$ Theo dõi trạng thái đơn hàng.
3. **Phân quyền RBAC Chuyên nghiệp**: Thiết kế hệ thống phân quyền linh hoạt cho môi trường doanh nghiệp (Multi-role authorization).
4. **Tương tác Realtime & Bot Engine**: Tích hợp widget CSKH thông minh có khả năng vừa trả lời tự động vừa trực ca bởi tư vấn viên.
5. **Clean Code & Phân lớp Rõ ràng**: Tách biệt rõ ràng giữa Presentational Components, Smart Components, Services, Interfaces và Guards.

---

## 👤 Tác Giả & Liên Hệ (Author Info)

* **Họ và tên**: Nguyễn Tấn Tường Huy
* **Vị trí ứng tuyển**: Frontend / Fullstack Developer Intern
* **Email**: [nguyentantuonghuy@gmail.com](mailto:nguyentantuonghuy@gmail.com)
* **GitHub**: [https://github.com/nguyentantuonghuy26082006](https://github.com/nguyentantuonghuy26082006)

---

*Cảm ơn bạn đã ghé thăm repository! Chúc bạn một ngày làm việc hiệu quả!* 🚀

