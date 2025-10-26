import { Component, ElementRef, ViewChild, AfterViewInit, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { isBrowser } from '../utils/is-browser';

@Component({
  selector: 'app-mapa',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mapa.component.html',
  styleUrls: ['./mapa.component.css']
})
export class MapaComponent implements AfterViewInit, OnInit {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef;

  map!: google.maps.Map;
  directionsRenderer!: google.maps.DirectionsRenderer;

  // Dados do formulário
  tipoCarona: string = 'oferecer';
  origem: string = '';
  destino: string = '';
  entradaFatec: string = '';
  saidaFatec: string = '';
  ajudaCusto: number | null = null;

  // Dados das viagens
  viagens: any[] = [];
  caronasOferecidas: any[] = [];
  caronasProcuradas: any[] = [];

  // Dados das avaliações
  mostrarAvaliacao: boolean = false;
  nomeUsuarioSelecionado: string = '';
  idUsuarioSelecionado: number | null = null;
  avaliacaoSelecionada: number = 0;
  comentarioAvaliacao: string = '';

  avaliacoesRecebidas: any[] = [];
  avaliacoesEnviadas: any[] = [];
  usuarios: any[] = [];

  // Configuração da API
  baseURL = isBrowser() && window.location.hostname.includes('localhost')
    ? 'http://localhost:3000/api'
    : 'https://projeto-faculride.onrender.com/api';

  usuarioLogado = isBrowser() ? JSON.parse(localStorage.getItem('usuarioLogado') || '{}') : {};
  meuId = this.usuarioLogado.idUsuario || this.usuarioLogado.id;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.carregarUsuarios();
    this.carregarViagens();
    this.carregarAvaliacoes();
  }

  ngAfterViewInit(): void {
    this.inicializarMapa();
  }

  inicializarMapa(): void {
    if (isBrowser()) {
      const mapOptions = {
        center: new google.maps.LatLng(-23.5015, -47.4526),
        zoom: 12,
        mapTypeId: google.maps.MapTypeId.ROADMAP
      };

      this.map = new google.maps.Map(this.mapContainer.nativeElement, mapOptions);
      this.directionsRenderer = new google.maps.DirectionsRenderer();
      this.directionsRenderer.setMap(this.map);
    }
  }

  carregarViagens(): void {
  this.http.get<any[]>(`${this.baseURL}/viagem`).subscribe({
    next: (res) => {
      this.viagens = res;

      this.caronasOferecidas = this.viagens
        .filter(v => v.idUsuario === this.meuId && v.tipoUsuario === 'Motorista')
        .map(v => ({
          partida: v.partida,
          destino: v.destino,
          entrada: v.horarioEntrada,
          saida: v.horarioSaida,
          ajuda: v.ajudaDeCusto
        }));

      this.caronasProcuradas = this.viagens
        .filter(v => v.idUsuario === this.meuId && v.tipoUsuario === 'Passageiro')
        .map(v => ({
          partida: v.partida,
          destino: v.destino,
          entrada: v.horarioEntrada,
          saida: v.horarioSaida,
          ajuda: v.ajudaDeCusto
        }));
    },
    error: (err) => {
      console.error('Erro ao carregar viagens:', err);
    }
  });
}

  carregarUsuarios(): void {
    this.http.get<any[]>(`${this.baseURL}/usuario`).subscribe({
      next: (res) => {
        this.usuarios = res;
      },
      error: (err) => {
        console.error('Erro ao carregar usuários:', err);
      }
    });
  }

  tracarRota(): void {
    if (!this.origem || !this.destino || !this.entradaFatec || !this.saidaFatec) {
      alert('Preencha todos os campos.');
      return;
    }

    const dadosViagem = {
      tipoUsuario: this.tipoCarona === 'oferecer' ? 'Motorista' : 'Passageiro',
      partida: this.origem,
      destino: this.destino,
      horarioEntrada: this.entradaFatec,
      horarioSaida: this.saidaFatec,
      ajudaDeCusto: this.ajudaCusto ? this.ajudaCusto.toString() : "0",
      idUsuario: this.meuId
    };

    this.http.post(`${this.baseURL}/viagem`, dadosViagem).subscribe({
      next: () => {
        alert('Rota cadastrada com sucesso!');
        this.carregarViagens();
      },
      error: (err) => {
        console.error('Erro ao cadastrar viagem:', err);
        alert('Erro ao cadastrar rota.');
      }
    });

    if (isBrowser()) {
      const request: google.maps.DirectionsRequest = {
        origin: this.origem,
        destination: this.destino,
        travelMode: google.maps.TravelMode.DRIVING
      };

      const directionsService = new google.maps.DirectionsService();

      directionsService.route(request, (result, status) => {
        if (status === 'OK' && result) {
          this.directionsRenderer.setDirections(result);
        } else {
          console.error('Erro ao traçar rota:', status);
        }
      });
    }
  }

  mostrarRota(partida: string, destino: string): void {
    if (isBrowser()) {
      const request: google.maps.DirectionsRequest = {
        origin: partida,
        destination: destino,
        travelMode: google.maps.TravelMode.DRIVING
      };

      const directionsService = new google.maps.DirectionsService();

      directionsService.route(request, (result, status) => {
        if (status === 'OK' && result) {
          this.directionsRenderer.setDirections(result);
        } else {
          console.error('Erro ao traçar rota:', status);
        }
      });

      setTimeout(() => {
        this.mapContainer.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }

  abrirWhatsapp(nome: string, idUsuario: number, numeroWhatsapp: string) {
    if (!numeroWhatsapp) {
      alert('Número de WhatsApp não disponível');
      return;
    }

    if (isBrowser()) {
      window.open(`https://wa.me/${numeroWhatsapp}`, '_blank');
    }

    setTimeout(() => {
      const confirmado = confirm(`A carona com ${nome} foi realizada? Deseja avaliar?`);
      if (confirmado) {
        this.nomeUsuarioSelecionado = nome;
        this.idUsuarioSelecionado = idUsuario;
        this.mostrarAvaliacao = true;
      }
    }, 1000);
  }

  enviarAvaliacao() {
    if (!this.avaliacaoSelecionada) {
      alert('Por favor, selecione uma nota.');
      return;
    }

    const avaliacao = {
      ID_Avaliador: this.meuId,
      ID_Avaliado: this.idUsuarioSelecionado,
      Comentario: this.comentarioAvaliacao,
      Estrelas: this.avaliacaoSelecionada
    };

    this.http.post(`${this.baseURL}/avaliacao`, avaliacao).subscribe({
      next: () => {
        alert(`✅ Avaliação enviada! Você avaliou ${this.nomeUsuarioSelecionado} com ${this.avaliacaoSelecionada} ⭐`);
        this.mostrarAvaliacao = false;
        this.avaliacaoSelecionada = 0;
        this.comentarioAvaliacao = '';
        this.carregarAvaliacoes();
      },
      error: (err) => {
        console.error(err);
        alert('Erro ao enviar avaliação.');
      }
    });
  }

  carregarAvaliacoes(): void {
    this.http.get<any[]>(`${this.baseURL}/avaliacao`).subscribe({
      next: (res) => {
        this.avaliacoesRecebidas = res
          .filter(a => a.ID_Avaliado === this.meuId)
          .map(a => ({
            ...a,
            nomeAvaliador: this.pegarNomeUsuario(a.ID_Avaliador)
          }));

        this.avaliacoesEnviadas = res
          .filter(a => a.ID_Avaliador === this.meuId)
          .map(a => ({
            ...a,
            nomeAvaliado: this.pegarNomeUsuario(a.ID_Avaliado)
          }));
      },
      error: (err) => {
        console.error('Erro ao carregar avaliações:', err);
      }
    });
  }

  pegarNomeUsuario(id: number): string {
    const usuario = this.usuarios.find(u => u.id === id || u.idUsuario === id);
    return usuario ? usuario.nome : 'Usuário';
  }

  obterFotoUsuario(email: string, genero: any): string {
    const u = this.usuarios.find(
      (x) => x?.email?.trim().toLowerCase() === (email || '').trim().toLowerCase()
    );

    const url = u?.foto || u?.fotoUrl;
    if (url) return url;

    if (genero === true) return 'assets/profile_man.jpeg';
    if (genero === false) return 'assets/profile_woman.jpeg';
    return 'assets/usuario.png';
  }

  excluirCarona(idViagem: number) {
  const confirmacao = confirm('Tem certeza que deseja excluir esta carona?');
  if (!confirmacao) return;

  this.http.delete(`${this.baseURL}/viagem/${idViagem}`).subscribe({
    next: () => {
      alert('Carona excluída com sucesso!');
      this.carregarViagens();
    },
    error: (err) => {
      console.error('Erro ao excluir carona:', err);
      alert('Erro ao excluir carona. Tente novamente.');
    }
  });
}

}
