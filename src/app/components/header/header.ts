import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { BookService } from '../../services/book.service';
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class HeaderComponent {
  searching = '';
  public authService = inject(AuthService);

  constructor(
    private bookService: BookService,
    public cartService: CartService,
    private router: Router
  ) { }

  onSearch(): void {
    this.bookService.onSearch(this.searching);
    if (this.router.url !== '/' && this.router.url !== '/#') {
      this.router.navigate(['/']);
    }
  }

  logout(): void {
    this.authService.logout();
    this.cartService.showToast('Đăng xuất tài khoản thành công.');
    this.router.navigate(['/']);
  }
}
