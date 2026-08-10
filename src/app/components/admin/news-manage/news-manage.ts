import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewsService, Article } from '../../../services/news.service';
import { AuthService } from '../../../services/auth.service';
import { removeAccents } from '../../../utils/string-utils';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-news-manage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './news-manage.html',
  styleUrl: './news-manage.css'
})
export class NewsManageComponent implements OnInit {
  newsService = inject(NewsService);
  authService = inject(AuthService);
  cartService = inject(CartService);

  articles = computed(() => this.newsService.allArticles());

  // Quick statistics
  totalArticles = computed(() => this.articles().length);
  reviewSachCount = computed(() => this.articles().filter(a => a.category === 'Review Sách').length);
  suKienCount = computed(() => this.articles().filter(a => a.category === 'Sự Kiện').length);
  kinhNghiemCount = computed(() => this.articles().filter(a => a.category === 'Kinh Nghiệm').length);

  // Form signal state
  formArticle = signal<Article>(this.emptyArticle());
  isEditing = signal<boolean>(false);
  editingId = signal<string>('');
  isModalOpen = signal<boolean>(false);

  // Search & Pagination & Filter States
  searchTerm = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(5);
  selectedCategory = signal<string>('All');
  
  // Detail modal state
  selectedArticleForDetail = signal<Article | null>(null);
  isDetailModalOpen = signal<boolean>(false);

  categories = ['Review Sách', 'Sự Kiện', 'Kinh Nghiệm'];

  // Permission-based computed signals for controlling UI visibility
  canCreateNews = computed(() => this.authService.hasPermission('NEWS_CREATE'));
  canEditNews = computed(() => this.authService.hasPermission('NEWS_EDIT'));
  canDeleteNews = computed(() => this.authService.hasPermission('NEWS_DELETE'));

  filteredArticles = computed(() => {
    let list = this.articles();
    
    // Category Filter
    const cat = this.selectedCategory();
    if (cat !== 'All') {
      list = list.filter(a => a.category === cat);
    }
    
    // Search Filter
    const query = removeAccents(this.searchTerm().trim().toLowerCase());
    if (!query) return list;
    
    return list.filter(a =>
      removeAccents(a.title).toLowerCase().includes(query) ||
      removeAccents(a.author).toLowerCase().includes(query) ||
      removeAccents(a.category).toLowerCase().includes(query) ||
      removeAccents(a.summary).toLowerCase().includes(query)
    );
  });

  totalPages = computed(() => Math.max(1, Math.ceil(this.filteredArticles().length / this.pageSize())));

  pagedArticles = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredArticles().slice(start, start + this.pageSize());
  });

  emptyArticle(): Article {
    // Get formatted current date: DD/MM/YYYY
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}/${mm}/${yyyy}`;

    return {
      id: '',
      title: '',
      category: 'Review Sách',
      date: dateStr,
      author: this.authService.currentUser()?.fullName || 'Admin',
      readTime: '5 phút đọc',
      summary: '',
      content: '',
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600'
    };
  }

  ngOnInit() {
    this.resetForm();
  }

  resetForm() {
    this.formArticle.set(this.emptyArticle());
    this.isEditing.set(false);
    this.editingId.set('');
    this.isModalOpen.set(false);
  }

  openAddModal() {
    if (!this.canCreateNews()) {
      alert('Bạn không có quyền đăng tin tức mới. Vui lòng liên hệ quản trị viên để được cấp quyền NEWS_CREATE.');
      return;
    }
    this.resetForm();
    this.isModalOpen.set(true);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          this.formArticle.update(a => ({ ...a, imageUrl: result }));
        }
      };
      reader.readAsDataURL(file);
    }
  }

  editArticle(article: Article) {
    if (!this.canEditNews()) {
      alert('Bạn không có quyền chỉnh sửa tin tức. Vui lòng liên hệ quản trị viên để được cấp quyền NEWS_EDIT.');
      return;
    }
    this.isEditing.set(true);
    this.editingId.set(article.id);
    this.formArticle.set({ ...article });
    this.isModalOpen.set(true);
  }

  deleteArticle(id: string) {
    if (!this.canDeleteNews()) {
      alert('Bạn không có quyền xóa tin tức. Vui lòng liên hệ quản trị viên để được cấp quyền NEWS_DELETE.');
      return;
    }
    if (confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) {
      this.newsService.delete(id);
      this.cartService.showToast('Xóa bài viết thành công!');
      if (this.currentPage() > this.totalPages()) {
        this.currentPage.set(this.totalPages());
      }
    }
  }

  onSubmit() {
    const articleData = { ...this.formArticle() };

    if (!articleData.title || !articleData.title.trim() || !articleData.content || !articleData.content.trim()) {
      alert('Vui lòng nhập đầy đủ Tiêu đề và Nội dung bài viết.');
      return;
    }

    articleData.title = this.sanitizeField(articleData.title);
    articleData.author = this.sanitizeField(articleData.author);
    articleData.summary = this.sanitizeMultilineKeepParagraphs(articleData.summary);
    articleData.content = this.sanitizeMultilineKeepParagraphs(articleData.content);
    articleData.readTime = this.sanitizeField(articleData.readTime);

    if (this.isEditing()) {
      this.newsService.update(this.editingId(), articleData);
      this.cartService.showToast('Cập nhật bài viết thành công!');
    } else {
      this.newsService.create(articleData);
      this.cartService.showToast('Đăng bài viết mới thành công!');
    }

    this.resetForm();
  }

  setPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  resetDatabase() {
    if (this.authService.getCurrentUser()?.role !== 'admin') {
      alert('Chỉ quản trị viên tối cao mới có quyền khôi phục dữ liệu mẫu.');
      return;
    }
    if (confirm('Bạn có chắc muốn khôi phục toàn bộ danh sách bài viết mặc định không?')) {
      this.newsService.resetToDefault();
      this.currentPage.set(1);
      this.selectedCategory.set('All');
      this.cartService.showToast('Khôi phục danh sách bài viết thành công!');
    }
  }

  filterByCategory(category: string) {
    if (this.selectedCategory() === category) {
      this.selectedCategory.set('All');
    } else {
      this.selectedCategory.set(category);
    }
    this.currentPage.set(1);
  }

  viewArticleDetail(article: Article) {
    this.selectedArticleForDetail.set(article);
    this.isDetailModalOpen.set(true);
  }

  closeDetailModal() {
    this.selectedArticleForDetail.set(null);
    this.isDetailModalOpen.set(false);
  }

  editFromDetail(article: Article) {
    this.closeDetailModal();
    this.editArticle(article);
  }

  clearAllFilters() {
    this.selectedCategory.set('All');
    this.searchTerm.set('');
    this.currentPage.set(1);
  }

  private sanitizeField(val: string | undefined): string {
    if (!val) return '';
    return val
      .normalize('NFC')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  private sanitizeMultilineKeepParagraphs(val: string | undefined): string {
    if (!val) return '';
    return val
      .normalize('NFC')
      .split('\n')
      .map(line => line.replace(/[ \t]+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}
