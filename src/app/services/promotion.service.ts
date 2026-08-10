import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export type PromotionDiscountType = 'PERCENT' | 'FIXED';
export type PromotionScope = 'ALL' | 'CATEGORY' | 'PRODUCT';

export interface Promotion {
  id: string;
  code: string;
  name: string;
  description: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number;
  startAt: string;
  endAt: string;
  usageLimit: number;
  usedCount: number;
  perUserLimit: number;
  applicableScope: PromotionScope;
  applicableCategory: string;
  applicableProductIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromotionQuote {
  promotionId: string;
  code: string;
  name: string;
  description: string;
  discountType: PromotionDiscountType;
  discountValue: number;
  discountAmount: number;
  eligibleSubtotal: number;
  subtotal: number;
  subtotalAfterDiscount: number;
  maxDiscount: number;
  endAt: string;
}

interface PromotionApiResponse {
  success: boolean;
  promotion?: Promotion;
  promotions?: Promotion[];
  quote?: PromotionQuote;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly apiUrl = 'http://localhost:3000/api/promotions';
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  promotions = signal<Promotion[]>([]);
  publicPromotions = signal<Promotion[]>([]);
  appliedQuote = signal<PromotionQuote | null>(null);
  isValidating = signal(false);
  isLoadingAdmin = signal(false);

  discountAmount = computed(() => Number(this.appliedQuote()?.discountAmount || 0));

  private validationSequence = 0;

  private normalizeCode(code: unknown): string {
    return String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  }

  private getUserStorageKey(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    const user = this.authService.currentUser();
    if (!user) return null;
    const identity = String(user.id || user.email || '').trim().toLowerCase();
    return identity ? `sachweb_applied_promotion_${encodeURIComponent(identity)}` : null;
  }

  getStoredCode(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    const key = this.getUserStorageKey();
    return key ? this.normalizeCode(localStorage.getItem(key) || '') : '';
  }

  private saveStoredCode(code: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const key = this.getUserStorageKey();
    if (!key) return;
    const normalized = this.normalizeCode(code);
    if (normalized) localStorage.setItem(key, normalized);
    else localStorage.removeItem(key);
  }

  clearAppliedPromotion(): void {
    this.validationSequence += 1;
    this.appliedQuote.set(null);
    this.isValidating.set(false);
    this.saveStoredCode('');
  }

  rememberCodeForCart(code: string): void {
    this.validationSequence += 1;
    this.appliedQuote.set(null);
    this.isValidating.set(false);
    this.saveStoredCode(this.normalizeCode(code));
  }

  clearQuoteOnly(): void {
    this.validationSequence += 1;
    this.appliedQuote.set(null);
    this.isValidating.set(false);
  }

  private parseError(error: unknown, fallback: string): Error {
    if (error instanceof HttpErrorResponse) {
      return new Error(error.error?.message || error.message || fallback);
    }
    if (error instanceof Error) return error;
    return new Error(fallback);
  }

  private buildValidationPayload(code: string, subtotal: number, items: any[]) {
    const user = this.authService.currentUser();
    return {
      code: this.normalizeCode(code),
      subtotal: Math.max(0, Number(subtotal || 0)),
      accountId: user?.id || user?.email || '',
      accountEmail: user?.email || '',
      items: (items || []).map(item => ({
        productId: String(item.productId ?? item.bookId ?? item.id ?? ''),
        quantity: Number(item.quantity || 0),
        unitPrice: Number(item.unitPrice ?? (Number(item.quantity || 0) > 0
          ? Number(item.price || 0) / Number(item.quantity || 1)
          : 0)),
        price: Number(item.price || 0)
      }))
    };
  }

  validateCode(
    code: string,
    subtotal: number,
    items: any[],
    persistOnSuccess = true
  ): Observable<PromotionQuote> {
    const normalized = this.normalizeCode(code);
    if (!normalized) {
      return throwError(() => new Error('Vui lòng nhập mã giảm giá.'));
    }

    const requestSequence = ++this.validationSequence;
    this.isValidating.set(true);

    return this.http.post<PromotionApiResponse>(`${this.apiUrl}/validate`,
      this.buildValidationPayload(normalized, subtotal, items)
    ).pipe(
      map(response => {
        if (!response.success || !response.quote) {
          throw new Error(response.message || 'Mã giảm giá không hợp lệ.');
        }
        return response.quote;
      }),
      tap(quote => {
        if (requestSequence !== this.validationSequence) return;
        this.appliedQuote.set(quote);
        if (persistOnSuccess) this.saveStoredCode(quote.code);
        this.isValidating.set(false);
      }),
      catchError(error => {
        if (requestSequence === this.validationSequence) {
          this.appliedQuote.set(null);
          this.isValidating.set(false);
          if (persistOnSuccess) this.saveStoredCode('');
        }
        return throwError(() => this.parseError(error, 'Không thể kiểm tra mã giảm giá.'));
      })
    );
  }

  restoreAndValidate(subtotal: number, items: any[]): Observable<PromotionQuote | null> {
    const code = this.getStoredCode();
    if (!code) {
      this.clearQuoteOnly();
      return new Observable<PromotionQuote | null>(subscriber => {
        subscriber.next(null);
        subscriber.complete();
      });
    }

    return this.validateCode(code, subtotal, items, true).pipe(
      map(quote => quote as PromotionQuote | null)
    );
  }

  loadPublicPromotions(force = false): Observable<Promotion[]> {
    if (!force && this.publicPromotions().length > 0) {
      return new Observable<Promotion[]>(subscriber => {
        subscriber.next(this.publicPromotions());
        subscriber.complete();
      });
    }

    const params = new HttpParams().set('_t', Date.now().toString());
    return this.http.get<PromotionApiResponse>(`${this.apiUrl}/public`, { params }).pipe(
      map(response => response.promotions || []),
      tap(items => this.publicPromotions.set(items)),
      catchError(error => throwError(() => this.parseError(error, 'Không thể tải chương trình khuyến mãi.')))
    );
  }

  loadPromotions(force = false): Observable<Promotion[]> {
    if (!force && this.promotions().length > 0) {
      return new Observable<Promotion[]>(subscriber => {
        subscriber.next(this.promotions());
        subscriber.complete();
      });
    }

    this.isLoadingAdmin.set(true);
    const params = new HttpParams().set('_t', Date.now().toString());
    return this.http.get<PromotionApiResponse>(this.apiUrl, { params }).pipe(
      map(response => response.promotions || []),
      tap(items => {
        this.promotions.set(items);
        this.isLoadingAdmin.set(false);
      }),
      catchError(error => {
        this.isLoadingAdmin.set(false);
        return throwError(() => this.parseError(error, 'Không thể tải danh sách mã giảm giá.'));
      })
    );
  }

  createPromotion(payload: Partial<Promotion>): Observable<Promotion> {
    return this.http.post<PromotionApiResponse>(`${this.apiUrl}/admin`, payload).pipe(
      map(response => {
        if (!response.promotion) throw new Error(response.message || 'Không thể tạo mã giảm giá.');
        return response.promotion;
      }),
      tap(created => this.promotions.update(items => [created, ...items])),
      catchError(error => throwError(() => this.parseError(error, 'Không thể tạo mã giảm giá.')))
    );
  }

  updatePromotion(id: string, payload: Partial<Promotion>): Observable<Promotion> {
    return this.http.patch<PromotionApiResponse>(`${this.apiUrl}/${encodeURIComponent(id)}/admin`, payload).pipe(
      map(response => {
        if (!response.promotion) throw new Error(response.message || 'Không thể cập nhật mã giảm giá.');
        return response.promotion;
      }),
      tap(updated => this.promotions.update(items =>
        items.map(item => String(item.id) === String(updated.id) ? updated : item)
      )),
      catchError(error => throwError(() => this.parseError(error, 'Không thể cập nhật mã giảm giá.')))
    );
  }

  togglePromotion(id: string, isActive: boolean): Observable<Promotion> {
    return this.http.patch<PromotionApiResponse>(`${this.apiUrl}/${encodeURIComponent(id)}/toggle`, { isActive }).pipe(
      map(response => {
        if (!response.promotion) throw new Error(response.message || 'Không thể đổi trạng thái mã giảm giá.');
        return response.promotion;
      }),
      tap(updated => this.promotions.update(items =>
        items.map(item => String(item.id) === String(updated.id) ? updated : item)
      )),
      catchError(error => throwError(() => this.parseError(error, 'Không thể đổi trạng thái mã giảm giá.')))
    );
  }

  deletePromotion(id: string): Observable<void> {
    return this.http.delete<PromotionApiResponse>(`${this.apiUrl}/${encodeURIComponent(id)}/admin`).pipe(
      tap(response => {
        if (!response.success) throw new Error(response.message || 'Không thể xóa mã giảm giá.');
        this.promotions.update(items => items.filter(item => String(item.id) !== String(id)));
      }),
      map(() => void 0),
      catchError(error => throwError(() => this.parseError(error, 'Không thể xóa mã giảm giá.')))
    );
  }
}
