import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Book } from '../../interfaces/book';
import { BookService } from '../../services/book.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css'
})
export class HomeComponent {
  public bookService = inject(BookService);

  readonly items = [
    { image: '/image/carousel1.jpg' },
    { image: '/image/carousel2.jpg' },
    { image: '/image/carousel3.jpg' }
  ];

  categories = this.bookService.getCategories();
  selectedCategory = this.bookService.selectedCategory;

  // số trang hiện tại
  currentPage = signal(1);
  // số sách mỗi trang
  pageSize = signal(4);

  // danh sách sách sau khi tìm kiếm và chọn danh mục
  filteredBooks = computed(() => {
    let list = this.bookService.allBooks();

    // 1. Lọc theo từ khóa tìm kiếm từ BookService
    const query = this.bookService.searchQuery();
    if (query) {
      list = list.filter(
        (book) =>
          book.title.toLowerCase().includes(query) ||
          book.author.toLowerCase().includes(query)
      );
    }

    // 2. Lọc theo danh mục
    let result = list;
    if (this.selectedCategory() !== 'TẤT CẢ EBOOK') {
      const categoryObj = this.categories.find((item) => item.name === this.selectedCategory());
      const categoryValue = categoryObj ? categoryObj.value : 'all';
      result = list.filter((book) => book.category === categoryValue || book.category === this.selectedCategory());
    }

    // 3. Sắp xếp từ A đến Z theo tên sách (title)
    return result.slice().sort((a, b) => a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' }));
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
    this.selectedCategory.set(category);
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

  discountPrice(price = 0, discount = '0%'): number {
    const discountPercent = Number.parseFloat(discount.replace('%', ''));
    const safeDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;

    return Math.round(price * (1 - safeDiscount / 100));
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  trackByBookId(_: number, book: Book): string {
    return book.id;
  }
}
