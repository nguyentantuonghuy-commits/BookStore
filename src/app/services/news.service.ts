import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface Article {
  id: string;
  title: string;
  category: 'Review Sách' | 'Sự Kiện' | 'Kinh Nghiệm';
  date: string;
  author: string;
  readTime: string;
  summary: string;
  content: string;
  imageUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class NewsService {
  private platformId = inject(PLATFORM_ID);
  private articlesList: Article[] = [];
  allArticles = signal<Article[]>([]);

  private readonly STORAGE_KEY = 'news_articles';
  private readonly DATA_VERSION = 'v1_news';

  private defaultArticles: Article[] = [
    {
      id: 'art-1',
      title: 'Top 10 Cuốn Sách Phát Triển Bản Thân Đáng Đọc Nhất 2026',
      category: 'Review Sách',
      date: '02/07/2026',
      author: 'Nguyễn Văn A',
      readTime: '5 phút đọc',
      summary: 'Điểm qua những tựa sách best-seller giúp bạn định hình tư duy, tối ưu hóa hiệu suất làm việc và tìm lại sự cân bằng trong cuộc sống hiện đại.',
      content: 'Trong bối cảnh thế giới số hóa phát triển nhanh chóng, việc tự hoàn thiện và phát triển bản thân trở nên quan trọng hơn bao giờ hết. Bài viết này sẽ phân tích chi tiết 10 tác phẩm kinh điển và hiện đại hàng đầu như "Atomic Habits", "Đắc Nhân Tâm", và "Tư Duy Nhanh Và Chậm", đồng thời hướng dẫn bạn cách áp dụng các bài học thực tế từ sách vào đời sống hàng ngày để gặt hái thành công vượt bậc.',
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=600'
    },
    {
      id: 'art-2',
      title: 'Sự Kiện Ra Mắt CLB Đọc Sách & Giao Lưu Tác Giả Tháng 7',
      category: 'Sự Kiện',
      date: '28/06/2026',
      author: 'Ban Tổ Chức',
      readTime: '3 phút đọc',
      summary: 'Trân trọng kính mời quý độc giả tham gia buổi giao lưu đặc biệt với các nhà văn trẻ triển vọng tại chi nhánh Sachweb Quận 5 vào ngày 15/07 tới.',
      content: 'Nối tiếp chuỗi hành trình lan tỏa văn hóa đọc, Sachweb chính thức ra mắt Câu lạc bộ Đọc Sách Luxury. Tại đây, bạn sẽ có cơ hội thảo luận về những chủ đề văn học hấp dẫn, tham gia minigame nhận sách có chữ ký độc quyền, và trực tiếp đối thoại cùng 3 tác giả best-seller hàng đầu Việt Nam hiện nay. Nước uống và quà lưu niệm sẽ được phát hoàn toàn miễn phí cho 100 độc giả đăng ký sớm nhất.',
      imageUrl: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&q=80&w=600'
    },
    {
      id: 'art-3',
      title: 'Phương Pháp Đọc Sách Hiệu Quả: Nhớ Lâu Và Áp Dụng Thực Tế',
      category: 'Kinh Nghiệm',
      date: '20/06/2026',
      author: 'Trần Thị B',
      readTime: '8 phút đọc',
      summary: 'Bạn có bao giờ đọc xong một cuốn sách rồi quên sạch sau một tuần? Khám phá ngay kỹ thuật ghi chép Cornell và sơ đồ tư duy Mindmap chuyên nghiệp.',
      content: 'Đọc sách là một nghệ thuật, nhưng đọc làm sao để hấp thụ kiến thức tối đa lại là một khoa học. Bài viết này giới thiệu phương pháp Active Reading (Đọc chủ động) kết hợp cùng hệ thống ghi chép Feynman. Bạn sẽ học cách đặt câu hỏi phản biện, tóm tắt chương sách bằng ngôn ngữ cá nhân, và thiết lập hành động thực tế dựa trên nội dung sách để biến tri thức thành tài sản thực thụ của bản thân.',
      imageUrl: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&q=80&w=600'
    },
    {
      id: 'art-4',
      title: 'Kỷ Nguyên Sách Số Ebook: Xu Hướng Và Tương Lai Văn Hóa Đọc',
      category: 'Kinh Nghiệm',
      date: '15/06/2026',
      author: 'Lê Hoàng C',
      readTime: '6 phút đọc',
      summary: 'Sách nói (Audiobook) và Ebook đang thay đổi hoàn toàn thói quen tiêu dùng tri thức của thế hệ Gen Z và Alpha. Liệu sách giấy có bị thay thế?',
      content: 'Với sự bùng nổ của các thiết bị đọc sách chuyên dụng như Kindle, Kobo và các ứng dụng đọc sách thông minh, việc mang theo hàng ngàn cuốn sách bên mình đã trở thành hiện thực. Chúng tôi phân tích những ưu nhược điểm vượt trội của Ebook so với sách truyền thống, thống kê tỷ lệ tăng trưởng doanh số sách số, và đưa ra nhận định về sự song hành hài hòa giữa sách giấy nghệ thuật và sách số tiện ích trong tương lai gần.',
      imageUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=600'
    },
    {
      id: 'art-5',
      title: 'Review Sách "Muôn Kiếp Nhân Sinh" - Góc Nhìn Tâm Linh Sâu Sắc',
      category: 'Review Sách',
      date: '10/06/2026',
      author: 'Nguyễn Minh D',
      readTime: '7 phút đọc',
      summary: 'Cuốn sách làm mưa làm gió thị trường xuất bản Việt Nam mang lại bài học quý giá gì về luật nhân quả, luân hồi và tương lai nhân loại?',
      content: 'Tác phẩm của Giáo sư John Vu (Nguyên Phong) mở ra một bức tranh rộng lớn kết hợp giữa khoa học hiện đại, lịch sử các nền văn minh cổ đại từ Atlantis đến Ai Cập cổ đại, và những bài học triết lý nhân sinh uyên bác. Bài review này mổ xẻ những thông điệp cốt lõi của cuốn sách về tình yêu thương, sự thức tỉnh tâm linh và trách nhiệm của mỗi cá nhân trước những biến động lớn của hành tinh xanh.',
      imageUrl: 'https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&q=80&w=600'
    }
  ];

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedVersion = localStorage.getItem('news_version');
      const savedArticles = localStorage.getItem(this.STORAGE_KEY);

      if (savedArticles && savedVersion === this.DATA_VERSION) {
        try {
          this.articlesList = JSON.parse(savedArticles);
        } catch (e) {
          this.articlesList = [...this.defaultArticles];
          this.saveToLocalStorage();
        }
      } else {
        this.articlesList = [...this.defaultArticles];
        this.saveToLocalStorage();
      }
    } else {
      this.articlesList = [...this.defaultArticles];
    }
    this.allArticles.set(this.articlesList);
  }

  private saveToLocalStorage() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.articlesList));
      localStorage.setItem('news_version', this.DATA_VERSION);
    }
  }

  getArticles(): Article[] {
    return this.articlesList;
  }

  getArticleById(id: string): Article | undefined {
    return this.articlesList.find(a => a.id === id);
  }

  create(article: Omit<Article, 'id'>): void {
    const newArticle: Article = {
      ...article,
      id: 'art-' + Date.now()
    };
    this.articlesList.unshift(newArticle);
    this.saveToLocalStorage();
    this.allArticles.set([...this.articlesList]);
  }

  update(id: string, article: Article): void {
    const index = this.articlesList.findIndex(a => a.id === id);
    if (index !== -1) {
      this.articlesList[index] = { ...article };
      this.saveToLocalStorage();
      this.allArticles.set([...this.articlesList]);
    }
  }

  delete(id: string): void {
    this.articlesList = this.articlesList.filter(a => a.id !== id);
    this.saveToLocalStorage();
    this.allArticles.set([...this.articlesList]);
  }

  resetToDefault(): void {
    this.articlesList = [...this.defaultArticles];
    this.saveToLocalStorage();
    this.allArticles.set([...this.articlesList]);
  }
}
