import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.currentUser()) {
    return true;
  }

  // Nếu đã đăng nhập, chuyển hướng về trang chủ
  router.navigate(['/']);
  return false;
};
