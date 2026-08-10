import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderlistComponent } from './orderlist';
import { routes } from '../../../app.routes';

describe('OrderlistComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderlistComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(OrderlistComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
