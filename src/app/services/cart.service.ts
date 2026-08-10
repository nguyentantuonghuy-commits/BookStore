import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, computed, signal, inject, effect } from '@angular/core';
import { AuthService } from './auth.service';
import { BookService } from './book.service';
import { Router } from '@angular/router';
import { StorageService } from './storage.service';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private authService = inject(AuthService);
  private bookService = inject(BookService);
  private router = inject(Router);
  private storageService = inject(StorageService);
  private http = inject(HttpClient);

  carts = signal<any[]>([]);

  userCarts = computed(() => {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return [];
    const userId = currentUser.id || currentUser.email;
    return this.carts().filter((item) => item.userId === userId);
  });

  totalItems = computed(() => {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return 0;
    const userId = currentUser.id || currentUser.email;
    return this.carts()
      .filter((item) => item.userId === userId)
      .reduce((total, item) => total + item.quantity, 0);
  });

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    if (isPlatformBrowser(this.platformId)) {
      // Tải giỏ hàng khi người dùng đăng nhập
      effect(() => {
        const user = this.authService.currentUser();
        if (user) {
          this.loadCart();
        } else {
          this.carts.set([]);
        }
      });

      // Đồng bộ giỏ hàng với JSON Server
      effect(() => {
        const user = this.authService.currentUser();
        const cartItems = this.carts();
        const userId = user ? (user.id || user.email) : null;
        
        // Lọc giỏ hàng chỉ giữ lại sản phẩm của user hiện tại
        const userCartItems = userId ? cartItems.filter((item) => item.userId === userId) : [];
        
        // Đồng bộ giỏ hàng với JSON Server
        this.http.post('http://localhost:3000/api/sync-user-data', { cart: userCartItems }).subscribe({
          next: () => {
            console.log('JSON Server cart synced.');
          },
          error: (err) => {
            console.warn('JSON Server cart sync failed:', err);
          }
        });
      });
    }
  }

  discountPrice(price = 0, discount: string | undefined | null = '0%'): number {
    const safeDiscountStr = discount || '0%';
    const discountPercent = Number.parseFloat(safeDiscountStr.replace('%', ''));
    const safeDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;
    return Math.round(price * (1 - safeDiscount / 100));
  }

  loadCart() {
    if (isPlatformBrowser(this.platformId)) {
      const parsed = this.storageService.get<any[]>('cart');
      if (parsed && Array.isArray(parsed)) {
        const currentUser = this.authService.currentUser();
        const userId = currentUser ? (currentUser.id || currentUser.email) : null;
        const migrated = parsed.map((item: any, index: number) => {
          if (item.book) {
            // Chuyển đổi định dạng giỏ hàng cũ { book: Book, quantity: number } sang định dạng mới
            const basePrice = item.book.discount && item.book.discount !== '0%'
              ? this.discountPrice(item.book.price, item.book.discount)
              : item.book.price;

            return {
              id: item.id || 'c' + (index + 1),
              productId: item.book.id,
              title: item.book.title,
              unitPrice: basePrice,
              price: basePrice * item.quantity, // Set giá là tổng giá 
              quantity: item.quantity,
              image: item.book.image,
              discount: item.book.discount,
              active: true,
              userId: item.userId || userId
            };
          }
          // Nếu là định dạng mới nhưng thiếu unitPrice, tính toán nó
          if (item.unitPrice === undefined) {
            item.unitPrice = item.price / item.quantity;
          }
          // Đảm bảo price là tổng giá trong local storage
          item.price = item.unitPrice * item.quantity;

          if (item.active === undefined) {
            item.active = true;
          }

          if (userId && !item.userId) {
            item.userId = userId;
          }
          return item;
        });
        this.carts.set(migrated);
        this.storageService.set('cart', migrated);
        return;
      }
      this.carts.set([]);
    }
  }

  saveCart() {
    if (isPlatformBrowser(this.platformId)) {
      this.storageService.set('cart', this.carts());
    }
  }

  getCart() {
    return this.carts();
  }

  /** Trả về toàn bộ giỏ hàng của user hiện tại */
  getUserCart() {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return [];
    const userId = currentUser.id || currentUser.email;
    return this.carts().filter((item) => item.userId === userId);
  }

  addToCart(product: any, quantity: number) {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      alert('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng!');
      this.router.navigate(['/login']);
      return;
    }

    const userId = currentUser.id || currentUser.email;
    
    // Lấy thông tin tồn kho mới nhất từ BookService
    const book = this.bookService.getBookById(product.id);
    const availableStock = book ? book.stock : (product.stock !== undefined ? product.stock : 99);

    if (availableStock <= 0) {
      this.showToast(`Sách "${product.title}" đã hết hàng!`, product, 'remove');
      return;
    }

    const existingProduct = this.carts().find((item) => item.productId === product.id && item.userId === userId);
    const currentQty = existingProduct ? existingProduct.quantity : 0;
    const newQty = currentQty + quantity;

    let qtyToAdd = quantity;
    if (newQty > availableStock) {
      qtyToAdd = availableStock - currentQty;
      if (qtyToAdd <= 0) {
        this.showToast(`Sách "${product.title}" chỉ còn ${availableStock} cuốn trong kho và bạn đã thêm đủ số lượng này.`, product, 'add');
        return;
      }
      this.showToast(`Chỉ còn ${availableStock} cuốn. Đã thêm tối đa ${qtyToAdd} cuốn vào giỏ hàng.`, product, 'add');
    }

    const basePrice = product.discount && product.discount !== '0%'
      ? this.discountPrice(product.price, product.discount)
      : product.price;

    if (existingProduct) {
      this.carts.update((cartItems) =>
        cartItems.map((item) =>
          item.productId === product.id && item.userId === userId
            ? {
              ...item,
              quantity: item.quantity + qtyToAdd,
              price: item.unitPrice * (item.quantity + qtyToAdd) // Cập nhật giá thành tổng trong local storage!
            }
            : item
        )
      );
    } else {
      this.carts.update((cartItems) => [
        ...cartItems,
        {
          id: 'c' + (cartItems.length + 1),
          productId: product.id,
          title: product.title,
          unitPrice: basePrice, 
          price: basePrice * qtyToAdd, 
          quantity: qtyToAdd,
          image: product.image,
          discount: product.discount,
          active: false, // Nếu là false thì khi load lại giỏ hàng thì nó sẽ mất
          userId: userId
        },
      ]);
    }
    this.saveCart();
    if (isPlatformBrowser(this.platformId) && newQty <= availableStock) {
      this.showToast('Đã thêm thành công vào giỏ hàng', product);
    }
    console.log('save cart service', this.carts());
    if (isPlatformBrowser(this.platformId)) {
      console.log(this.storageService.get('cart'));
    }
  }

  updateQuantity(item: any, quantity: number): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;
    const userId = currentUser.id || currentUser.email;

    const book = this.bookService.getBookById(item.productId);
    const availableStock = book ? book.stock : 99;

    let targetQty = quantity;
    if (quantity > availableStock) {
      this.showToast(`Sách "${item.title}" chỉ còn ${availableStock} cuốn trong kho!`, item, 'remove');
      targetQty = availableStock;
    }

    this.carts.update((cartItems) =>
      cartItems.map((cartItem) =>
        cartItem.id === item.id && cartItem.userId === userId
          ? {
            ...cartItem,
            quantity: targetQty,
            price: cartItem.unitPrice * targetQty //Cập nhật giá thành tổng trong local storage
          }
          : cartItem
      )
    );
    this.saveCart();
    console.log('Update qty:', this.carts());
  }

  removeCart(item: any, showToastNotification = true): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;
    const userId = currentUser.id || currentUser.email;

    const product = {
      image: item.image,
      title: item.title
    };
    this.carts.set(this.carts().filter((cartItem) => !(cartItem.id === item.id && cartItem.userId === userId)));
    this.saveCart();
    if (showToastNotification && isPlatformBrowser(this.platformId)) {
      this.showToast('Đã xóa khỏi giỏ hàng', product, 'remove');
    }
  }

  toggleActive(item: any): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;
    const userId = currentUser.id || currentUser.email;

    this.carts.update((cartItems) =>
      cartItems.map((cartItem) =>
        cartItem.id === item.id && cartItem.userId === userId ? { ...cartItem, active: !cartItem.active } : cartItem
      )
    );
    this.saveCart();
  }

  toggleActiveAll(active: boolean) {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;
    const userId = currentUser.id || currentUser.email;

    this.carts.update((cartItems) => cartItems.map((item) => item.userId === userId ? ({ ...item, active }) : item));
    this.saveCart();
  }

  clearCart() {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;
    const userId = currentUser.id || currentUser.email;

    this.carts.set(this.carts().filter((item) => item.userId !== userId));
    this.saveCart();
  }

  showToast(message: string, product?: any, type: 'add' | 'remove' = 'add') {
    if (!isPlatformBrowser(this.platformId)) return;

    // Check or create container
    let container = document.getElementById('custom-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'custom-toast-container';
      container.style.position = 'fixed';
      container.style.bottom = '40px'; /* Bottom right placement */
      container.style.right = '40px';
      container.style.zIndex = '99999';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.gap = '12px';
      container.style.pointerEvents = 'none';
      document.body.appendChild(container);
    }

    // Màu sắc của toast
    const isRemove = type === 'remove';
    const borderLeftColor = isRemove ? '#f87171' : 'var(--accent-color, #c5a880)';
    const statusColor = isRemove ? '#f87171' : 'var(--accent-color, #c5a880)';
    const statusIcon = isRemove
      ? '<i class="bi bi-trash3-fill me-1" style="color: #ef4444;"></i> '
      : '<i class="bi bi-check-circle-fill me-1" style="color: #22c55e;"></i> ';
    const progressBg = isRemove
      ? 'linear-gradient(to right, #fee2e2, #f87171)'
      : 'linear-gradient(to right, #dfd0bb, var(--accent-color, #c5a880))';

    // Tạo toast box
    const toast = document.createElement('div');
    toast.className = 'custom-toast animate-toast-in';
    toast.style.background = 'rgba(255, 255, 255, 0.96)';
    toast.style.backdropFilter = 'blur(12px)';
    toast.style.color = '#1a2536';
    toast.style.border = '1px solid rgba(197, 168, 128, 0.25)';
    toast.style.borderLeft = `4px solid ${borderLeftColor}`;
    toast.style.padding = '16px';
    toast.style.borderRadius = '16px';
    toast.style.boxShadow = '0 20px 40px rgba(18, 18, 18, 0.08)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '14px';
    toast.style.fontFamily = 'var(--font-sans)';
    toast.style.minWidth = '360px';
    toast.style.maxWidth = '450px';
    toast.style.pointerEvents = 'auto';
    toast.style.position = 'relative';
    toast.style.overflow = 'hidden';
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    if (product) {
      // Tạo thumbnail image element
      const img = document.createElement('img');
      img.src = product.image;
      img.alt = product.title;
      img.style.width = '48px';
      img.style.height = '64px';
      img.style.objectFit = 'contain';
      img.style.borderRadius = '6px';
      img.style.boxShadow = '0 4px 10px rgba(0,0,0,0.08)';
      img.style.backgroundColor = '#f8fafc';
      img.style.padding = '4px';
      toast.appendChild(img);

      const infoWrapper = document.createElement('div');
      infoWrapper.style.display = 'flex';
      infoWrapper.style.flexDirection = 'column';
      infoWrapper.style.flexGrow = '1';
      infoWrapper.style.gap = '2px';

      const statusText = document.createElement('span');
      statusText.innerHTML = statusIcon + message;
      statusText.style.fontSize = '12px';
      statusText.style.color = statusColor;
      statusText.style.fontWeight = '700';
      statusText.style.letterSpacing = '0.3px';

      const titleText = document.createElement('span');
      titleText.textContent = product.title;
      titleText.style.fontSize = '14px';
      titleText.style.fontWeight = '700';
      titleText.style.color = '#1a2536';
      titleText.style.display = '-webkit-box';
      titleText.style.webkitLineClamp = '1';
      titleText.style.webkitBoxOrient = 'vertical';
      titleText.style.overflow = 'hidden';

      infoWrapper.appendChild(statusText);
      infoWrapper.appendChild(titleText);
      toast.appendChild(infoWrapper);
    } else {
      const iconWrapper = document.createElement('div');
      iconWrapper.style.width = '32px';
      iconWrapper.style.height = '32px';
      iconWrapper.style.borderRadius = '50%';
      iconWrapper.style.backgroundColor = isRemove ? 'rgba(239, 68, 68, 0.08)' : 'rgba(197, 168, 128, 0.08)';
      iconWrapper.style.display = 'flex';
      iconWrapper.style.alignItems = 'center';
      iconWrapper.style.justifyContent = 'center';
      iconWrapper.style.flexShrink = '0';

      const icon = document.createElement('i');
      icon.className = isRemove ? 'bi bi-trash3-fill' : 'bi bi-info-circle-fill';
      icon.style.color = borderLeftColor;
      icon.style.fontSize = '16px';
      iconWrapper.appendChild(icon);
      toast.appendChild(iconWrapper);

      const textNode = document.createElement('div');
      textNode.style.flexGrow = '1';
      const text = document.createElement('span');
      text.textContent = message;
      text.style.color = '#1a2536';
      text.style.fontSize = '14.5px';
      text.style.fontWeight = '700';
      textNode.appendChild(text);
      toast.appendChild(textNode);
    }

    // Nút đóng
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.background = 'none';
    closeBtn.style.border = 'none';
    closeBtn.style.fontSize = '22px';
    closeBtn.style.color = '#a0aec0';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.padding = '0 0 4px';
    closeBtn.style.lineHeight = '1';
    closeBtn.style.transition = 'color 0.2s';
    closeBtn.onmouseenter = () => closeBtn.style.color = '#1a2536';
    closeBtn.onmouseleave = () => closeBtn.style.color = '#a0aec0';
    closeBtn.onclick = () => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(60px) scale(0.9)'; /* Exit to the right */
      setTimeout(() => toast.remove(), 300);
    };
    toast.appendChild(closeBtn);

    // Thanh tiến trình
    const progressBar = document.createElement('div');
    progressBar.style.position = 'absolute';
    progressBar.style.bottom = '0';
    progressBar.style.left = '0';
    progressBar.style.height = '3px';
    progressBar.style.background = progressBg;
    progressBar.style.width = '100%';
    progressBar.style.animation = 'toastProgress 4000ms linear forwards';
    toast.appendChild(progressBar);

    // Thêm keyframe thanh tiến trình vào tài liệu nếu chưa có
    if (!document.getElementById('toast-progress-style')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'toast-progress-style';
      styleSheet.innerText = `
        @keyframes toastProgress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `;
      document.head.appendChild(styleSheet);
    }

    container.appendChild(toast);

    // Tự động đóng
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(60px) scale(0.9)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  }
}
