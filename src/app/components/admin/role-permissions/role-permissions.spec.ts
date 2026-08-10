import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RolePermissionsComponent } from './role-permissions';
import { routes } from '../../../app.routes';

describe('RolePermissionsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RolePermissionsComponent],
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(RolePermissionsComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });
});
