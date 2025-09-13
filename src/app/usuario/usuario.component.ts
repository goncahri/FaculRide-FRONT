import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MapaComponent } from '../mapa/mapa.component';

@Component({
  selector: 'app-usuario',
  standalone: true,
  imports: [CommonModule, RouterLink, MapaComponent],
  templateUrl: './usuario.component.html',
  styleUrls: ['./usuario.component.css']
})
export class UsuarioComponent implements OnInit {

  usuarioNome: string = '';
  usuarioFoto: string = '/assets/usuario.png';

  ngOnInit(): void {
    const usuarioLogado = localStorage.getItem('usuarioLogado');

    if (usuarioLogado) {
      const usuario = JSON.parse(usuarioLogado);
      this.usuarioNome = usuario.nome?.split(' ')[0] || 'Usuário';

      this.usuarioFoto = this.obterFotoUsuario(usuario.email, usuario.genero);

      console.log('✅ Usuário logado:', usuario);
    } else {
      alert('Usuário não encontrado, faça login novamente.');
      window.location.href = '/login';
    }
  }

  abrirMenuUsuario() {
    console.log('Menu do usuário clicado');
  }

  obterFotoUsuario(email: string, genero: any): string {
    const usuarioLogado = localStorage.getItem('usuarioLogado');
    if (usuarioLogado) {
      const u = JSON.parse(usuarioLogado);
      if (u.foto || u.fotoUrl) {
        return u.foto || u.fotoUrl;
      }
    }

    if (genero === true) return '/assets/profile_man.jpeg';
    if (genero === false) return '/assets/profile_woman.jpeg';
    return '/assets/usuario.png';
  }
}
