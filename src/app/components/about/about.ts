import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  imports: [CommonModule, RouterLink],
  templateUrl: './about.html',
  styleUrl: './about.css'
})
export class AboutComponent {
  // Statistics
  stats = [
    { number: '10k+', label: 'Độc giả tin dùng', icon: 'bi-people' },
    { number: '5,000+', label: 'Đầu sách đa dạng', icon: 'bi-journal-bookmark' },
    { number: '100%', label: 'Sách chính hãng', icon: 'bi-patch-check' },
    { number: '24/7', label: 'Hỗ trợ khách hàng', icon: 'bi-headset' }
  ];

  // Core values
  values = [
    {
      title: 'Chất lượng hàng đầu',
      desc: 'Chúng tôi cam kết cung cấp những ấn phẩm chất lượng cao nhất, từ nội dung đến hình thức in ấn, đảm bảo bản quyền 100%.',
      icon: 'bi-trophy'
    },
    {
      title: 'Tận tâm phục vụ',
      desc: 'Trải nghiệm của độc giả là ưu tiên số một. Đội ngũ SachWeb luôn sẵn sàng lắng nghe, tư vấn và hỗ trợ tận tình.',
      icon: 'bi-heart'
    },
    {
      title: 'Lan tỏa tri thức',
      desc: 'Chúng tôi không chỉ bán sách, mà còn mong muốn kiến tạo một cộng đồng yêu sách, góp phần lan tỏa văn hóa đọc đến mọi người.',
      icon: 'bi-globe2'
    }
  ];
}
