import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Book } from '../../interfaces/book';
import { BookService } from '../../services/book.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { ReviewService, Review } from '../../services/review.service';
import { CheckoutService } from '../../services/checkout.service';
import { CustomerService } from '../../services/customer.service';
import { removeAccents } from '../../utils/string-utils';

@Component({
  selector: 'app-book-detail',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './book-detail.html',
  styleUrl: './book-detail.css'
})
export class BookDetailComponent implements OnInit {
  bookService = inject(BookService);
  private route = inject(ActivatedRoute);
  private cartService = inject(CartService);
  private router = inject(Router);
  authService = inject(AuthService);
  reviewService = inject(ReviewService);
  checkoutService = inject(CheckoutService);
  customerService = inject(CustomerService);

  bookId = signal<string>('');
  bookDetail = computed(() => this.bookService.getBookById(this.bookId()) ?? null);
  categories = computed(() => this.bookService.getCategories());
  quantity = signal(1);
  isExpanded = signal(false);
  sidebarQuery = signal('');
  showSidebarDropdown = signal(false);
  activeSuggestionIndex = signal(-1);

  // Đánh giá & Bình luận
  ratingInput = signal(5);
  commentInput = signal('');
  reviewMessage = signal('');
  showWriteForm = signal(false);
  selectedRatingFilter = signal<number | null>(null); // Google-like rating filter (e.g. 5, 4, null)

  reviewsForBook = computed(() => this.reviewService.getReviewsByBook(this.bookId()));

  filteredReviews = computed(() => {
    const revs = this.reviewsForBook();
    const filter = this.selectedRatingFilter();
    if (filter === null) return revs;
    return revs.filter(r => Math.round(r.rating || 0) === filter);
  });

  averageRating = computed(() => {
    const revs = this.reviewsForBook();
    if (revs.length === 0) return '5.0';
    const sum = revs.reduce((acc, r) => acc + r.rating, 0);
    return (sum / revs.length).toFixed(1);
  });

  ratingStarsCount = computed(() => {
    const ratingVal = parseFloat(this.averageRating());
    const full = Math.floor(ratingVal);
    const half = ratingVal - full >= 0.4 ? 1 : 0;
    const empty = 5 - full - half;
    return {
      full: Array(full).fill(0),
      half: Array(half).fill(0),
      empty: Array(empty).fill(0)
    };
  });

  ratingBreakdown = computed(() => {
    const list = this.reviewsForBook();
    const breakdown = [0, 0, 0, 0, 0];
    list.forEach(r => {
      const rating = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
      breakdown[rating - 1]++;
    });
    return breakdown.map((count, index) => {
      const stars = index + 1;
      const percentage = list.length === 0 ? 0 : Math.round((count / list.length) * 100);
      return { stars, count, percentage };
    }).reverse();
  });

  getCustomerAvatar(userId: string): string | null {
    if (!userId) return null;
    const cust = this.customerService.getCustomers().find(c => c.id === userId || c.email === userId);
    return cust?.avatar || null;
  }

  constructor() { }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.bookId.set(id);
        this.quantity.set(1);
      }
    });

    // Cuộn lên đầu trang khi vào trang chi tiết
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }

  discountPrice(price: number, discount: string | undefined | null = '0%'): number {
    const safeDiscountStr = discount || '0%';
    const discountPercent = Number.parseFloat(safeDiscountStr.replace('%', ''));
    const safeDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;

    return Math.round(price - price * (safeDiscount / 100));
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  categoryName(categoryValue: string): string {
    return this.bookService.getCategoryName(categoryValue);
  }


  selectCategory(categoryName: string): void {
    this.bookService.selectedCategory.set(categoryName);
    this.router.navigate(['/']);
  }

  toggleExpand(): void {
    this.isExpanded.update(val => !val);
  }

  onSidebarSearch(query: string): void {
    this.bookService.onSearch(query);
    this.router.navigate(['/']);
  }

  onSidebarInput(query: string): void {
    this.sidebarQuery.set(query);
    this.showSidebarDropdown.set(true);
    this.activeSuggestionIndex.set(-1);
  }

  getSidebarSuggestions(): Book[] {
    const query = removeAccents(this.sidebarQuery().trim().toLowerCase());
    if (!query) return [];
    return this.bookService.getBooks().filter(book =>
      removeAccents(book.title).toLowerCase().includes(query) ||
      removeAccents(book.author).toLowerCase().includes(query)
    ).slice(0, 8);
  }

  selectSidebarSuggestion(book: Book): void {
    this.sidebarQuery.set(''); // Clear search box for a clean next state
    this.showSidebarDropdown.set(false);
    this.activeSuggestionIndex.set(-1);
    this.router.navigate(['/book', book.id]);
  }

  onSidebarKeyDown(event: KeyboardEvent, suggestions: Book[]): void {
    if (suggestions.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.activeSuggestionIndex.update(idx => (idx + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.activeSuggestionIndex.update(idx => (idx - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const activeIdx = this.activeSuggestionIndex();
      if (activeIdx >= 0 && activeIdx < suggestions.length) {
        this.selectSidebarSuggestion(suggestions[activeIdx]);
      } else {
        this.onSidebarSearch(this.sidebarQuery());
      }
    } else if (event.key === 'Escape') {
      this.showSidebarDropdown.set(false);
    }
  }

  onSidebarBlur(): void {
    setTimeout(() => {
      this.showSidebarDropdown.set(false);
    }, 200);
  }

  categoryCount(categoryValue: string): number {
    return this.bookService.getBooks().filter(book =>
      this.bookService.matchesCategory(book.category, categoryValue)
    ).length;
  }

  relatedBooks(currentBook: Book): Book[] {
    return this.bookService
      .getBooks()
      .filter((book) => book.category === currentBook.category && book.id !== currentBook.id)
      .slice(0, 4);
  }

  increaseQuantity(): void {
    const book = this.bookDetail();
    if (book && this.quantity() < book.stock) {
      this.quantity.update((value) => value + 1);
    }
  }

  decreaseQuantity(): void {
    if (this.quantity() > 1) {
      this.quantity.update((value) => value - 1);
    }
  }

  addToCart(): void {
    const book = this.bookDetail();

    if (!book) {
      return;
    }

    this.cartService.addToCart(book, this.quantity());
  }

  submitReview(): void {
    if (!this.authService.isLoggedIn()) {
      this.reviewMessage.set('Vui lòng đăng nhập để gửi đánh giá.');
      return;
    }

    const user = this.authService.currentUser();
    const comment = this.commentInput().trim();
    if (!comment) {
      this.reviewMessage.set('Vui lòng nhập nội dung đánh giá.');
      return;
    }

    if (!user) return;

    this.reviewService.addReview(
      this.bookId(),
      user.id || user.email,
      user.name || user.fullname || user.username || 'Khách hàng',
      this.ratingInput(),
      comment
    );

    this.commentInput.set('');
    this.ratingInput.set(5);
    this.reviewMessage.set('Cảm ơn bạn đã gửi nhận xét thành công!');
    this.showWriteForm.set(false);

    setTimeout(() => {
      this.reviewMessage.set('');
    }, 4000);
  }

  toggleRatingFilter(stars: number): void {
    this.selectedRatingFilter.update(current => current === stars ? null : stars);
  }

  isVerifiedPurchase(userId: string, bookId: string): boolean {
    return this.checkoutService.hasUserPurchasedBook(userId, bookId);
  }
}
