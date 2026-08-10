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
  if (state.url.includes('/dashboard') && !authService.isStaff()) {
    router.navigate(['']);
    return false;
  }
  return true;
};
