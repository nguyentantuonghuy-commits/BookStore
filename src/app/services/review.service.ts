import { Injectable, inject, signal } from '@angular/core';
import { StorageService } from './storage.service';

export interface Review {
  id: string;
  bookId: string;
  userId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string; // ISO string
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private storageService = inject(StorageService);
  private reviewsKey = 'reviews';

  reviews = signal<Review[]>([]);

  constructor() {
    this.loadReviews();
  }

  private loadReviews() {
    // Seed initial reviews if none exist
    const initialReviews: Review[] = [
      {
        id: 'rev_1',
        bookId: '67d0',
        userId: '2',
        customerName: 'Nguyễn Thành Nam',
        rating: 5,
        comment: 'Sách rất hay, nội dung biên soạn rất công phu và dễ tiếp cận.',
        createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 mins ago
      },
      {
        id: 'rev_2',
        bookId: '67d2',
        userId: '3',
        customerName: 'Trần Thị Mai',
        rating: 4,
        comment: 'Bố cục rõ ràng, hình ảnh minh họa đẹp mắt, rất đáng mua.',
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() // 1 hour ago
      },
      {
        id: 'rev_3',
        bookId: '67d4',
        userId: '4',
        customerName: 'Lê Hoàng Phong',
        rating: 5,
        comment: 'Một cuốn sách tuyệt vời, chất lượng in ấn tốt và giao hàng nhanh.',
        createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString() // 3 hours ago
      }
    ];

    const data = this.storageService.getOrCreate<Review[]>(this.reviewsKey, initialReviews);
    this.reviews.set(data);
  }

  getReviewsByBook(bookId: string): Review[] {
    return this.reviews().filter(r => r.bookId === bookId);
  }

  addReview(bookId: string, userId: string, customerName: string, rating: number, comment: string) {
    const newReview: Review = {
      id: 'rev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      bookId,
      userId,
      customerName,
      rating,
      comment,
      createdAt: new Date().toISOString()
    };

    this.reviews.update(list => {
      const updated = [newReview, ...list];
      this.storageService.set(this.reviewsKey, updated);
      return updated;
    });
  }

  deleteReview(reviewId: string) {
    this.reviews.update(list => {
      const updated = list.filter(r => r.id !== reviewId);
      this.storageService.set(this.reviewsKey, updated);
      return updated;
    });
  }
}
