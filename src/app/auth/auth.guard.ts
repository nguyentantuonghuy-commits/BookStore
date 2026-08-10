import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isLoggedIn = authService.isLoggedIn();
  const userRole = authService.getCurrentUser()?.role;
  if (!isLoggedIn) {
    router.navigate(['Signin']);
    return false;
  }
  if (userRole === 'customer') {
    router.navigate(['']); // Hoặc trang khác bạn muốn
    return false;
  }
  return true;
};
