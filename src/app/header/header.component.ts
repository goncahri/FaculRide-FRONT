import { isBrowser } from '../utils/is-browser';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit {
  isLoggedIn: boolean = false;
  nomeUsuario: string = '';
  fotoUsuario: string = '';
  isDropdownOpen: boolean = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    if (isBrowser()) {
      const usuarioLogado = localStorage.getItem('usuarioLogado');

      if (usuarioLogado) {
        const usuario = JSON.parse(usuarioLogado);
        this.nomeUsuario = usuario.nome?.split(' ')[0] || 'Usuário';

        // 👉 PRIORIDADE: fotoUrl (Supabase) → foto (legado) → avatares padrão
        const url: string | undefined = usuario.fotoUrl || usuario.foto;
        const fallback =
          usuario.genero === true
            ? '/assets/profile_man.jpeg'
            : usuario.genero === false
            ? '/assets/profile_woman.jpeg'
            : '/assets/usuario.png';

        // cache-buster pra não ficar com a imagem antiga após upload
        this.fotoUsuario = url ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : fallback;

        this.isLoggedIn = true;
      } else {
        this.nomeUsuario = '';
        this.fotoUsuario = '/assets/usuario.png';
        this.isLoggedIn = false;
      }
    }
  }

  // fallback se a imagem pública do Supabase falhar
  onImgError(): void {
    this.fotoUsuario = '/assets/usuario.png';
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  logout(): void {
    if (isBrowser()) {
      localStorage.removeItem('token');
      localStorage.removeItem('idUsuario');
      localStorage.removeItem('usuarioLogado');
    }

    this.isLoggedIn = false;
    this.isDropdownOpen = false;

    alert('Você saiu da sua conta.');
    window.location.href = '/login';
  }
}
