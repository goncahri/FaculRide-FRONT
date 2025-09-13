import { isBrowser } from '../utils/is-browser';
import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  AbstractControl
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { NgxMaskDirective } from 'ngx-mask';

@Component({
  selector: 'app-gerenciar-conta',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, NgxMaskDirective],
  templateUrl: './gerenciar.component.html',
  styleUrls: ['./gerenciar.component.css']
})
export class GerenciarComponent implements OnInit {
  form: FormGroup;
  hoje: string = new Date().toISOString().split('T')[0];
  usuarioLogado: any;
  temVeiculo: boolean = false;
  idVeiculo: number | null = null;

  // ===== NOVO: estado da foto =====
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  fotoRemovida = false;

  baseURL = isBrowser() && window.location.hostname.includes('localhost')
    ? 'http://localhost:3000/api'
    : 'https://projeto-faculride.onrender.com/api';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.form = this.fb.group({
      nome: ['', Validators.required],
      cpf: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      telefone: ['', [Validators.required, Validators.pattern(/^\d{10,11}$/)]],
      cep: ['', Validators.required],
      endereco: ['', Validators.required],
      numero: ['', Validators.required],
      cidade: ['', Validators.required],
      estado: ['', Validators.required],
      fatec: ['', Validators.required],
      ra: ['', Validators.required],
      genero: ['', Validators.required],
      dataNascimento: ['', [Validators.required, this.validarDataNascimento]],

      modeloCarro: [''],
      anoCarro: [''],
      corCarro: [''],
      placa: ['']
    });
  }

  ngOnInit(): void {
    if (isBrowser()) {
      const usuario = JSON.parse(localStorage.getItem('usuarioLogado') || '{}');

      const id = usuario?.id || usuario?.idUsuario;

      if (!id) {
        alert('ID do usuário não encontrado. Faça login novamente.');
        window.location.href = '/login';
        return;
      }

      // Garante que tenha sempre o campo 'id'
      this.usuarioLogado = { ...usuario, id: id };

      this.temVeiculo = !!usuario.veiculo;
      this.idVeiculo = usuario.veiculo?.ID_veiculo ?? null;

      this.form.patchValue({
        nome: usuario.nome,
        cpf: usuario.cpf,
        email: usuario.email,
        telefone: usuario.telefone,
        cep: usuario.cep,
        endereco: usuario.endereco,
        numero: usuario.numero,
        cidade: usuario.cidade,
        estado: usuario.estado,
        fatec: usuario.fatec,
        ra: usuario.ra,
        genero: usuario.genero === true ? 'Masculino' : 'Feminino',
        dataNascimento: usuario.dataNascimento?.split('T')[0] || ''
      });

      if (this.temVeiculo) {
        this.form.patchValue({
          modeloCarro: usuario.veiculo.Modelo,
          anoCarro: usuario.veiculo.Ano ? usuario.veiculo.Ano.toString() : '',
          corCarro: usuario.veiculo.Cor,
          placa: usuario.veiculo.Placa_veiculo
        });
      }

      // Pré-visualizar foto atual (se existir)
      if (usuario.foto || usuario.fotoUrl) {
        this.previewUrl = usuario.foto || usuario.fotoUrl;
      }
    }
  }

  validarDataNascimento(control: AbstractControl) {
    const dataInformada = new Date(control.value);
    const hoje = new Date();
    return dataInformada > hoje ? { dataFutura: true } : null;
  }

  buscarEnderecoPorCep() {
    const cep = this.form.get('cep')?.value?.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;

    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(res => res.json())
      .then(data => {
        if (!data.erro) {
          this.form.patchValue({
            endereco: data.logradouro,
            cidade: data.localidade,
            estado: data.uf
          });
        } else {
          alert('CEP não encontrado.');
        }
      })
      .catch(() => {
        alert('Erro ao buscar o CEP.');
      });
  }

  adicionarVeiculo() {
    this.temVeiculo = true;
  }

  removerVeiculo() {
    if (!this.idVeiculo) {
      alert('Nenhum veículo cadastrado para excluir.');
      return;
    }

    const confirmacao = confirm('Você tem certeza que deseja excluir seu veículo?');
    if (!confirmacao) return;

    const baseVeiculo = `${this.baseURL}/veiculo`;

    this.http.delete(`${baseVeiculo}/${this.idVeiculo}`).subscribe({
      next: () => {
        alert('Veículo removido com sucesso!');
        this.temVeiculo = false;
        this.idVeiculo = null;
        this.form.patchValue({
          modeloCarro: '',
          anoCarro: '',
          corCarro: '',
          placa: ''
        });

        const usuarioSalvo = {
          ...this.usuarioLogado,
          veiculo: null
        };

        if (isBrowser()) {
          localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
        }

        this.usuarioLogado = usuarioSalvo;
      },
      error: (err) => {
        console.error('Erro ao remover veículo:', err);
        alert('Erro ao remover veículo. Tente novamente.');
      }
    });
  }

  // ===== NOVO: seleção/remoção da foto =====
  onFotoChange(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (!file) return;

    const allow = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allow.includes(file.type)) {
      alert('Arquivo inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Arquivo muito grande (máx. 2MB).');
      return;
    }

    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
    this.fotoRemovida = false;
  }

  removerFoto() {
    this.selectedFile = null;
    // se previewUrl for blob local, revoga; se for URL pública, apenas some o preview
    try { if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl); } catch {}
    this.previewUrl = null;
    this.fotoRemovida = true;
  }

  // ===== NOVO: helpers de upload/limpeza no back =====
  private uploadFoto(token: string) {
    if (!this.selectedFile) return Promise.resolve<{ fotoUrl?: string }>({});
    const fd = new FormData();
    fd.append('file', this.selectedFile, this.selectedFile.name);
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.post<any>(`${this.baseURL}/usuario/foto/upload`, fd, { headers }).toPromise();
  }

  private limparFoto(token: string) {
    if (!this.fotoRemovida) return Promise.resolve();
    const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });
    return this.http.patch(`${this.baseURL}/usuario/foto`, { fotoUrl: null, fotoPath: null }, { headers }).toPromise();
  }

  onSubmit() {
    this.form.markAllAsTouched();

    if (this.form.valid) {
      const formData = this.form.value;

      const usuarioAtualizado: any = {
        nome: formData.nome,
        cpf: formData.cpf,
        email: formData.email,
        telefone: formData.telefone,
        cep: formData.cep,
        endereco: formData.endereco,
        numero: formData.numero,
        cidade: formData.cidade,
        estado: formData.estado,
        fatec: formData.fatec,
        ra: formData.ra,
        genero: formData.genero === 'Masculino',
        dataNascimento: formData.dataNascimento,
        senha: this.usuarioLogado.senha,
        tipoUsuario: this.usuarioLogado.tipoUsuario
      };

      const id = this.usuarioLogado.id || this.usuarioLogado.idUsuario;

      this.http.put(`${this.baseURL}/usuario/${id}`, usuarioAtualizado).subscribe({
        next: async () => {
          // ===== NOVO: processa foto após atualizar dados =====
          try {
            const token = (isBrowser() ? localStorage.getItem('token') : null) || '';
            if (token) {
              if (this.selectedFile) {
                const up: any = await this.uploadFoto(token);
                if (up?.fotoUrl) {
                  this.usuarioLogado = { ...this.usuarioLogado, foto: up.fotoUrl, fotoUrl: up.fotoUrl };
                }
              } else if (this.fotoRemovida) {
                await this.limparFoto(token);
                this.usuarioLogado = { ...this.usuarioLogado, foto: null, fotoUrl: null };
              }
            }
          } catch (e) {
            console.warn('Falha ao processar foto (upload/limpar), seguindo com atualização:', e);
          }

          if (this.temVeiculo) {
            const veiculo = {
              Modelo: formData.modeloCarro,
              Ano: formData.anoCarro ? Number(formData.anoCarro) : null,
              Cor: formData.corCarro,
              Placa_veiculo: formData.placa,
              idUsuario: id
            };

            if (this.idVeiculo) {
              this.http.put(`${this.baseURL}/veiculo/${this.idVeiculo}`, veiculo).subscribe({
                next: () => this.finalizarAtualizacao(usuarioAtualizado, veiculo),
                error: (err) => {
                  console.error('Erro ao atualizar veículo:', err);
                  alert('Erro ao atualizar veículo.');
                }
              });
            } else {
              this.http.post(`${this.baseURL}/veiculo`, veiculo).subscribe({
                next: (res: any) => {
                  this.idVeiculo = res.ID_veiculo;
                  this.finalizarAtualizacao(usuarioAtualizado, res);
                },
                error: (err) => {
                  console.error('Erro ao criar veículo:', err);
                  alert('Erro ao criar veículo.');
                }
              });
            }
          } else {
            this.finalizarAtualizacao(usuarioAtualizado, null);
          }
        },
        error: (err) => {
          console.error('Erro ao atualizar usuário:', err);
          alert(err?.error?.erro || 'Erro ao atualizar os dados. Verifique e tente novamente.');
        }
      });
    } else {
      alert('Por favor, preencha todos os campos obrigatórios.');
    }
  }

  finalizarAtualizacao(usuarioAtualizado: any, veiculo: any) {
    const usuarioSalvo = {
      ...usuarioAtualizado,
      id: this.usuarioLogado.id,
      veiculo: veiculo,
      // mantém a foto atualizada (upload/limpeza)
      foto: this.usuarioLogado.foto ?? this.usuarioLogado.fotoUrl ?? null
    };

    if (isBrowser()) {
      localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
    }

    alert('Dados atualizados com sucesso!');
    if (isBrowser()) {
      window.location.reload();
    }
  }
}
