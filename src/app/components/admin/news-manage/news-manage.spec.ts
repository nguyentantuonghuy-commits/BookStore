import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NewsManageComponent } from './news-manage';
import { routes } from '../../../app.routes';

describe('NewsManageComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewsManageComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(NewsManageComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
