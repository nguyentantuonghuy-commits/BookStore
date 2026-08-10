import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NewsService } from '../../services/news.service';
import { removeAccents } from '../../utils/string-utils';

interface Article {
  id: string;
  title: string;
  category: 'Review Sách' | 'Sự Kiện' | 'Kinh Nghiệm';
  date: string;
  author: string;
  summary: string;
  content: string;
  imageUrl: string;
  readTime: string;
}

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './news.html',
  styleUrl: './news.css'
})
export class NewsComponent {
  private newsService = inject(NewsService);
  articles = this.newsService.allArticles;

  searchQuery = signal<string>('');
  selectedCategory = signal<string>('Tất cả');
  selectedArticle = signal<Article | null>(null);

  // Newsletter Subscription state
  userEmail = '';
  emailSubscribed = signal<boolean>(false);

  subscribeNewsletter(email: string) {
    if (email && email.trim() && email.includes('@')) {
      this.emailSubscribed.set(true);
    }
  }

  resetSubscription() {
    this.emailSubscribed.set(false);
  }

  categories = ['Tất cả', 'Review Sách', 'Sự Kiện', 'Kinh Nghiệm'];

  filteredArticles = computed(() => {
    let list = this.articles();
    const rawQuery = (this.searchQuery() || '').trim();
    const queryNormalized = removeAccents(rawQuery.toLowerCase());
    const queryWords = queryNormalized.split(/\s+/).filter(w => w.length > 0);
    const cat = this.selectedCategory();

    if (cat !== 'Tất cả') {
      list = list.filter(a => a.category === cat);
    }

    if (queryWords.length > 0) {
      list = list.filter(a => {
        const titleNorm = removeAccents(a.title || '').toLowerCase();
        const summaryNorm = removeAccents(a.summary || '').toLowerCase();
        const authorNorm = removeAccents(a.author || '').toLowerCase();
        const fullText = `${titleNorm} ${summaryNorm} ${authorNorm}`;
        return queryWords.every(w => fullText.includes(w));
      });
    }

    return list;
  });

  selectCategory(cat: string) {
    this.selectedCategory.set(cat);
  }

  viewArticleDetail(article: Article) {
    this.selectedArticle.set(article);
  }

  closeDetailModal() {
    this.selectedArticle.set(null);
  }
}
