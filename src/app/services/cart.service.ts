import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID, computed, signal, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class CartService {
  private authService = inject(AuthService);
  private router = inject(Router);

  carts = signal<any[]>([]);

  totalItems = computed(() =>
    this.carts().reduce((total, item) => total + item.quantity, 0)
  );

  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.loadCart();
  }

  discountPrice(price = 0, discount = '0%'): number {
    const discountPercent = Number.parseFloat(discount.replace('%', ''));
    const safeDiscount = Number.isFinite(discountPercent) ? discountPercent : 0;
    return Math.round(price * (1 - safeDiscount / 100));
  }

  loadCart() {
    if (isPlatformBrowser(this.platformId)) {
      const cartData = localStorage.getItem('cart');
      if (cartData) {
        try {
          const parsed = JSON.parse(cartData);
          if (Array.isArray(parsed)) {
            const migrated = parsed.map((item: any, index: number) => {
              if (item.book) {
                // Convert old cart format { book: Book, quantity: number } to new format
                const basePrice = item.book.discount && item.book.discount !== '0%'
                  ? this.discountPrice(item.book.price, item.book.discount)
                  : item.book.price;

                return {
                  id: item.id || 'c' + (index + 1),
                  productId: item.book.id,
                  title: item.book.title,
                  unitPrice: basePrice,
                  price: basePrice * item.quantity, // Set price as total price
                  quantity: item.quantity,
                  image: item.book.image,
                  discount: item.book.discount,
                  active: true
                };
              }
              // If it's the new format but lacks unitPrice, calculate it
              if (item.unitPrice === undefined) {
                item.unitPrice = item.price / item.quantity;
              }
              // Force price to always be total price in local storage
              item.price = item.unitPrice * item.quantity;

              if (item.active === undefined) {
                item.active = true;
              }
              return item;
            });
            this.carts.set(migrated);
            localStorage.setItem('cart', JSON.stringify(migrated));
            return;
          }
        } catch (e) {
          console.error('Failed to parse cart data', e);
        }
      }
      this.carts.set([]);
    }
  }

  saveCart() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cart', JSON.stringify(this.carts()));
    }
  }

  getCart() {
    return this.carts();
  }

  addToCart(product: any, quantity: number) {
    if (!this.authService.currentUser()) {
      this.showToast('Bạn cần đăng nhập trước khi thêm sản phẩm vào giỏ hàng!');
      this.router.navigate(['/login']);
      return;
    }

    const existingProduct = this.carts().find((item) => item.productId === product.id);
    const basePrice = product.discount && product.discount !== '0%'
      ? this.discountPrice(product.price, product.discount)
      : product.price;

    if (existingProduct) {
      this.carts.update((cartItems) =>
        cartItems.map((item) =>
          item.productId === product.id
            ? {
              ...item,
              quantity: item.quantity + quantity,
              price: item.unitPrice * (item.quantity + quantity) // Update price to total in local storage!
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
          unitPrice: basePrice, // Store unit price
          price: basePrice * quantity, // Store total price in 'price' field so it updates in Local Storage!
          quantity,
          image: product.image,
          discount: product.discount,
          active: false, // Default to false so user has to check it to buy
        },
      ]);
    }
    this.saveCart();
    if (isPlatformBrowser(this.platformId)) {
      this.showToast('Đã thêm sản phẩm thành công vào giỏ hàng');
    }
    console.log('save cart service', this.carts());
    if (isPlatformBrowser(this.platformId)) {
      console.log(JSON.parse(localStorage.getItem('cart')!));
    }
  }

  updateQuantity(item: any, quantity: number): void {
    this.carts.update((cartItems) =>
      cartItems.map((cartItem) =>
        cartItem.id === item.id
          ? {
            ...cartItem,
            quantity,
            price: cartItem.unitPrice * quantity // Update price to total in local storage!
          }
          : cartItem
      )
    );
    this.saveCart();
    console.log('Update qty:', this.carts());
  }

  removeCart(item: any): void {
    this.carts.set(this.carts().filter((cartItem) => cartItem.id !== item.id));
    this.saveCart();
  }

  toggleActive(item: any): void {
    this.carts.update((cartItems) =>
      cartItems.map((cartItem) =>
        cartItem.id === item.id ? { ...cartItem, active: !cartItem.active } : cartItem
      )
    );
    this.saveCart();
  }

  toggleActiveAll(active: boolean) {
    this.carts.update((cartItems) => cartItems.map((item) => ({ ...item, active })));
    this.saveCart();
  }

  clearCart() {
    this.carts.set([]);
    this.saveCart();
  }

  showToast(message: string) {
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

    // Create toast box
    const toast = document.createElement('div');
    toast.className = 'custom-toast animate-toast-in';
    toast.style.background = '#ffffff';
    toast.style.color = '#1a2536';
    toast.style.border = '1px solid #e4e2dd';
    toast.style.borderLeft = '4px solid #bfa07a';
    toast.style.padding = '16px 24px';
    toast.style.borderRadius = '16px';
    toast.style.boxShadow = '0 12px 36px rgba(26, 37, 54, 0.12)';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '14px';
    toast.style.fontFamily = 'var(--font-sans)';
    toast.style.fontSize = '14.5px';
    toast.style.fontWeight = '700';
    toast.style.minWidth = '340px';
    toast.style.maxWidth = '450px';
    toast.style.pointerEvents = 'auto';
    toast.style.transition = 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)';

    // Icon (Bootstrap Icon)
    const iconWrapper = document.createElement('div');
    iconWrapper.style.width = '32px';
    iconWrapper.style.height = '32px';
    iconWrapper.style.borderRadius = '50%';
    iconWrapper.style.backgroundColor = '#fbf8f5';
    iconWrapper.style.display = 'flex';
    iconWrapper.style.alignItems = 'center';
    iconWrapper.style.justifyContent = 'center';
    iconWrapper.style.flexShrink = '0';

    const icon = document.createElement('i');
    icon.className = 'bi bi-bag-check-fill';
    icon.style.color = '#bfa07a';
    icon.style.fontSize = '16px';
    iconWrapper.appendChild(icon);
    toast.appendChild(iconWrapper);

    // Text Content
    const textNode = document.createElement('div');
    textNode.style.flexGrow = '1';

    const text = document.createElement('span');
    text.textContent = message;
    text.style.color = '#1a2536';
    textNode.appendChild(text);
    toast.appendChild(textNode);

    // Close Button
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

    container.appendChild(toast);

    // Auto close
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(60px) scale(0.9)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4000);
  }
}
