import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { Book } from '../../interfaces/book';
import { BookService } from '../../services/book.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { removeAccents } from '../../utils/string-utils';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent implements OnInit, OnDestroy {
  public bookService = inject(BookService);
  public cartService = inject(CartService);
  public authService = inject(AuthService);
  private storageService = inject(StorageService);
  private router = inject(Router);

  wishlist = this.bookService.wishlist;

  activeSlideIndex = signal(0);

  ngOnInit(): void {
    // Giữ nguyên selectedCategory đã được chọn từ trang chi tiết hoặc thanh tiêu đề chứ không reset về mặc định

    // Load wishlist to sync
    if (typeof window !== 'undefined') {
      const savedWishlist = this.storageService.get<string[]>('wishlist') || [];
      this.wishlist.set(savedWishlist);
    }

    this.startSlideShow();
  }

  ngOnDestroy(): void {
    this.stopSlideShow();
  }

  toggleWishlist(bookId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!this.authService.isLoggedIn()) {
      this.cartService.showToast('Bạn cần đăng nhập để sử dụng tính năng Yêu thích!');
      this.router.navigate(['/login']);
      return;
    }

    const current = [...this.wishlist()];
    const index = current.indexOf(bookId);
    if (index > -1) {
      current.splice(index, 1);
      this.cartService.showToast('Đã xóa khỏi danh sách yêu thích.');
    } else {
      current.push(bookId);
      this.cartService.showToast('Đã thêm vào danh sách yêu thích!');
    }
    this.wishlist.set(current);
    this.storageService.set('wishlist', current);
  }


  readonly items = [
    {
      image: '/image/carousel1.jpg',
      badge: 'SẢN PHẨM MỚI',
      title: 'Khám Phá Thế Giới Ebook Cao Cấp',
      desc: 'Truy cập hàng nghìn tựa sách điện tử chất lượng từ các nhà xuất bản hàng đầu.',
      btnText: 'Xem Sản Phẩm',
      link: '/products'
    },
    {
      image: '/image/carousel2.jpg',
      badge: 'VỀ CHÚNG TÔI',
      title: 'Giới Thiệu Nhà Sách Bookstore',
      desc: 'Tìm hiểu về sứ mệnh kết nối tri thức và hành trình phát triển của chúng tôi.',
      btnText: 'Đọc Giới Thiệu',
      link: '/about'
    },
    {
      image: '/image/carousel3.jpg',
      badge: 'TIN TỨC MỚI',
      title: 'Tin Tức & Sự Kiện Nổi Bật',
      desc: 'Cập nhật các hoạt động văn hóa đọc và thông tin phát hành sách mới nhất.',
      btnText: 'Xem Tin Tức',
      link: '/news'
    }
  ];

  categories = computed(() => this.bookService.getCategories());
  selectedCategory = this.bookService.selectedCategory;

  // số trang hiện tại
  currentPage = signal(1);
  // số sách mỗi trang
  pageSize = signal(4);

  selectedAuthor = signal<string>('');

  // danh sách sách sau khi tìm kiếm và chọn danh mục hoặc tác giả
  filteredBooks = computed(() => {
    let list = this.bookService.allBooks();

    // 1. Lọc theo từ khóa tìm kiếm từ BookService
    const query = removeAccents(this.bookService.searchQuery().trim().toLowerCase());
    const queryWords = query.split(/\s+/).filter(w => w.length > 0);
    if (queryWords.length > 0) {
      list = list.filter(
        (book) => {
          const titleNorm = removeAccents(book.title || '').toLowerCase();
          const authorNorm = removeAccents(book.author || '').toLowerCase();
          const fullText = `${titleNorm} ${authorNorm}`;
          return queryWords.every(w => fullText.includes(w));
        }
      );
    }

    // 2. Lọc theo tác giả
    if (this.selectedAuthor()) {
      const authorQuery = removeAccents(this.selectedAuthor().trim().toLowerCase());
      list = list.filter((book) => removeAccents(book.author).toLowerCase().includes(authorQuery));
    }

    // 3. Lọc theo danh mục (chỉ khi không có bộ lọc tác giả)
    let result = list;
    if (!this.selectedAuthor() && this.selectedCategory() !== 'TẤT CẢ EBOOK') {
      result = list.filter(book =>
        this.bookService.matchesCategory(book.category, this.selectedCategory())
      );
    }

    // 4. Sắp xếp từ A đến Z theo tên sách (title)
    return result.slice().sort((a, b) => a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' }));
  });

  bestSellerBooks = computed(() => {
    const all = this.bookService.allBooks();
    const discounted = all.filter(b => b.discount && b.discount !== '0%');
    if (discounted.length >= 4) {
      return discounted.slice(0, 4);
    }
    return all.slice(0, 4);
  });

  featuredBooks = computed(() => {
    const all = this.bookService.allBooks();
    const rest = all.slice(4, 8);
    if (rest.length > 0) {
      return rest;
    }
    return all.slice(0, 4);
  });

  // tính tổng số trang
  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredBooks().length / this.pageSize())));

  // trang đang hiển thị thực tế, tránh trường hợp tìm kiếm làm số trang giảm
  activePage = computed(() => Math.min(this.currentPage(), this.totalPages()));

  // danh sách sách trong trang hiện tại
  pagedBooks = computed(() => {
    const start = (this.activePage() - 1) * this.pageSize();
    const end = start + this.pageSize();
    return this.filteredBooks().slice(start, end);
  });

  // vị trí bắt đầu của danh sách đang hiển thị
  startIndex = computed(() => this.filteredBooks().length === 0 ? 0 : (this.activePage() - 1) * this.pageSize() + 1);

  // vị trí kết thúc của danh sách đang hiển thị
  endIndex = computed(() => Math.min(this.activePage() * this.pageSize(), this.filteredBooks().length));

  // tổng số sách
  totalItems = computed(() => this.filteredBooks().length);


  selectCategory(category: string): void {
    this.selectedAuthor.set(''); // Clear author filter when switching categories
    this.selectedCategory.set(category);
    this.currentPage.set(1);
  }

  filterByAuthor(authorName: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.selectedAuthor.set(authorName);
    this.selectedCategory.set('TẤT CẢ EBOOK'); // Default category to all
    this.currentPage.set(1);

    // Scroll smoothly to the ebook section
    setTimeout(() => {
      const element = document.getElementById('ebook-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  }

  clearAuthorFilter(): void {
    this.selectedAuthor.set('');
    this.currentPage.set(1);
  }

  getPagination(): (number | string)[] {
    const pageNumbers: (number | string)[] = [];
    const totalPages = this.totalPages();
    const currentPage = this.activePage();

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      if (currentPage > 3) {
        pageNumbers.push(1, '...');
      }

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pageNumbers.push(i);
      }

      if (currentPage < totalPages - 2) {
        pageNumbers.push('...', totalPages);
      }
    }

    return pageNumbers;
  }

  // Cập nhật trang hiện tại
  setCurrentPage(page: number | string): void {
    if (typeof page === 'number' && page > 0 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  discountPrice(price = 0, discount: string | undefined | null = '0%'): number {
    const safeDiscountStr = discount || '0%';
    const discountPercent = Number.parseFloat(safeDiscountStr.replace('%', ''));
    const safeDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;

    return Math.round(price * (1 - safeDiscount / 100));
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  trackByBookId(_: number, book: Book): string {
    return book.id;
  }

  private slideDuration = 5000;
  private startTime = 0;
  private remainingTime = 5000;
  private timeoutId: any;

  startSlideShow(): void {
    if (typeof window !== 'undefined') {
      this.stopSlideShow();
      this.startTime = Date.now();
      this.timeoutId = setTimeout(() => {
        this.nextSlide();
        this.remainingTime = this.slideDuration;
        this.startSlideShow();
      }, this.remainingTime);
    }
  }

  stopSlideShow(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  nextSlide(): void {
    this.activeSlideIndex.set((this.activeSlideIndex() + 1) % this.items.length);
    this.remainingTime = this.slideDuration;
  }

  prevSlide(): void {
    this.activeSlideIndex.set((this.activeSlideIndex() - 1 + this.items.length) % this.items.length);
    this.remainingTime = this.slideDuration;
  }

  nextSlideManual(): void {
    this.nextSlide();
    this.resetSlideInterval();
  }

  prevSlideManual(): void {
    this.prevSlide();
    this.resetSlideInterval();
  }

  goToSlide(index: number): void {
    this.activeSlideIndex.set(index);
    this.remainingTime = this.slideDuration;
    this.resetSlideInterval();
  }

  pauseSlideShow(): void {
    this.stopSlideShow();
    const elapsed = Date.now() - this.startTime;
    this.remainingTime = Math.max(0, this.remainingTime - elapsed);
  }

  resumeSlideShow(): void {
    this.startSlideShow();
  }

  private resetSlideInterval(): void {
    this.stopSlideShow();
    this.remainingTime = this.slideDuration;
    this.startSlideShow();
  }
}
