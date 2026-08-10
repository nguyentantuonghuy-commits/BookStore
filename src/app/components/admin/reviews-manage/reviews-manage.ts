import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReviewService, Review } from '../../../services/review.service';
import { BookService } from '../../../services/book.service';
import { AuthService } from '../../../services/auth.service';
import { CartService } from '../../../services/cart.service';
import { CheckoutService } from '../../../services/checkout.service';
import { removeAccents } from '../../../utils/string-utils';

@Component({
  selector: 'app-reviews-manage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reviews-manage.html',
  styleUrl: './reviews-manage.css'
})export class ReviewsManageComponent implements OnInit {
  reviewService = inject(ReviewService);
  bookService = inject(BookService);
  authService = inject(AuthService);
  cartService = inject(CartService);
  checkoutService = inject(CheckoutService);
  Math = Math;

  reviews = computed(() => this.reviewService.reviews());

  // Permissions
  canViewReviews = computed(() => this.authService.hasPermission('REVIEWS_VIEW'));
  canDeleteReviews = computed(() => this.authService.hasPermission('REVIEWS_DELETE'));

  // Search & Filter
  searchTerm = signal<string>('');
  selectedRating = signal<number | string>('All');
  currentPage = signal<number>(1);
  pageSize = signal<number>(8);

  filteredReviews = computed(() => {
    let list = this.reviews();

    // Filter by rating
    const rating = this.selectedRating();
    if (rating !== 'All') {
      const numRating = Number(rating);
      list = list.filter(r => r.rating === numRating);
    }

    // Filter by search query
    const query = removeAccents(this.searchTerm().trim().toLowerCase());
    if (!query) return list;

    return list.filter(r => {
      const bookTitle = removeAccents(this.getBookTitle(r.bookId).toLowerCase());
      const customer = removeAccents(r.customerName.toLowerCase());
      const comment = removeAccents(r.comment.toLowerCase());
      return bookTitle.includes(query) || customer.includes(query) || comment.includes(query);
    });
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredReviews().length / this.pageSize())));

  pagedReviews = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredReviews().slice(start, start + this.pageSize());
  });

  // Stats
  totalCount = computed(() => this.reviews().length);
  fiveStarCount = computed(() => this.reviews().filter(r => r.rating === 5).length);
  fourStarCount = computed(() => this.reviews().filter(r => r.rating === 4).length);
  belowThreeCount = computed(() => this.reviews().filter(r => r.rating <= 3).length);

  ngOnInit() { }

  getBookTitle(bookId: string): string {
    const book = this.bookService.getBookById(bookId);
    return book ? book.title : 'Sách không tồn tại (ID: ' + bookId + ')';
  }

  getBookImage(bookId: string): string {
    const book = this.bookService.getBookById(bookId);
    return book ? book.image : '/image/book-placeholder.png';
  }

  deleteReview(id: string) {
    if (!this.canDeleteReviews()) {
      alert('Bạn không có quyền xóa đánh giá. Vui lòng liên hệ quản trị viên để được cấp quyền REVIEWS_DELETE.');
      return;
    }

    if (confirm('Bạn có chắc chắn muốn xóa vĩnh viễn đánh giá này không? Thao tác này không thể hoàn tác!')) {
      this.reviewService.deleteReview(id);
      this.cartService.showToast('Xóa đánh giá thành công!');
      if (this.currentPage() > this.totalPages()) {
        this.currentPage.set(this.totalPages());
      }
    }
  }

  filterByRating(rating: number | string) {
    this.selectedRating.set(rating);
    this.currentPage.set(1);
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  getInitials(name: string): string {
    if (!name) return 'KH';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  isVerifiedPurchase(userId: string, bookId: string): boolean {
    return this.checkoutService.hasUserPurchasedBook(userId, bookId);
  }
}
