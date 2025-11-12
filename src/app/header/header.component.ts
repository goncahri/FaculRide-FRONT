import { isBrowser } from '../utils/is-browser';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../services/auth.service';
import {
  NotificationService,
  Notification,
} from '../services/notification.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css'],
})
export class HeaderComponent implements OnInit {
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

        this.isLoggedIn = this.authService.isAuthenticated();
      } else {
        this.resetUserInfo();
      }

      // Assina notificações para atualizar badge e lista
      this.notificationService.notifications$.subscribe((list) => {
        this.notifications = list || [];
        this.unreadCount = this.notifications.filter((n) => !n.isRead).length;
      });
    }
  }

  private resetUserInfo() {
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
    // fecha notificações se abrir menu do usuário
    if (this.isUserDropdownOpen) {
      this.isNotificationsOpen = false;
    }
  }

  toggleNotifications(event?: MouseEvent): void {
    if (event) event.stopPropagation();
    this.isNotificationsOpen = !this.isNotificationsOpen;
    // fecha menu do usuário se abrir notificações
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

    this.authService.logout(); // limpa token + socket + notificações
    this.resetUserInfo();

    alert('Você saiu da sua conta.');
    this.router.navigate(['/login']);
  }
}
