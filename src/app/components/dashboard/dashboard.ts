import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { EbookComponent } from '../admin/ebook/ebook';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, EbookComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css'
})
export class DashboardComponent {
  router = inject(Router);
  activeTab = 'Dashboard';

  selectTab(tabName: string) {
    if (tabName === 'Home') {
      this.router.navigate(['/']);
      return;
    }
    this.sidebarItems.forEach(item => {
      item.active = (item.name === tabName);
    });
    this.activeTab = tabName;
  }

  adminName = 'Hi Admin';
  adminAvatar = '/image/danhmuc3.png';

  sidebarItems = [
    { name: 'Dashboard', icon: 'bi bi-speedometer2', active: true },
    { name: 'Home', icon: 'bi bi-house', active: false },
    { name: 'Products', icon: 'bi bi-book', active: false },
    { name: 'Orders', icon: 'bi bi-cart', active: false },
    { name: 'Employees', icon: 'bi bi-people', active: false },
    { name: 'Customers', icon: 'bi bi-person-check', active: false },
    { name: 'Permissions', icon: 'bi bi-shield-lock', active: false },
    { name: 'Role Permissions', icon: 'bi bi-key', active: false },
    { name: 'Settings', icon: 'bi bi-gear', active: false }
  ];

  statsCards = [
    {
      title: 'Khách hàng',
      value: '1,245',
      color: 'bg-primary-custom',
      icon: 'bi bi-people-fill',
      textColor: 'text-white'
    },
    {
      title: 'Doanh thu',
      value: '124,500,000 đ',
      color: 'bg-success-custom',
      icon: 'bi bi-currency-dollar',
      textColor: 'text-white'
    },
    {
      title: 'Đơn hàng',
      value: '320',
      color: 'bg-warning-custom',
      icon: 'bi bi-bag-check-fill',
      textColor: 'text-white'
    },
    {
      title: 'Sách sắp hết',
      value: '18 cuốn',
      color: 'bg-danger-custom',
      icon: 'bi bi-exclamation-triangle-fill',
      textColor: 'text-white'
    }
  ];

  topSellingBooks = [
    {
      title: 'Vua chúa Việt và những điều chưa biết',
      price: '51.000 đ',
      originalPrice: '60.000 đ',
      sold: 145,
      stock: 50,
      image: '/image/ebooknew1.jpg',
      category: 'Lịch sử',
      progressWidth: '85%'
    },
    {
      title: 'Phan Yên thành binh biến ký - Toàn cảnh cuộc nổi dậy',
      price: '78.200 đ',
      originalPrice: '92.000 đ',
      sold: 98,
      stock: 42,
      image: '/image/ebooknew2.jpg',
      category: 'Lịch sử',
      progressWidth: '65%'
    },
    {
      title: 'Quá trình phi thực dân hóa và con đường đi lên',
      price: '113.900 đ',
      originalPrice: '134.000 đ',
      sold: 76,
      stock: 88,
      image: '/image/ebooknew3.jpg',
      category: 'Chính trị',
      progressWidth: '50%'
    },
    {
      title: 'English Grammar in Use for ESL Writing',
      price: '54.400 đ',
      originalPrice: '64.000 đ',
      sold: 120,
      stock: 12,
      image: '/image/ebooknew4.jpg',
      category: 'Giáo trình',
      progressWidth: '78%'
    }
  ];

  activeStaff = [
    { name: 'Nguyễn Minh Anh', role: 'Sales Manager', status: 'Online', avatarColor: '#0d6efd', taskCompletion: '92%' },
    { name: 'Trần Hoàng Long', role: 'Editor', status: 'Busy', avatarColor: '#ffc107', taskCompletion: '80%' },
    { name: 'Phạm Phương Thảo', role: 'Customer Care', status: 'Online', avatarColor: '#198754', taskCompletion: '95%' }
  ];

  salesTrends = [
    { month: 'T2', amount: '12M' },
    { month: 'T3', amount: '18M' },
    { month: 'T4', amount: '15M' },
    { month: 'T5', amount: '28M' },
    { month: 'T6', amount: '35M' },
    { month: 'T7', amount: '45M' }
  ];

  recentReviews = [
    {
      customer: 'Lê Hoài Nam',
      rating: 5,
      bookTitle: 'Vua chúa Việt và những điều chưa biết',
      comment: 'Sách rất hay, tài liệu lịch sử triều Nguyễn biên soạn rất công phu và dễ tiếp cận.',
      time: '10 phút trước',
      avatarLetters: 'LN'
    },
    {
      customer: 'Trần Thu Thủy',
      rating: 4,
      bookTitle: 'English Grammar in Use',
      comment: 'Bố cục bài tập rất rõ ràng, thích hợp để ôn thi đại học và cải thiện ngữ pháp.',
      time: '1 giờ trước',
      avatarLetters: 'TT'
    },
    {
      customer: 'Phạm Quốc Bảo',
      rating: 5,
      bookTitle: 'Phan Yên thành binh biến ký',
      comment: 'Một cuốn sách lịch sử đáng đọc, giúp sáng tỏ nhiều góc khuất của sự kiện Lê Văn Khôi.',
      time: '3 giờ trước',
      avatarLetters: 'QB'
    }
  ];

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

  adminTasks = [
    { title: 'Duyệt danh sách sách mới nhập từ NXB Giáo Dục', done: false },
    { title: 'Cập nhật Banner trang chủ khuyến mãi tháng 6', done: true },
    { title: 'Kiểm kê kho sách Văn học sắp hết (Stock < 10)', done: false },
    { title: 'Gửi báo cáo doanh thu tuần cho đối tác liên kết', done: true }
  ];

  // THÔNG TIN BÁO CÁO PHÂN TÍCH KHÁCH HÀNG MỚI:
  customerStats = {
    totalMembers: '1,245',
    activeRate: '67.6%',
    newToday: '+18',
    vipMembers: '312'
  };

  weeklyCustomers = [
    { day: 'Thứ 2', newUsers: 45, height: '70px', percent: '45%' },
    { day: 'Thứ 3', newUsers: 60, height: '90px', percent: '60%' },
    { day: 'Thứ 4', newUsers: 85, height: '130px', percent: '85%' },
    { day: 'Thứ 5', newUsers: 50, height: '80px', percent: '50%' },
    { day: 'Thứ 6', newUsers: 95, height: '145px', percent: '95%' },
    { day: 'Thứ 7', newUsers: 120, height: '180px', percent: '100%' },
    { day: 'Chủ Nhật', newUsers: 110, height: '165px', percent: '90%' }
  ];

  toggleTask(task: any) {
    task.done = !task.done;
  }
}
