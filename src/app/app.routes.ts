import { Routes } from '@angular/router';
import { adminGuard, authGuard, goscGuard } from './guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    canActivate: [goscGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage),
  },
  {
    path: 'pomiary',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/pomiary/pomiary').then((m) => m.PomiaryPage),
  },
  {
    path: 'wykres/:userId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/wykres/wykres').then((m) => m.WykresPage),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminPage),
  },
  { path: '**', redirectTo: 'login' },
];
