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

        // ✅ Usa foto do Supabase se existir
        if (usuario.foto) {
          this.fotoUsuario = usuario.foto;
        } else if (usuario.genero === true) {
          this.fotoUsuario = '/assets/profile_man.jpeg';
        } else if (usuario.genero === false) {
          this.fotoUsuario = '/assets/profile_woman.jpeg';
        } else {
          this.fotoUsuario = '/assets/usuario.png';
        }

        this.isLoggedIn = true;
      } else {
        this.nomeUsuario = '';
        this.fotoUsuario = '/assets/usuario.png';
        this.isLoggedIn = false;
      }
    }
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
