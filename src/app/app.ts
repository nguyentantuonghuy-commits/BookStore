import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { FooterComponent } from './components/footer/footer';
import { HeaderComponent } from './components/header/header';

@Component({
  selector: 'app-root',
  imports: [HeaderComponent, RouterOutlet, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  router = inject(Router);

  isDashboardPage(): boolean {
    return this.router.url.includes('/dashboard');
  }
}
