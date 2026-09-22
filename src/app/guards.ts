import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from './services/api.service';

/** Wpuszcza tylko zalogowanych. */
export const authGuard: CanActivateFn = () =>
  inject(ApiService).user() ? true : inject(Router).createUrlTree(['/login']);

/** Wpuszcza tylko wuefistę (rola admin). */
export const adminGuard: CanActivateFn = () => {
  const u = inject(ApiService).user();
  if (u?.Rola === 'admin') return true;
  return inject(Router).createUrlTree([u ? '/pomiary' : '/login']);
};

/** Zalogowany nie musi widzieć strony logowania - od razu trafia do swojego panelu. */
export const goscGuard: CanActivateFn = () => {
  const u = inject(ApiService).user();
  if (!u) return true;
  return inject(Router).createUrlTree([u.Rola === 'admin' ? '/admin' : '/pomiary']);
};
