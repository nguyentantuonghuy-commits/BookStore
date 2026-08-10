import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { Book } from '../../interfaces/book';
import { BookService } from '../../services/book.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';
import { removeAccents } from '../../utils/string-utils';

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './products.html',
  styleUrl: './products.css'
})
export class ProductsComponent implements OnInit {
  public bookService = inject(BookService);
  public cartService = inject(CartService);
  public authService = inject(AuthService);
  private storageService = inject(StorageService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Search & Filter signals
  localSearchQuery = signal<string>('');
  showSidebarDropdown = signal<boolean>(false);
  activeSuggestionIndex = signal<number>(-1);
  selectedCategory = signal<string>('all');
  selectedPriceRange = signal<string>('all');
  selectedSort = signal<string>('name-asc');
  viewMode = signal<'grid' | 'list'>('grid');

  // Wishlist feature (shared with BookService)
  wishlist = this.bookService.wishlist;
  filterByWishlist = signal<boolean>(false);

  // Pagination
  currentPage = signal<number>(1);
  pageSize = signal<number>(8);

  // Quick View Modal
  quickViewBook = signal<Book | null>(null);
  quickViewQuantity = signal<number>(1);

  // Magnifying Zoom Lens Signals
  isZoomed = signal<boolean>(false);
  lensX = signal<number>(0);
  lensY = signal<number>(0);
  lensBgPos = signal<string>('50% 50%');

  // Interactive Book Preview Signal
  activePreview = signal<'front' | 'read' | 'index'>('front');

  // Mobile filter sidebar toggle
  showMobileFilters = signal<boolean>(false);

  // Animation state
  isLoaded = signal<boolean>(false);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const globalQuery = this.bookService.searchQuery();
      if (globalQuery) {
        this.localSearchQuery.set(globalQuery);
      }

      // Load wishlist from storage to sync shared BookService signal
      const savedWishlist = this.storageService.get<string[]>('wishlist') || [];
      this.wishlist.set(savedWishlist);

      // Subscribe to route query params to enable wishlist filter reactively
      this.route.queryParamMap.subscribe(params => {
        const wishlistOnly = params.get('wishlist') === 'true';
        this.filterByWishlist.set(wishlistOnly);
        this.currentPage.set(1);
      });

      // Trigger entrance animations
      setTimeout(() => this.isLoaded.set(true), 100);
    }
  }

  categories = this.bookService.getCategories();

  discountPrice(price = 0, discount: string | undefined | null = '0%'): number {
    const safeDiscountStr = discount || '0%';
    const discountPercent = Number.parseFloat(safeDiscountStr.replace('%', ''));
    const safeDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;
    return Math.round(price * (1 - safeDiscount / 100));
  }

  getDiscountPercent(discount: string | undefined | null): number {
    const safeDiscountStr = discount || '0%';
    return Number.parseFloat(safeDiscountStr.replace('%', '')) || 0;
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN');
  }

  // Computed filtered books
  filteredBooks = computed(() => {
    let list = this.bookService.allBooks();

    // Search filter
    const query = removeAccents(this.localSearchQuery().trim().toLowerCase());
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

    // Category filter
    const cat = this.selectedCategory();
    if (cat !== 'all') {
      list = list.filter((book) => {
        const catObj = this.categories.find(item => item.value === cat);
        const matchValue = catObj ? catObj.value : cat;
        const matchName = catObj ? catObj.name : cat;
        return book.category === matchValue || book.category === matchName;
      });
    }

    // Price range filter
    const priceRange = this.selectedPriceRange();
    if (priceRange !== 'all') {
      list = list.filter((book) => {
        const actualPrice = this.discountPrice(book.price, book.discount);
        if (priceRange === 'under-50') return actualPrice < 50000;
        if (priceRange === '50-100') return actualPrice >= 50000 && actualPrice <= 100000;
        if (priceRange === 'above-100') return actualPrice > 100000;
        return true;
      });
    }

    // Wishlist filter
    if (this.filterByWishlist()) {
      const likedIds = this.wishlist();
      list = list.filter((book) => likedIds.includes(book.id));
    }

    // Sorting
    const sort = this.selectedSort();
    const sorted = [...list];
    if (sort === 'name-asc') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' }));
    } else if (sort === 'name-desc') {
      sorted.sort((a, b) => b.title.localeCompare(a.title, 'vi', { sensitivity: 'base' }));
    } else if (sort === 'price-asc') {
      sorted.sort((a, b) => this.discountPrice(a.price, a.discount) - this.discountPrice(b.price, b.discount));
    } else if (sort === 'price-desc') {
      sorted.sort((a, b) => this.discountPrice(b.price, b.discount) - this.discountPrice(a.price, a.discount));
    } else if (sort === 'discount-desc') {
      sorted.sort((a, b) => {
        const discA = Number.parseFloat((a.discount || '0%').replace('%', '')) || 0;
        const discB = Number.parseFloat((b.discount || '0%').replace('%', '')) || 0;
        return discB - discA;
      });
    }

    return sorted;
  });

  // Pagination computed
  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredBooks().length / this.pageSize())));
  activePage = computed(() => Math.min(this.currentPage(), this.totalPages()));

  pagedBooks = computed(() => {
    const start = (this.activePage() - 1) * this.pageSize();
    return this.filteredBooks().slice(start, start + this.pageSize());
  });

  totalItems = computed(() => this.filteredBooks().length);
  startIndex = computed(() => this.filteredBooks().length === 0 ? 0 : (this.activePage() - 1) * this.pageSize() + 1);
  endIndex = computed(() => Math.min(this.activePage() * this.pageSize(), this.filteredBooks().length));

  // Check if any filter is active
  hasActiveFilters = computed(() =>
    this.localSearchQuery() !== '' ||
    this.selectedCategory() !== 'all' ||
    this.selectedPriceRange() !== 'all' ||
    this.filterByWishlist()
  );

  // Category count
  getCategoryCount(categoryValue: string): number {
    const list = this.bookService.allBooks();
    if (categoryValue === 'all') return list.length;
    return list.filter(book => {
      const catObj = this.categories.find(item => item.value === categoryValue);
      const val = catObj ? catObj.value : categoryValue;
      const name = catObj ? catObj.name : categoryValue;
      return book.category === val || book.category === name;
    }).length;
  }

  // Filter methods
  setCategory(value: string): void {
    this.selectedCategory.set(value);
    this.currentPage.set(1);
  }

  setPriceRange(range: string): void {
    this.selectedPriceRange.set(range);
    this.currentPage.set(1);
  }

  setSort(sortType: string): void {
    this.selectedSort.set(sortType);
    this.currentPage.set(1);
  }

  resetFilters(): void {
    this.localSearchQuery.set('');
    this.selectedCategory.set('all');
    this.selectedPriceRange.set('all');
    this.selectedSort.set('name-asc');
    this.filterByWishlist.set(false);
    this.currentPage.set(1);
    this.router.navigate([], {
      queryParams: { wishlist: null },
      queryParamsHandling: 'merge'
    });
  }

  toggleWishlist(bookId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const current = this.wishlist();
    let updated: string[];
    if (current.includes(bookId)) {
      updated = current.filter(id => id !== bookId);
      this.cartService.showToast('Đã xóa khỏi danh sách yêu thích!');
    } else {
      updated = [...current, bookId];
      this.cartService.showToast('Đã thêm vào danh sách yêu thích!');
    }
    this.wishlist.set(updated);
    this.storageService.set('wishlist', updated);
  }

  toggleWishlistFilter(): void {
    const newVal = !this.filterByWishlist();
    this.filterByWishlist.set(newVal);
    this.currentPage.set(1);
    this.router.navigate([], {
      queryParams: { wishlist: newVal ? 'true' : null },
      queryParamsHandling: 'merge'
    });
  }

  disableWishlistFilter(): void {
    this.filterByWishlist.set(false);
    this.currentPage.set(1);
    this.router.navigate([], {
      queryParams: { wishlist: null },
      queryParamsHandling: 'merge'
    });
  }

  // Pagination helpers
  getPagination(): (number | string)[] {
    const pages: (number | string)[] = [];
    const total = this.totalPages();
    const current = this.activePage();

    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current > 3) pages.push(1, '...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('...', total);
    }

    return pages;
  }

  setCurrentPage(page: number | string): void {
    if (typeof page === 'number' && page > 0 && page <= this.totalPages()) {
      this.currentPage.set(page);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }

  // Cart methods
  addToCart(book: Book, event?: Event): void {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    this.cartService.addToCart(book, 1);
  }

  buyNow(book: Book, event?: Event): void {
    if (event) { event.preventDefault(); event.stopPropagation(); }
    const user = this.authService.currentUser();
    if (!user) {
      this.cartService.showToast('Bạn cần đăng nhập trước khi mua hàng!');
      this.router.navigate(['/login']);
      return;
    }
    this.cartService.addToCart(book, 1);
    const cartItem = this.cartService.userCarts().find(item => item.productId === book.id);
    if (cartItem && !cartItem.active) {
      this.cartService.toggleActive(cartItem);
    }
    this.router.navigate(['/cart']);
  }

  // Quick View Modal
  openQuickView(book: Book, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.quickViewBook.set(book);
    this.quickViewQuantity.set(book.stock > 0 ? 1 : 0);
    this.activePreview.set('front');
  }

  closeQuickView(): void {
    this.quickViewBook.set(null);
    this.isZoomed.set(false);
  }

  onZoom(event: MouseEvent): void {
    const container = event.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Center the 150px lens on the cursor position
    this.lensX.set(x - 75);
    this.lensY.set(y - 75);

    // Compute relative percentage within the container for background alignment
    const px = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const py = Math.max(0, Math.min(100, (y / rect.height) * 100));
    this.lensBgPos.set(`${px}% ${py}%`);
    this.isZoomed.set(true);
  }

  onZoomReset(): void {
    this.isZoomed.set(false);
  }

  getSampleParagraphs(sampleText: string | undefined): string[] {
    if (!sampleText) {
      return [
        'Bản đọc thử của cuốn sách này hiện đang được chuẩn bị. Vui lòng quay lại sau.',
        'Cảm ơn bạn đã quan tâm đến tác phẩm của Nhà xuất bản.'
      ];
    }
    return sampleText
      .normalize('NFC')
      .split('\n')
      .map(p => p.trim())
      .filter(p => p !== '');
  }

  parseTOC(tocText: string | undefined): { ch: string, title: string, page: string }[] {
    if (!tocText) {
      return [
        { ch: 'Mục lục:', title: 'Nội dung chi tiết đang được cập nhật', page: '' }
      ];
    }
    return tocText
      .normalize('NFC')
      .split('\n')
      .map(line => {
        const parts = line.split('|');
        const titlePart = parts[0] || '';
        const pagePart = parts[1] || '';

        const colonIdx = titlePart.indexOf(':');
        let ch = '';
        let title = titlePart.trim();
        if (colonIdx > 0) {
          ch = titlePart.substring(0, colonIdx + 1).trim();
          title = titlePart.substring(colonIdx + 1).trim();
        }
        return {
          ch: ch,
          title: title,
          page: pagePart.trim() ? `Tr. ${pagePart.trim()}` : ''
        };
      })
      .filter(item => item.title !== '');
  }

  increaseModalQty(): void {
    const book = this.quickViewBook();
    if (book && this.quickViewQuantity() < book.stock) {
      this.quickViewQuantity.update(v => v + 1);
    }
  }

  decreaseModalQty(): void {
    if (this.quickViewQuantity() > 1) {
      this.quickViewQuantity.update(v => v - 1);
    }
  }

  addModalToCart(): void {
    const book = this.quickViewBook();
    if (book) {
      this.cartService.addToCart(book, this.quickViewQuantity());
      this.closeQuickView();
    }
  }

  buyModalNow(): void {
    const book = this.quickViewBook();
    if (book) {
      const user = this.authService.currentUser();
      if (!user) {
        this.cartService.showToast('Bạn cần đăng nhập trước khi mua hàng!');
        this.router.navigate(['/login']);
        return;
      }
      this.cartService.addToCart(book, this.quickViewQuantity());
      const cartItem = this.cartService.userCarts().find(item => item.productId === book.id);
      if (cartItem && !cartItem.active) {
        this.cartService.toggleActive(cartItem);
      }
      this.closeQuickView();
      this.router.navigate(['/cart']);
    }
  }

  toggleMobileFilters(): void {
    this.showMobileFilters.update(v => !v);
  }

  onSidebarSearch(query: string): void {
    this.localSearchQuery.set(query);
    this.showSidebarDropdown.set(false);
  }

  onSidebarInput(query: string): void {
    this.localSearchQuery.set(query);
    this.showSidebarDropdown.set(true);
    this.activeSuggestionIndex.set(-1);
    this.currentPage.set(1);
  }

  getSidebarSuggestions(): Book[] {
    const query = removeAccents(this.localSearchQuery().trim().toLowerCase());
    const queryWords = query.split(/\s+/).filter(w => w.length > 0);
    if (queryWords.length === 0) return [];
    return this.bookService.allBooks().filter(book => {
      const titleNorm = removeAccents(book.title || '').toLowerCase();
      const authorNorm = removeAccents(book.author || '').toLowerCase();
      const fullText = `${titleNorm} ${authorNorm}`;
      return queryWords.every(w => fullText.includes(w));
    }).slice(0, 8);
  }

  selectSidebarSuggestion(book: Book): void {
    this.localSearchQuery.set(book.title);
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
        this.onSidebarSearch(this.localSearchQuery());
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

  trackByBookId(_: number, book: Book): string {
    return book.id;
  }
}
