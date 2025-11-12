import { isBrowser } from '../utils/is-browser';
import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Router, RouterLink, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import {
  NotificationService,
  Notification,
} from '../services/notification.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit, AfterViewInit {
  isLoggedIn = false;
  nomeUsuario = '';
  fotoUsuario = '';

  isUserDropdownOpen = false;
  isNotificationsOpen = false;

  unreadCount = 0;
  notifications: Notification[] = [];

  constructor(
    private router: Router,
    private authService: AuthService,
    private notificationService: NotificationService
  ) {}

  ngOnInit(): void {
    if (isBrowser()) {
      this.atualizarUsuarioLogado();

      // 🔁 Atualiza sempre que a rota mudar (ex: login → /usuario)
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe(() => {
          this.atualizarUsuarioLogado();
        });

      // 🔔 Atualiza badge e lista de notificações
      this.notificationService.notifications$.subscribe((list) => {
        this.notifications = list || [];
        this.unreadCount = this.notifications.filter((n) => !n.isRead).length;
      });
    }
  }

  ngAfterViewInit(): void {
    // Revalida login após renderização completa (caso de redirecionamento rápido)
    setTimeout(() => this.atualizarUsuarioLogado(), 300);
  }

  /** Atualiza informações do usuário no header */
  private atualizarUsuarioLogado(): void {
    this.isLoggedIn = this.authService.isAuthenticated();

    if (!isBrowser()) return;

    const usuarioLogado = localStorage.getItem('usuarioLogado');
    if (usuarioLogado) {
      const usuario = JSON.parse(usuarioLogado);
      this.nomeUsuario = usuario.nome?.split(' ')[0] || 'Usuário';

      const url: string | undefined = usuario.fotoUrl || usuario.foto;
      const fallback =
        usuario.genero === true
          ? '/assets/profile_man.jpeg'
          : usuario.genero === false
          ? '/assets/profile_woman.jpeg'
          : '/assets/usuario.png';

      this.fotoUsuario = url
        ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`
        : fallback;

      this.isLoggedIn = true;
    } else {
      this.resetUserInfo();
    }
  }

  private resetUserInfo(): void {
    this.nomeUsuario = '';
    this.fotoUsuario = '/assets/usuario.png';
    this.isLoggedIn = false;
  }

  onImgError(): void {
    this.fotoUsuario = '/assets/usuario.png';
  }

  toggleUserDropdown(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
    if (this.isUserDropdownOpen) {
      this.isNotificationsOpen = false;
    }
  }

  toggleNotifications(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isNotificationsOpen = !this.isNotificationsOpen;
    if (this.isNotificationsOpen) {
      this.isUserDropdownOpen = false;
    }
  }

  markAsRead(id: number, event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.notificationService.markAsRead(id);
  }

  markAllAsRead(event?: MouseEvent) {
    if (event) event.stopPropagation();
    this.notificationService.markAllAsRead();
  }

  logout(event?: MouseEvent): void {
    if (event) event.stopPropagation();

    this.authService.logout();
    this.resetUserInfo();

    alert('Você saiu da sua conta.');
    this.router.navigate(['/login']);
  }
}
