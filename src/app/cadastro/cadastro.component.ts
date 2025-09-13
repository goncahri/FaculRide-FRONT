import { Component } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  ReactiveFormsModule,
  AbstractControl
} from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgxMaskDirective } from 'ngx-mask';
import { HttpClient, HttpHeaders } from '@angular/common/http';

@Component({
  selector: 'app-cadastro',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgxMaskDirective],
  templateUrl: './cadastro.component.html',
  styleUrls: ['./cadastro.component.css']
})
export class CadastroComponent {
  cadastroForm: FormGroup;
  isMotorista: boolean = false;
  anoAtual = new Date().getFullYear();
  hoje: string = new Date().toISOString().split('T')[0];

  // ===== NOVO: estado da foto =====
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  baseURL = window.location.hostname.includes('localhost')
    ? 'http://localhost:3000/api/usuario'
    : 'https://projeto-faculride.onrender.com/api/usuario';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private http: HttpClient
  ) {
    this.cadastroForm = this.fb.group({
      tipoUsuario: ['passageiro', Validators.required],
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
      ra: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      genero: ['', Validators.required],
      dataNascimento: ['', [Validators.required, this.validarDataNascimento]],
      senha: ['', [Validators.required, Validators.minLength(6)]],
      repetirSenha: ['', Validators.required],
      cnh: [''],
      modeloCarro: [''],
      anoCarro: ['', [Validators.pattern(/^\d{4}$/), Validators.min(1980), Validators.max(this.anoAtual)]],
      corCarro: [''],
      placa: ['']
    }, { validators: this.validarSenhas });
  }

  // ✅ Validação de data de nascimento
  validarDataNascimento(control: AbstractControl) {
    const dataInformada = new Date(control.value);
    const hoje = new Date();
    if (dataInformada > hoje) {
      return { dataFutura: true };
    }
    return null;
  }

  // Ativar/desativar campos de motorista dinamicamente
  alternarCamposMotorista() {
    const tipo = this.cadastroForm.get('tipoUsuario')?.value;
    this.isMotorista = tipo === 'motorista';

    const campos = ['cnh', 'modeloCarro', 'anoCarro', 'corCarro', 'placa'];
    campos.forEach(campo => {
      const control = this.cadastroForm.get(campo);
      if (this.isMotorista) {
        control?.setValidators(Validators.required);
      } else {
        control?.clearValidators();
      }
      control?.updateValueAndValidity();
    });
  }

  // Validação se as senhas coincidem
  validarSenhas(group: FormGroup) {
    const senha = group.get('senha')?.value;
    const repetir = group.get('repetirSenha')?.value;
    return senha === repetir ? null : { senhasDiferentes: true };
  }

  // Busca endereço automático pelo CEP
  buscarEnderecoPorCep() {
    const cep = this.cadastroForm.get('cep')?.value?.replace(/\D/g, '');
    if (!cep || cep.length !== 8) return;

    fetch(`https://viacep.com.br/ws/${cep}/json/`)
      .then(res => res.json())
      .then(data => {
        if (!data.erro) {
          this.cadastroForm.patchValue({
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

  // ===== NOVO: selecionar/remover foto =====
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
  }

  removerFoto() {
    this.selectedFile = null;
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
  }

  // Envio do formulário com validação visual e alerta
  onSubmit() {
    this.cadastroForm.markAllAsTouched();

    if (this.cadastroForm.invalid) {
      const camposInvalidos = Object.keys(this.cadastroForm.controls).filter(
        campo => this.cadastroForm.get(campo)?.invalid
      );
      alert('Por favor, preencha corretamente os campos: ' + camposInvalidos.join(', '));
      return;
    }

    const formData = this.cadastroForm.value;

    const usuarioFinal: any = {
      ...formData,
      genero: formData.genero === 'Masculino'
    };

    if (formData.tipoUsuario === 'motorista') {
      usuarioFinal.veiculo = {
        Modelo: formData.modeloCarro,
        Ano: Number(formData.anoCarro),
        Cor: formData.corCarro,
        Placa_veiculo: formData.placa
      };
    }

    // 1) Cadastrar usuário
    this.http.post(this.baseURL, usuarioFinal).subscribe({
      next: (res: any) => {
        const idUsuario = res?.id;

        // 2) Login automático para obter token (necessário para upload)
        this.http.post(`${this.baseURL}/login`, {
          email: (formData.email as string).trim().toLowerCase(),
          senha: formData.senha
        }).subscribe({
          next: (login: any) => {
            const token = login?.token as string | undefined;

            // 3) Se houver foto selecionada, fazer upload
            if (token && this.selectedFile) {
              const fd = new FormData();
              fd.append('file', this.selectedFile, this.selectedFile.name);

              const headers = new HttpHeaders({
                Authorization: `Bearer ${token}`
              });

              this.http.post(`${this.baseURL}/foto/upload`, fd, { headers }).subscribe({
                next: (up: any) => {
                  const usuarioSalvo = {
                    ...usuarioFinal,
                    id: idUsuario,
                    foto: up?.fotoUrl // URL pública do Supabase
                  };
                  localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
                  alert('✅ Conta criada e foto enviada!');
                  this.router.navigate(['/login']);
                },
                error: () => {
                  // Sem bloquear o fluxo caso o upload falhe
                  const placeholder = usuarioFinal.genero
                    ? '/assets/profile_man.jpeg'
                    : '/assets/profile_woman.jpeg';
                  const usuarioSalvo = {
                    ...usuarioFinal,
                    id: idUsuario,
                    foto: placeholder
                  };
                  localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
                  alert('✅ Conta criada (falha ao enviar foto, tente depois em Perfil).');
                  this.router.navigate(['/login']);
                }
              });
            } else {
              // 4) Sem foto → salva com placeholder por gênero
              const placeholder = usuarioFinal.genero
                ? '/assets/profile_man.jpeg'
                : '/assets/profile_woman.jpeg';
              const usuarioSalvo = {
                ...usuarioFinal,
                id: idUsuario,
                foto: placeholder
              };
              localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
              alert('✅ Conta criada com sucesso!');
              this.router.navigate(['/login']);
            }
          },
          error: () => {
            alert('Conta criada, mas não foi possível fazer login automático.');
            this.router.navigate(['/login']);
          }
        });
      },
      error: (err) => {
        console.error('Erro ao cadastrar:', err);
        alert(err?.error?.erro || 'Erro ao criar conta. Verifique os dados.');
      }
    });
  }
}
