import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { ActivatedRoute, RouterLink, Router } from '@angular/router';
import { Book } from '../../interfaces/book';
import { BookService } from '../../services/book.service';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'app-book-detail',
  imports: [CommonModule, RouterLink],
  templateUrl: './book-detail.html',
  styleUrl: './book-detail.css'
})
export class BookDetailComponent implements OnInit {
  bookId = signal<string>('');
  bookDetail = computed(() => this.bookService.getBookById(this.bookId()) ?? null);
  quantity = signal(1);
  message = signal('');
  isExpanded = signal(false);
  sidebarQuery = signal('');
  showSidebarDropdown = signal(false);
  activeSuggestionIndex = signal(-1);

  constructor(
    public bookService: BookService,
    private route: ActivatedRoute,
    private cartService: CartService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.bookId.set(id);
        this.quantity.set(1);
        this.message.set('');
      }
    });

    // Cuộn lên đầu trang khi vào trang chi tiết
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
    }
  }

  discountPrice(price: number, discount = '0%'): number {
    const discountPercent = Number.parseFloat(discount.replace('%', ''));
    const safeDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;

    return Math.round(price - price * (safeDiscount / 100));
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  categoryName(categoryValue: string): string {
    const category = this.bookService.getCategories().find((item) => item.value === categoryValue);
    return category ? category.name : 'Đang cập nhật';
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
    const query = this.sidebarQuery().trim().toLowerCase();
    if (!query) return [];
    return this.bookService.getBooks().filter(book =>
      book.title.toLowerCase().includes(query) ||
      book.author.toLowerCase().includes(query)
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
    return this.bookService.getBooks().filter((book) => book.category === categoryValue).length;
  }

  relatedBooks(currentBook: Book): Book[] {
    return this.bookService
      .getBooks()
      .filter((book) => book.category === currentBook.category && book.id !== currentBook.id)
      .slice(0, 4);
  }

  increaseQuantity(): void {
    this.quantity.update((value) => value + 1);
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
    this.message.set(`Đã thêm ${this.quantity()} sách vào giỏ hàng.`);
  }
}
