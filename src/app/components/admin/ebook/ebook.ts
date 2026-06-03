import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Book } from '../../../interfaces/book';
import { BookService } from '../../../services/book.service';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-ebook',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ebook.html',
  styleUrl: './ebook.css'
})
export class EbookComponent {
  bookService = inject(BookService);
  cartService = inject(CartService);
  protected readonly Math = Math;

  // Lists
  ebooks = computed(() => this.bookService.allBooks());
  categories = computed(() => this.bookService.getCategoryNames());

  // Form State
  formEbook = signal<Book>(this.emptyEbook());
  isEditing = signal<boolean>(false);
  editingId = signal<string>('');

  // Handle new custom category input
  selectedCategoryType = signal<string>('SELECT'); // 'SELECT' or 'NEW'
  customCategoryName = signal<string>('');

  // Search input for book list
  searchTerm = signal<string>('');

  // Pagination for admin table
  currentPage = signal<number>(1);
  pageSize = signal<number>(5);

  filteredEbooks = computed(() => {
    const list = this.ebooks();
    const query = this.searchTerm().trim().toLowerCase();
    if (!query) return list;
    return list.filter(b =>
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      b.category.toLowerCase().includes(query)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredEbooks().length / this.pageSize())));
  pagedEbooks = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredEbooks().slice(start, start + this.pageSize());
  });

  emptyEbook(): Book {
    return {
      id: '',
      title: '',
      image: '/image/ebooknew1.jpg',
      category: '',
      author: '',
      description: '',
      pages: 0,
      price: 0,
      discount: '0%',
      stock: 0,
      publishDate: new Date().getFullYear().toString(),
      translator: 'Chưa xác định'
    };
  }

  ngOnInit() {
    this.resetForm();
  }

  resetForm() {
    this.formEbook.set(this.emptyEbook());
    this.isEditing.set(false);
    this.editingId.set('');
    this.selectedCategoryType.set('SELECT');
    this.customCategoryName.set('');

    // Set default category to first available
    const cats = this.categories();
    if (cats.length > 0) {
      this.formEbook.update(b => ({ ...b, category: cats[0] }));
    }
  }

  onCategoryTypeChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    if (value === 'CUSTOM_NEW_CAT') {
      this.selectedCategoryType.set('NEW');
    } else {
      this.selectedCategoryType.set('SELECT');
      this.formEbook.update(b => ({ ...b, category: value }));
    }
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          this.formEbook.update(b => ({ ...b, image: result }));
        }
      };
      reader.readAsDataURL(file);
    }
  }

  editBook(book: Book) {
    this.isEditing.set(true);
    this.editingId.set(book.id);
    this.formEbook.set({ ...book });

    // Determine if category matches static list or needs Custom input
    const cats = this.categories();
    if (cats.includes(book.category)) {
      this.selectedCategoryType.set('SELECT');
      this.customCategoryName.set('');
    } else {
      this.selectedCategoryType.set('NEW');
      this.customCategoryName.set(book.category);
    }
  }

  deleteBook(id: string) {
    if (confirm('Bạn có chắc chắn muốn xóa cuốn sách này không?')) {
      this.bookService.delete(id);
      this.cartService.showToast('Xóa sách thành công!');
      // Adjust page if current page exceeds total pages after deletion
      if (this.currentPage() > this.totalPages()) {
        this.currentPage.set(this.totalPages());
      }
    }
  }

  onSubmit() {
    const bookData = { ...this.formEbook() };

    // Validate Title and Author
    if (!bookData.title.trim() || !bookData.author.trim()) {
      alert('Vui lòng nhập đầy đủ Tên sách và Tác giả.');
      return;
    }

    // Determine final category
    if (this.selectedCategoryType() === 'NEW') {
      const newCat = this.customCategoryName().trim();
      if (!newCat) {
        alert('Vui lòng nhập tên danh mục mới.');
        return;
      }
      bookData.category = newCat;
    } else {
      if (!bookData.category) {
        alert('Vui lòng chọn danh mục cho sách.');
        return;
      }
    }

    // Standardize discount format (add % if missing)
    let disc = bookData.discount.toString().trim();
    if (disc && !disc.endsWith('%') && !isNaN(Number(disc))) {
      disc = disc + '%';
    }
    bookData.discount = disc || '0%';

    if (this.isEditing()) {
      this.bookService.update(this.editingId(), bookData);
      this.cartService.showToast('Cập nhật sách thành công!');
    } else {
      // Generate ID
      bookData.id = 'book_' + Date.now();
      this.bookService.create(bookData);
      this.cartService.showToast('Thêm mới sách thành công!');
    }

    this.resetForm();
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + ' đ';
  }

  resetDatabase() {
    if (confirm('Bạn có chắc chắn muốn khôi phục toàn bộ sách mặc định ban đầu không? (Hành động này sẽ tải lại danh sách sách mẫu đầy đủ)')) {
      this.bookService.resetToDefault();
      this.currentPage.set(1);
      this.cartService.showToast('Khôi phục danh sách sách mẫu thành công!');
    }
  }
}
