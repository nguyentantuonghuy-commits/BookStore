import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { books } from '../data/books';
import { Book } from '../interfaces/book';

@Injectable({
  providedIn: 'root'
})
export class BookService {
  private platformId = inject(PLATFORM_ID);
  private books: Book[] = [];
  allBooks = signal<Book[]>([]);
  selectedCategory = signal<string>('TẤT CẢ EBOOK');
  searchQuery = signal<string>('');

  private readonly categories = [
    { name: 'TẤT CẢ EBOOK', icon: '', value: 'all' },
    { name: 'KGVH Hồ Chí Minh', icon: '/image/danhmuc1.png', value: 'new' },
    { name: 'Kinh tế', icon: '/image/danhmuc2.png', value: 'featured' },
    { name: 'Văn hóa xã hội', icon: '/image/danhmuc3.png', value: 'upcoming' },
    { name: 'Lịch sử - Chính trị', icon: '/image/danhmuc4.png', value: 'combo' },
    { name: 'Sức khỏe & Cuộc sống', icon: '/image/danhmuc5.png', value: 'new' },
    { name: 'Giáo trình', icon: '/image/danhmuc6.png', value: 'featured' },
    { name: 'Thiếu nhi', icon: '/image/danhmuc7.png', value: 'upcoming' }
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedBooks = localStorage.getItem('books');
      if (savedBooks) {
        try {
          this.books = JSON.parse(savedBooks);
        } catch (e) {
          this.books = [...books] as Book[];
        }
      } else {
        this.books = [...books] as Book[];
        localStorage.setItem('books', JSON.stringify(this.books));
      }
    } else {
      this.books = [...books] as Book[];
    }
    this.allBooks.set(this.books);
  }

  private saveToLocalStorage() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('books', JSON.stringify(this.books));
    }
  }

  getCategories() {
    return this.categories;
  }

  getCategoryNames(): string[] {
    // Return all static category names (excluding 'TẤT CẢ EBOOK')
    const staticNames = this.categories
      .map(c => c.name)
      .filter(name => name !== 'TẤT CẢ EBOOK');
    
    // Also include any other unique categories present in the books
    const bookCategories = this.books
      .map(b => b.category)
      .filter(cat => cat && !['new', 'featured', 'upcoming', 'combo', 'all'].includes(cat));

    // Combine them and get unique ones
    return Array.from(new Set([...staticNames, ...bookCategories]));
  }

  getBooks(): Book[] {
    return this.books;
  }

  getBookById(id: string): Book | undefined {
    return this.books.find((book) => book.id === id);
  }

  onSearch(query: string): void {
    this.searchQuery.set(query.trim().toLowerCase());
  }

  create(ebook: Book): void {
    this.books.unshift(ebook);
    this.saveToLocalStorage();
    this.allBooks.set([...this.books]);
  }

  update(id: string, ebook: Book): void {
    const index = this.books.findIndex((e) => e.id === id);
    if (index !== -1) {
      this.books[index] = { ...ebook };
      this.saveToLocalStorage();
      this.allBooks.set([...this.books]);
    }
  }

  delete(id: string): void {
    this.books = this.books.filter((e) => e.id !== id);
    this.saveToLocalStorage();
    this.allBooks.set([...this.books]);
  }

  resetToDefault(): void {
    this.books = [...books] as Book[];
    this.saveToLocalStorage();
    this.allBooks.set([...this.books]);
  }
}
