import { Component, inject, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EbookComponent } from '../ebook/ebook';
import { EmployeesComponent } from '../employees/employees';
import { CustomersComponent } from '../customers/customers';
import { OrderlistComponent } from '../orderlist/orderlist';
import { PermissionsComponent } from '../permissions/permissions';
import { RolePermissionsComponent } from '../role-permissions/role-permissions';
import { SettingsComponent } from '../settings/settings';
import { NewsManageComponent } from '../news-manage/news-manage';
import { ContactManageComponent } from '../contact-manage/contact-manage';
import { ReviewsManageComponent } from '../reviews-manage/reviews-manage';
import { EmailsComponent } from '../emails/emails';
import { PromotionsManageComponent } from '../promotions-manage/promotions-manage';
import { ChatManageComponent } from '../chat-manage/chat-manage';
import { EmailService } from '../../../services/email.service';
import { ReviewService } from '../../../services/review.service';
import { AuthService } from '../../../services/auth.service';
import { CheckoutService } from '../../../services/checkout.service';
import { BookService } from '../../../services/book.service';
import { CustomerService } from '../../../services/customer.service';
import { EmployeeService } from '../../../services/employee.service';
import { StorageService } from '../../../services/storage.service';
import { ChatService } from '../../../services/chat.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterLink, 
    FormsModule,
    EbookComponent, 
    EmployeesComponent, 
    CustomersComponent, 
    OrderlistComponent,
    PermissionsComponent,
    RolePermissionsComponent,
    SettingsComponent,
    NewsManageComponent,
    ContactManageComponent,
    ReviewsManageComponent,
    EmailsComponent,
    PromotionsManageComponent,
    ChatManageComponent
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  router = inject(Router);
  authService = inject(AuthService);
  checkoutService = inject(CheckoutService);
  bookService = inject(BookService);
  customerService = inject(CustomerService);
  employeeService = inject(EmployeeService);
  storageService = inject(StorageService);
  reviewService = inject(ReviewService);
  emailService = inject(EmailService);
  chatService = inject(ChatService);

  previewingDispatchedEmail = signal<any>(null);

  showDispatchedPreview(email: any) {
    this.previewingDispatchedEmail.set(email);
    this.emailService.dismissEmailToast(email.id);
  }

  activeTab = 'Dashboard';
  adminTasks = signal<any[]>([]);
  hoveredPoint = signal<any>(null);

  // Advanced Report Date Filters signals
  dateFilterType = signal<string>('all'); // 'all', 'today', '7days', '30days', 'thisMonth', 'custom'
  customStartDate = signal<string>(new Date().toISOString().substring(0, 10));
  customEndDate = signal<string>(new Date().toISOString().substring(0, 10));

  // Compute start/end Date objects based on chosen filter
  activeDateRange = computed(() => {
    const filter = this.dateFilterType();
    const now = new Date();
    
    let start: Date | null = null;
    let end: Date | null = null;
    
    if (filter === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (filter === 'yesterday') {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      start = yesterday;
      end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
    } else if (filter === '7days') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      start = d;
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (filter === '30days') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      start = d;
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (filter === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    } else if (filter === 'custom') {
      const startInput = this.customStartDate();
      const endInput = this.customEndDate();
      if (startInput) {
        const parts = startInput.split('-');
        start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      }
      if (endInput) {
        const parts = endInput.split('-');
        end = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999);
      }
    }
    
    return { start, end };
  });

  // Filter orders reactively based on activeDateRange
  filteredOrders = computed(() => {
    const orders = this.checkoutService.orders();
    const range = this.activeDateRange();
    
    if (!range.start && !range.end) {
      return orders;
    }
    
    return orders.filter(o => {
      const date = new Date(o.createdAt);
      if (isNaN(date.getTime())) return false;
      
      if (range.start && date < range.start) return false;
      if (range.end && date > range.end) return false;
      
      return true;
    });
  });

  constructor() {
    // If the active tab is not in the allowed sidebar items after roles change, redirect to the first allowed tab.
    effect(() => {
      const allowedItems = this.filteredSidebarItems();
      const isCurrentAllowed = allowedItems.some(item => item.name === this.activeTab);
      if (!isCurrentAllowed && allowedItems.length > 0) {
        this.activeTab = allowedItems[0].name;
      }
    });

    // Load admin tasks from storage
    this.adminTasks.set(this.storageService.getOrCreate('admin_tasks', [
      { title: 'Duyệt danh sách sách mới nhập từ NXB Giáo Dục', done: false },
      { title: 'Cập nhật Banner trang chủ khuyến mãi tháng 6', done: true },
      { title: 'Kiểm kê kho sách Văn học sắp hết (Stock < 10)', done: false },
      { title: 'Gửi báo cáo doanh thu tuần cho đối tác liên kết', done: true }
    ]));
  }

  logout() {
    this.authService.logout();
  }

  selectTab(tabName: string) {
    if (tabName === 'Home') {
      this.router.navigate(['/']);
      return;
    }
    this.activeTab = tabName;
  }

  adminName = 'Hi Admin';
  adminAvatar = '/image/danhmuc3.png';

  sidebarItems = [
    { name: 'Dashboard', icon: 'bi bi-speedometer2', active: true },
    { name: 'Home', icon: 'bi bi-house', active: false },
    { name: 'Products', icon: 'bi bi-book', active: false },
    { name: 'Orders', icon: 'bi bi-cart', active: false },
    { name: 'Promotions', icon: 'bi bi-tags', active: false },
    { name: 'News', icon: 'bi bi-journal-text', active: false },
    { name: 'Reviews', icon: 'bi bi-star-half', active: false },
    { name: 'Contacts', icon: 'bi bi-envelope-heart', active: false },
    { name: 'Employees', icon: 'bi bi-people', active: false },
    { name: 'Customers', icon: 'bi bi-person-check', active: false },
    { name: 'Permissions', icon: 'bi bi-shield-lock', active: false },
    { name: 'Role Permissions', icon: 'bi bi-key', active: false },
    { name: 'Settings', icon: 'bi bi-gear', active: false },
    { name: 'Emails', icon: 'bi bi-envelope-at', active: false },
    { name: 'Live Chat', icon: 'bi bi-chat-dots-fill', active: false }
  ];

  filteredSidebarItems = computed(() => {
    const user = this.authService.currentUser();
    if (!user) return [];

    // Super Admin has all privileges
    if (user.role === 'admin') {
      return this.sidebarItems;
    }

    return this.sidebarItems.filter(item => {
      switch (item.name) {
        case 'Dashboard':
          return user.permissions?.includes('DASHBOARD_VIEW') ?? false;
        case 'Products':
          return user.permissions?.includes('PRODUCTS_VIEW') ?? false;
        case 'Orders':
          return user.permissions?.includes('ORDERS_VIEW') ?? false;
        case 'Promotions':
          return user.permissions?.includes('PROMOTIONS_VIEW') ?? false;
        case 'News':
          return user.permissions?.includes('NEWS_VIEW') ?? false;
        case 'Reviews':
          return user.permissions?.includes('REVIEWS_VIEW') ?? false;
        case 'Contacts':
          return user.permissions?.includes('CONTACT_VIEW') ?? false;
        case 'Employees':
          return user.permissions?.includes('EMPLOYEES_VIEW') ?? false;
        case 'Customers':
          return user.permissions?.includes('CUSTOMERS_VIEW') ?? false;
        case 'Permissions':
        case 'Role Permissions':
          return user.permissions?.includes('PERMISSIONS_MANAGE') ?? false;
        case 'Settings':
          return user.permissions?.includes('SETTINGS_MANAGE') ?? false;
        case 'Emails':
          return user.permissions?.includes('EMAIL_MANAGE') ?? false;
        case 'Live Chat':
          return user.permissions?.includes('CHAT_VIEW') ?? false;
        default:
          return true; // Home
      }
    });
  });

  discountPrice(price = 0, discount: string | undefined | null = '0%'): number {
    const safeDiscountStr = discount || '0%';
    const discountPercent = parseFloat(safeDiscountStr.replace('%', ''));
    const safeDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;
    return price * (1 - safeDiscount / 100);
  }

  formatPrice(val: number): string {
    return val.toLocaleString('vi-VN') + ' đ';
  }

  statsCards = computed(() => {
    const customersCount = this.customerService.customers().length;
    const orders = this.filteredOrders();
    const completedOrders = orders.filter(o => o.status === 'Đã giao hàng');
    const revenue = completedOrders.reduce((sum, o) => sum + o.total, 0);
    const lowStockBooksCount = this.bookService.allBooks().filter(b => b.stock <= 10).length;
 
    return [
      {
        title: 'Khách hàng',
        value: customersCount.toLocaleString('vi-VN'),
        color: 'bg-primary-custom',
        icon: 'bi bi-people-fill',
        textColor: 'text-white'
      },
      {
        title: 'Doanh thu',
        value: this.formatPrice(revenue),
        color: 'bg-success-custom',
        icon: 'bi bi-currency-dollar',
        textColor: 'text-white'
      },
      {
        title: 'Đơn hàng',
        value: orders.length.toLocaleString('vi-VN'),
        color: 'bg-warning-custom',
        icon: 'bi bi-bag-check-fill',
        textColor: 'text-white'
      },
      {
        title: 'Sách sắp hết',
        value: lowStockBooksCount + ' cuốn',
        color: 'bg-danger-custom',
        icon: 'bi bi-exclamation-triangle-fill',
        textColor: 'text-white'
      }
    ];
  });
 
  topSellingBooks = computed(() => {
    const orders = this.filteredOrders();
    const books = this.bookService.allBooks();
 
    const soldMap = new Map<string, number>();
    orders.forEach(order => {
      if (order.status !== 'Hủy đơn hàng') {
        order.items?.forEach((item: any) => {
          const qty = item.quantity || 1;
          const productId = item.productId?.toString();
          if (productId) {
            soldMap.set(productId, (soldMap.get(productId) || 0) + qty);
          }
        });
      }
    });
 
    const mappedBooks = books.map(book => {
      const sold = soldMap.get(book.id?.toString() || '') || 0;
      const stock = book.stock || 0;
      const total = sold + stock;
      const percent = total > 0 ? Math.round((sold / total) * 100) : 0;
      
      return {
        title: book.title,
        price: this.formatPrice(this.discountPrice(book.price, book.discount)),
        originalPrice: book.discount && book.discount !== '0%' ? this.formatPrice(book.price) : '',
        sold: sold,
        stock: stock,
        image: book.image,
        category: this.bookService.getCategoryName(book.category),
        progressWidth: percent + '%'
      };
    });
 
    mappedBooks.sort((a, b) => {
      if (b.sold !== a.sold) {
        return b.sold - a.sold;
      }
      return b.stock - a.stock;
    });
 
    return mappedBooks.slice(0, 4);
  });

  activeStaff = computed(() => {
    const employees = this.employeeService.employees();
    const statuses = ['Online', 'Busy', 'Offline'];
    const colors = ['#0d6efd', '#ffc107', '#198754', '#6c757d', '#dc3545'];
    const rolesList = ['Sales Manager', 'Editor', 'Customer Care', 'Store Keeper'];

    return employees.map((emp, index) => {
      const seed = emp.id ? parseInt(emp.id) : index;
      const status = seed === 1 ? 'Online' : (seed % 3 === 0 ? 'Busy' : (seed % 3 === 1 ? 'Online' : 'Offline'));
      const avatarColor = colors[seed % colors.length];
      const role = rolesList[seed % rolesList.length];
      const taskCompletion = (80 + (seed * 7) % 20) + '%';

      return {
        name: emp.fullname,
        role: role,
        status: status,
        avatarColor: avatarColor,
        taskCompletion: taskCompletion
      };
    });
  });

  salesChart = computed(() => {
    const orders = this.filteredOrders().filter(o => o.status === 'Đã giao hàng');
    const filter = this.dateFilterType();
    const range = this.activeDateRange();
    
    let pointsData: { label: string; revenue: number }[] = [];
    
    if (filter === 'today' || filter === 'yesterday') {
      const hourlyBins = [
        { label: '00:00', startHour: 0, endHour: 4 },
        { label: '04:00', startHour: 4, endHour: 8 },
        { label: '08:00', startHour: 8, endHour: 12 },
        { label: '12:00', startHour: 12, endHour: 16 },
        { label: '16:00', startHour: 16, endHour: 20 },
        { label: '20:00', startHour: 20, endHour: 24 }
      ];
      
      pointsData = hourlyBins.map(bin => {
        let revenue = 0;
        orders.forEach(o => {
          const date = new Date(o.createdAt);
          if (!isNaN(date.getTime())) {
            const hr = date.getHours();
            if (hr >= bin.startHour && hr < bin.endHour) {
              revenue += o.total;
            }
          }
        });
        return { label: bin.label, revenue };
      });
    }
    else if (
      filter === '7days' || 
      filter === '30days' || 
      filter === 'thisMonth' || 
      (filter === 'custom' && range.start && range.end && (range.end.getTime() - range.start.getTime()) <= 30 * 24 * 60 * 60 * 1000)
    ) {
      const start = range.start || new Date();
      const end = range.end || new Date();
      
      const daysList: { label: string; key: string; revenue: number }[] = [];
      const current = new Date(start.getFullYear(), start.getMonth(), start.getDate());
      const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      
      while (current <= last) {
        const dayLabel = `${current.getDate()}/${current.getMonth() + 1}`;
        const key = current.toDateString();
        daysList.push({ label: dayLabel, key, revenue: 0 });
        current.setDate(current.getDate() + 1);
      }
      
      orders.forEach(o => {
        const date = new Date(o.createdAt);
        if (!isNaN(date.getTime())) {
          const key = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toDateString();
          const match = daysList.find(d => d.key === key);
          if (match) {
            match.revenue += o.total;
          }
        }
      });
      
      pointsData = daysList.map(d => ({ label: d.label, revenue: d.revenue }));
    }
    else {
      const monthsList: { label: string; year: number; month: number; revenue: number }[] = [];
      
      if (filter === 'all' || !range.start || !range.end) {
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
          monthsList.push({
            label: `T${d.getMonth() + 1}/${d.getFullYear().toString().substring(2)}`,
            year: d.getFullYear(),
            month: d.getMonth(),
            revenue: 0
          });
        }
      } else {
        const start = range.start;
        const end = range.end;
        
        const current = new Date(start.getFullYear(), start.getMonth(), 1);
        const last = new Date(end.getFullYear(), end.getMonth(), 1);
        
        while (current <= last) {
          monthsList.push({
            label: `T${current.getMonth() + 1}/${current.getFullYear().toString().substring(2)}`,
            year: current.getFullYear(),
            month: current.getMonth(),
            revenue: 0
          });
          current.setMonth(current.getMonth() + 1);
        }
      }
      
      orders.forEach(o => {
        const date = new Date(o.createdAt);
        if (!isNaN(date.getTime())) {
          const y = date.getFullYear();
          const m = date.getMonth();
          const match = monthsList.find(mon => mon.year === y && mon.month === m);
          if (match) {
            match.revenue += o.total;
          }
        }
      });
      
      pointsData = monthsList.map(m => ({ label: m.label, revenue: m.revenue }));
    }
    
    const maxRev = Math.max(...pointsData.map(p => p.revenue), 100000);
    const chartWidth = 440;
    const pointsCount = pointsData.length;
    
    const points = pointsData.map((pt, index) => {
      const x = pointsCount > 1 
        ? 40 + index * (chartWidth / (pointsCount - 1)) 
        : 240;
      const y = 170 - (pt.revenue / maxRev) * 140;
      return { x, y, label: pt.label, revenue: pt.revenue };
    });
    
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += ` L ${points[i].x} ${points[i].y}`;
    }
    
    const areaPath = `${linePath} L ${points[points.length - 1].x} 170 L ${points[0].x} 170 Z`;
    
    return {
      points,
      linePath,
      areaPath
    };
  });

  recentReviews = computed(() => {
    const list = this.reviewService.reviews();
    // Get the top 5 most recent reviews
    const recent = list.slice(0, 5);

    return recent.map(r => {
      const book = this.bookService.getBookById(r.bookId);
      const fullname = r.customerName || 'Khách hàng ẩn danh';
      const parts = fullname.trim().split(' ');
      let avatar = 'KH';
      if (parts.length >= 2) {
        avatar = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      } else if (parts.length === 1 && parts[0].length > 0) {
        avatar = parts[0].substring(0, 2).toUpperCase();
      }

      // Calculate time ago or simple date
      const dateVal = new Date(r.createdAt);
      let timeStr = 'Vừa xong';
      if (!isNaN(dateVal.getTime())) {
        const diffMs = Date.now() - dateVal.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) {
          timeStr = 'Vừa xong';
        } else if (diffMins < 60) {
          timeStr = `${diffMins} phút trước`;
        } else {
          const diffHrs = Math.floor(diffMins / 60);
          if (diffHrs < 24) {
            timeStr = `${diffHrs} giờ trước`;
          } else {
            timeStr = dateVal.toLocaleDateString('vi-VN');
          }
        }
      }

      return {
        customer: fullname,
        rating: r.rating,
        bookTitle: book ? book.title : 'Sách ẩn danh',
        comment: r.comment,
        time: timeStr,
        avatarLetters: avatar
      };
    });
  });

  marketingCampaigns = [
    {
      name: 'Chào Hè Rực Rỡ - Giảm 15%',
      channel: 'Facebook Ads',
      budget: '5,000,000 đ',
      clicks: 1240,
      roi: 'x2.4',
      status: 'Đang chạy',
      statusClass: 'bg-success'
    },
    {
      name: 'Đồng giá Ebook Lịch sử 19K',
      channel: 'Email Marketing',
      budget: '1,500,000 đ',
      clicks: 850,
      roi: 'x3.1',
      status: 'Đang chạy',
      statusClass: 'bg-success'
    },
    {
      name: 'Khai trường rộn ràng - Mua Combo',
      channel: 'Google Search',
      budget: '8,000,000 đ',
      clicks: 2100,
      roi: 'x1.8',
      status: 'Tạm dừng',
      statusClass: 'bg-warning text-dark'
    }
  ];

  customerStats = computed(() => {
    const customers = this.customerService.customers();
    const orders = this.filteredOrders();
    
    const totalMembers = customers.length;
    
    const vipCount = customers.filter(c => {
      const userOrders = orders.filter(o => o.userId === c.id || o.userId === c.email);
      const totalSpent = userOrders.reduce((sum, o) => sum + o.total, 0);
      return totalSpent >= 200000;
    }).length;

    const activeCount = customers.filter(c => 
      orders.some(o => o.userId === c.id || o.userId === c.email)
    ).length;
    
    const activeRate = totalMembers > 0 
      ? ((activeCount / totalMembers) * 100).toFixed(1) + '%' 
      : '0%';

    const newToday = orders.filter(o => {
      const today = new Date().toDateString();
      const orderDate = new Date(o.createdAt).toDateString();
      return orderDate === today;
    }).length;

    return {
      totalMembers: totalMembers.toLocaleString('vi-VN'),
      activeRate: activeRate,
      newToday: '+' + newToday,
      vipMembers: vipCount.toLocaleString('vi-VN')
    };
  });

  weeklyCustomers = computed(() => {
    const orders = this.filteredOrders();
    const dayCounts = [0, 0, 0, 0, 0, 0, 0];
    
    orders.forEach(o => {
      const date = new Date(o.createdAt);
      if (!isNaN(date.getTime())) {
        const day = date.getDay();
        dayCounts[day] += 1;
      }
    });

    const dayLabels = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];
    const reorderedCounts = [
      dayCounts[1],
      dayCounts[2],
      dayCounts[3],
      dayCounts[4],
      dayCounts[5],
      dayCounts[6],
      dayCounts[0]
    ];

    const maxCount = Math.max(...reorderedCounts, 1);

    return dayLabels.map((day, index) => {
      const count = reorderedCounts[index];
      const percentValue = Math.max(10, Math.round((count / maxCount) * 100));
      return {
        day,
        newUsers: count,
        percent: percentValue + '%'
      };
    });
  });

  extraMetrics = computed(() => {
    const orders = this.filteredOrders();
    const totalOrders = orders.length;
    const cancelled = orders.filter(o => o.status === 'Hủy đơn hàng').length;
    const cancellationRate = totalOrders > 0 ? ((cancelled / totalOrders) * 100).toFixed(1) + '%' : '0.0%';
    
    const conversionRate = totalOrders > 0 ? (4.82 + (totalOrders % 5) * 0.1).toFixed(2) + '%' : '0.0%';
    const weeklyVisitsStr = totalOrders > 0 ? `+${(15.5 + (totalOrders % 10) * 1.5).toFixed(1)}%` : '0%';

    const reviews = this.recentReviews();
    const avgRating = reviews.length > 0 
      ? ((reviews.reduce((sum, r) => sum + r.rating, 0) / (reviews.length * 5)) * 100).toFixed(1) + '%'
      : '100%';

    return {
      weeklyVisits: weeklyVisitsStr,
      conversionRate,
      cancellationRate,
      goodRating: avgRating
    };
  });

  toggleTask(task: any) {
    this.adminTasks.update(tasks => {
      const updated = tasks.map(t => t.title === task.title ? { ...t, done: !t.done } : t);
      this.storageService.set('admin_tasks', updated);
      return updated;
    });
  }
}
