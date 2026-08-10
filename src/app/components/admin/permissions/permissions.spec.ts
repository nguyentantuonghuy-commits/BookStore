import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PermissionsComponent } from './permissions';
import { routes } from '../../../app.routes';

describe('PermissionsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PermissionsComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(PermissionsComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
