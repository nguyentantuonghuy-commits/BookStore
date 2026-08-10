import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Book } from '../../interfaces/book';
import { BookService } from '../../services/book.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { StorageService } from '../../services/storage.service';

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.css'
})
export class WishlistComponent implements OnInit {
  public bookService = inject(BookService);
  public cartService = inject(CartService);
  public authService = inject(AuthService);
  private storageService = inject(StorageService);
  private router = inject(Router);

  wishlist = this.bookService.wishlist;

  // Quick View Modal Signals
  quickViewBook = signal<Book | null>(null);
  quickViewQuantity = signal<number>(1);
  
  // Magnifying Zoom Lens Signals
  isZoomed = signal<boolean>(false);
  lensX = signal<number>(0);
  lensY = signal<number>(0);
  lensBgPos = signal<string>('50% 50%');

  // Interactive Book Preview Signal
  activePreview = signal<'front' | 'read' | 'index'>('front');

  // Computed signal to resolve book details from wishlist IDs
  wishlistBooks = computed(() => {
    const ids = this.wishlist();
    const all = this.bookService.allBooks();
    return all.filter(book => ids.includes(book.id));
  });

  // Calculate the total value of all wishlist items
  totalValue = computed(() => {
    return this.wishlistBooks().reduce((sum, book) => sum + this.discountPrice(book.price, book.discount), 0);
  });

  // Get a category breakdown list for visual labels
  categoryBreakdown = computed(() => {
    const counts: { [key: string]: number } = {};
    this.wishlistBooks().forEach(book => {
      const catName = this.bookService.getCategoryName(book.category);
      counts[catName] = (counts[catName] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  });

  addAllToCart(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const books = this.wishlistBooks();
    if (books.length === 0) return;

    books.forEach(book => {
      this.cartService.addToCart(book, 1);
    });
    this.cartService.showToast(`Đã thêm tất cả ${books.length} sản phẩm vào giỏ hàng!`);
  }

  ngOnInit(): void {
    // Make sure user is logged in. If not, redirect to login page.
    if (!this.authService.isLoggedIn()) {
      this.cartService.showToast('Bạn cần đăng nhập để xem bộ sưu tập cá nhân!');
      this.router.navigate(['/login']);
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

  removeFromWishlist(bookId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const current = this.wishlist();
    const updated = current.filter(id => id !== bookId);
    this.wishlist.set(updated);
    this.storageService.set('wishlist', updated);
    this.cartService.showToast('Đã xóa khỏi danh sách yêu thích!');
  }

  clearAll(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (confirm('Bạn có chắc muốn xóa toàn bộ sản phẩm khỏi bộ sưu tập cá nhân?')) {
      this.wishlist.set([]);
      this.storageService.set('wishlist', []);
      this.cartService.showToast('Đã xóa toàn bộ danh sách yêu thích!');
    }
  }

  addToCart(book: Book, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cartService.addToCart(book, 1);
  }

  buyNow(book: Book, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.cartService.addToCart(book, 1);
    const cartItem = this.cartService.userCarts().find(item => item.productId === book.id);
    if (cartItem && !cartItem.active) {
      this.cartService.toggleActive(cartItem);
    }
    this.router.navigate(['/cart']);
  }

  // Quick View Modal helpers
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

    this.lensX.set(x - 75);
    this.lensY.set(y - 75);

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
}
