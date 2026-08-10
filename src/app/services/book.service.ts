import { Injectable, signal, PLATFORM_ID, inject, effect } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { books } from '../data/books';
import { Book } from '../interfaces/book';
import { AuthService } from './auth.service';
import { StorageService } from './storage.service';
import { HttpClient } from '@angular/common/http';

type BookWithCategoryIcon = Book & { categoryIcon?: string };

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private platformId = inject(PLATFORM_ID);
  private authService = inject(AuthService);
  private storageService = inject(StorageService);
  private http = inject(HttpClient);
  
  private books: Book[] = [];
  allBooks = signal<Book[]>([]);
  selectedCategory = signal<string>('TẤT CẢ EBOOK');
  searchQuery = signal<string>('');
  wishlist = signal<string[]>([]);

  private apiUrl = 'http://localhost:3000/books';

  // Version key to force localStorage refresh when data format changes
  private readonly DATA_VERSION = 'v2_nfc';

  /**
   * Các danh mục mặc định của hệ thống.
   * Danh mục do Admin tạo thêm sẽ được tự động lấy từ trường category
   * của sách và ghép vào danh sách này.
   */
  private readonly defaultCategories = [
    { name: 'TẤT CẢ EBOOK', icon: '', value: 'all' },
    { name: 'KGVH Hồ Chí Minh', icon: '/image/danhmuc1.png', value: 'kgvh' },
    { name: 'Kinh tế', icon: '/image/danhmuc2.png', value: 'kinh-te' },
    { name: 'Văn hóa xã hội', icon: '/image/danhmuc3.png', value: 'van-hoa-xa-hoi' },
    { name: 'Lịch sử - Chính trị', icon: '/image/danhmuc4.png', value: 'lich-su-chinh-tri' },
    { name: 'Sức khỏe & Cuộc sống', icon: '/image/danhmuc5.png', value: 'suc-khoe-cuoc-song' },
    { name: 'Giáo trình', icon: '/image/danhmuc6.png', value: 'giao-trinh' },
    { name: 'Thiếu nhi', icon: '/image/danhmuc7.png', value: 'thieu-nhi' }
  ];

  // Icon mặc định an toàn cho danh mục cũ chưa được Admin chọn biểu tượng.
  private readonly customCategoryFallbackIcon = '/image/danhmuc0.png';

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadBooks();

      // Reactively load the correct wishlist when currentUser changes
      effect(() => {
        const user = this.authService.currentUser();
        if (user) {
          const savedWishlist = this.storageService.get<string[]>('wishlist');
          this.wishlist.set(savedWishlist || []);
        } else {
          this.wishlist.set([]);
        }
      });

      // Reactively sync the wishlist to the JSON Server
      effect(() => {
        const user = this.authService.currentUser();
        const wishlistItems = this.wishlist();
        
        // Map to format suitable for json-server
        const formattedWishlist = wishlistItems.map(bookId => ({ id: bookId }));
        
        this.http.post('http://localhost:3000/api/sync-user-data', { wishlist: formattedWishlist }).subscribe({
          next: () => {
            console.log('JSON Server wishlist synced.');
          },
          error: (err) => {
            console.warn('JSON Server wishlist sync failed:', err);
          }
        });
      });
    } else {
      this.loadBooksFromLocalOrDefaults();
    }
  }

  loadBooks() {
    this.http.get<Book[]>(this.apiUrl).subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.books = this.normalizeAllBooks(data);
          this.allBooks.set(this.books);
        } else {
          this.loadBooksFromLocalOrDefaults();
          // Seed json-server if database is empty
          this.books.forEach(b => {
            this.http.post<Book>(this.apiUrl, b).subscribe();
          });
        }
      },
      error: (err) => {
        console.warn('Failed to load books from API, falling back to local data.', err);
        this.loadBooksFromLocalOrDefaults();
      }
    });
  }

  private loadBooksFromLocalOrDefaults() {
    if (isPlatformBrowser(this.platformId)) {
      const savedVersion = localStorage.getItem('books_version');
      const savedBooks = localStorage.getItem('books');

      if (savedBooks && savedVersion === this.DATA_VERSION) {
        try {
          this.books = JSON.parse(savedBooks);
          const hasOldCategories = this.books.some(b => ['new', 'featured', 'upcoming', 'combo'].includes(b.category));
          const missingNewFields = !this.books.some(b => b.sampleText !== undefined);
          const hasMalformedTitles = this.books.some(b => b.title && (b.title.startsWith(' ') || b.title.includes('\n')));
          if (hasOldCategories || missingNewFields || hasMalformedTitles) {
            this.books = this.normalizeAllBooks([...books] as Book[]);
            this.saveToLocalStorage();
          } else {
            this.books = this.normalizeAllBooks(this.books);
          }
        } catch (e) {
          this.books = this.normalizeAllBooks([...books] as Book[]);
          this.saveToLocalStorage();
        }
      } else {
        this.books = this.normalizeAllBooks([...books] as Book[]);
        this.saveToLocalStorage();
      }
    } else {
      this.books = this.normalizeAllBooks([...books] as Book[]);
    }
    this.allBooks.set(this.books);
  }

  private saveToLocalStorage() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('books', JSON.stringify(this.books));
      localStorage.setItem('books_version', this.DATA_VERSION);
    }
  }

  /** Normalize a single string field to NFC Unicode form */
  private normalizeStr(val: string | undefined): string {
    if (!val) return val || '';
    return val.normalize('NFC');
  }

  /** Normalize all text fields of a book to NFC */
  private normalizeBook(book: Book): Book {
    return {
      ...book,
      title: this.normalizeStr(book.title),
      author: this.normalizeStr(book.author),
      description: this.normalizeStr(book.description),
      category: this.normalizeStr(book.category),
      translator: this.normalizeStr(book.translator),
      sampleText: this.normalizeStr(book.sampleText),
      tableOfContents: this.normalizeStr(book.tableOfContents),
    };
  }

  /** Normalize all books in an array */
  private normalizeAllBooks(booksArr: Book[]): Book[] {
    return booksArr.map(b => this.normalizeBook(b));
  }

  /** Chuẩn hóa khóa so sánh danh mục để tránh trùng do viết hoa/thường hoặc khoảng trắng. */
  private normalizeCategoryKey(value: string | undefined | null): string {
    return String(value || '')
      .normalize('NFC')
      .trim()
      .replace(/\s+/g, ' ')
      .toLocaleLowerCase('vi');
  }

  /**
   * Tạo danh sách danh mục động từ dữ liệu sách mới nhất.
   * Mỗi danh mục tự tạo lấy icon từ trường categoryIcon của sách.
   * Nếu dữ liệu cũ chưa có categoryIcon thì dùng icon sách mặc định đẹp và ổn định.
   */
  getCategories(): { name: string; icon: string; value: string }[] {
    const currentBooks = this.allBooks();
    const sourceBooks = currentBooks.length > 0 ? currentBooks : this.books;
    const result = this.defaultCategories.map(category => ({ ...category }));

    const knownKeys = new Set<string>();
    result.forEach(category => {
      knownKeys.add(this.normalizeCategoryKey(category.name));
      knownKeys.add(this.normalizeCategoryKey(category.value));
    });

    const customCategories = new Map<string, { name: string; icon: string; value: string }>();

    sourceBooks.forEach(book => {
      const rawCategory = String(book.category || '')
        .normalize('NFC')
        .trim()
        .replace(/\s+/g, ' ');
      const categoryKey = this.normalizeCategoryKey(rawCategory);

      if (!rawCategory || !categoryKey || knownKeys.has(categoryKey)) {
        return;
      }

      const bookWithIcon = book as BookWithCategoryIcon;
      const savedIcon = String(bookWithIcon.categoryIcon || '').trim();
      const existing = customCategories.get(categoryKey);

      if (!existing) {
        customCategories.set(categoryKey, {
          name: rawCategory,
          value: rawCategory,
          icon: savedIcon || this.customCategoryFallbackIcon
        });
        return;
      }

      // Ưu tiên icon thật do Admin đã chọn thay cho icon dự phòng của dữ liệu cũ.
      if (savedIcon && existing.icon === this.customCategoryFallbackIcon) {
        existing.icon = savedIcon;
      }
    });

    result.push(...customCategories.values());
    return result;
  }

  /** Trả về tên hiển thị; danh mục tự tạo sẽ hiển thị chính tên Admin đã nhập. */
  getCategoryName(value: string): string {
    const normalizedValue = this.normalizeCategoryKey(value);
    const category = this.getCategories().find(item =>
      this.normalizeCategoryKey(item.value) === normalizedValue ||
      this.normalizeCategoryKey(item.name) === normalizedValue
    );

    return category?.name || String(value || '').trim() || 'Chưa phân loại';
  }

  /** Lấy icon của danh mục để dùng cho form Admin và trang Home. */
  getCategoryIcon(value: string): string {
    const normalizedValue = this.normalizeCategoryKey(value);
    const category = this.getCategories().find(item =>
      this.normalizeCategoryKey(item.value) === normalizedValue ||
      this.normalizeCategoryKey(item.name) === normalizedValue
    );

    return category?.icon || this.customCategoryFallbackIcon;
  }

  /** Kiểm tra danh mục có phải là danh mục mặc định của hệ thống hay không. */
  isDefaultCategory(value: string): boolean {
    const normalizedValue = this.normalizeCategoryKey(value);
    return this.defaultCategories.some(item =>
      item.value !== 'all' && (
        this.normalizeCategoryKey(item.value) === normalizedValue ||
        this.normalizeCategoryKey(item.name) === normalizedValue
      )
    );
  }

  /** Kiểm tra một sách có thuộc danh mục được chọn hay không. */
  matchesCategory(bookCategory: string, categoryIdentifier: string): boolean {
    const selectedKey = this.normalizeCategoryKey(categoryIdentifier);
    if (!selectedKey || selectedKey === 'all' || selectedKey === this.normalizeCategoryKey('TẤT CẢ EBOOK')) {
      return true;
    }

    const category = this.getCategories().find(item =>
      this.normalizeCategoryKey(item.value) === selectedKey ||
      this.normalizeCategoryKey(item.name) === selectedKey
    );

    const bookKey = this.normalizeCategoryKey(bookCategory);
    if (!category) {
      return bookKey === selectedKey;
    }

    return bookKey === this.normalizeCategoryKey(category.value) ||
      bookKey === this.normalizeCategoryKey(category.name);
  }

  getCategoryNames(): string[] {
    return this.getCategories()
      .filter(category => category.value !== 'all')
      .map(category => category.name);
  }

  getAdminCategories(): { name: string; value: string; icon: string }[] {
    return this.getCategories()
      .filter(category => category.value !== 'all')
      .map(category => ({
        name: category.name,
        value: category.value,
        icon: category.icon
      }));
  }

  /**
   * Đồng bộ icon mới cho toàn bộ sách đang thuộc cùng một danh mục tự tạo.
   * Chỉ PATCH trường categoryIcon nên không đụng đến giá, tồn kho, giảm giá hay nội dung sách.
   */
  updateCategoryIconForCategory(categoryIdentifier: string, icon: string, excludedBookId = ''): void {
    const safeIcon = String(icon || '').trim();
    if (!safeIcon || this.isDefaultCategory(categoryIdentifier)) {
      return;
    }

    const matchingBooks = this.books.filter(book =>
      book.id !== excludedBookId && this.matchesCategory(book.category, categoryIdentifier)
    );

    if (matchingBooks.length === 0) {
      return;
    }

    const matchingIds = new Set(matchingBooks.map(book => book.id));
    this.books = this.books.map(book => {
      if (!matchingIds.has(book.id)) return book;
      return { ...book, categoryIcon: safeIcon } as BookWithCategoryIcon;
    });

    this.saveToLocalStorage();
    this.allBooks.set([...this.books]);

    matchingBooks.forEach(book => {
      this.http.patch<Book>(`${this.apiUrl}/${book.id}`, { categoryIcon: safeIcon }).subscribe({
        error: (error) => {
          console.error(`Không thể đồng bộ icon danh mục cho sách ${book.id}:`, error);
        }
      });
    });
  }

  getBooks(): Book[] {
    return this.allBooks();
  }

  getBookById(id: string): Book | undefined {
    return this.allBooks().find((book) => book.id === id);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query.trim().toLowerCase());
  }

  create(ebook: Book): void {
    const normalized = this.normalizeBook(ebook);
    this.http.post<Book>(this.apiUrl, normalized).subscribe({
      next: (newBook) => {
        this.books.unshift(newBook);
        this.saveToLocalStorage();
        this.allBooks.set([...this.books]);
      },
      error: (err) => {
        console.error('Failed to create book on server:', err);
      }
    });
  }

  update(id: string, ebook: Book): void {
    const normalized = this.normalizeBook(ebook);
    this.http.put<Book>(`${this.apiUrl}/${id}`, normalized).subscribe({
      next: (updatedBook) => {
        const index = this.books.findIndex((e) => e.id === id);
        if (index !== -1) {
          this.books[index] = updatedBook;
          this.saveToLocalStorage();
          this.allBooks.set([...this.books]);
        }
      },
      error: (err) => {
        console.error('Failed to update book on server:', err);
      }
    });
  }

  delete(id: string): void {
    this.http.delete<void>(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.books = this.books.filter((e) => e.id !== id);
        this.saveToLocalStorage();
        this.allBooks.set([...this.books]);
      },
      error: (err) => {
        console.error('Failed to delete book from server:', err);
      }
    });
  }

  resetToDefault(): void {
    // Clear and re-seed
    this.http.get<Book[]>(this.apiUrl).subscribe({
      next: (serverBooks) => {
        // Delete all first
        const deletePromises = serverBooks.map(b => this.http.delete<void>(`${this.apiUrl}/${b.id}`).toPromise());
        Promise.all(deletePromises).then(() => {
          const defaults = this.normalizeAllBooks([...books] as Book[]);
          defaults.forEach(b => {
            this.http.post<Book>(this.apiUrl, b).subscribe();
          });
          this.books = defaults;
          this.saveToLocalStorage();
          this.allBooks.set([...this.books]);
        });
      },
      error: () => {
        this.books = this.normalizeAllBooks([...books] as Book[]);
        this.saveToLocalStorage();
        this.allBooks.set([...this.books]);
      }
    });
  }
}
