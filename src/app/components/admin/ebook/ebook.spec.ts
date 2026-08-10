import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EbookComponent } from './ebook';
import { routes } from '../../../app.routes';

describe('EbookComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EbookComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(EbookComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
