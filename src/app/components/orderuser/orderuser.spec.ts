import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OrderUserComponent } from './orderuser';
import { routes } from '../../app.routes';

describe('OrderUserComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderUserComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(OrderUserComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
