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

  // NOVO: estado do arquivo da foto (cadastro)
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

  // NOVO: seleção/preview de foto no cadastro
  onFotoChange(evt: Event) {
    const input = evt.target as HTMLInputElement;
    const file = input.files && input.files[0] ? input.files[0] : null;
    if (!file) return;

    const allow = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allow.includes(file.type)) {
      alert('Arquivo inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    // mesmo limite do back (2MB); se quiser aumentar, eu ajusto os dois lados
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande (máx. 5MB).');
      return;
    }


    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
  }

  removerFoto() {
    this.selectedFile = null;
    try { if (this.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(this.previewUrl); } catch {}
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

    // 1) Cadastra o usuário
    this.http.post(this.baseURL, usuarioFinal).subscribe({
      next: async (res: any) => {
        try {
          // 2) Login silencioso para obter o token
          const loginResp: any = await this.http.post(`${this.baseURL}/login`, {
            email: formData.email,
            senha: formData.senha
          }).toPromise();

          const token = loginResp?.token || '';
          const usuarioDoLogin = loginResp?.usuario || {};
          if (token) {
            localStorage.setItem('token', token);
          }

            // monta objeto salvo (mantendo padrão que você já usa)
            const usuarioSalvo = {
              ...usuarioFinal,
              id: usuarioDoLogin?.id ?? res.id,
              idUsuario: usuarioDoLogin?.id ?? res.id,
              veiculo: usuarioDoLogin?.veiculo ?? (usuarioFinal.veiculo || null),
              foto: null
            };

          // 3) Se tiver foto, envia agora com Authorization
          if (token && this.selectedFile) {
            const fd = new FormData();
            fd.append('file', this.selectedFile, this.selectedFile.name);
            const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

            try {
              const up: any = await this.http
                .post(`${this.baseURL}/foto/upload`, fd, { headers })
                .toPromise();

              if (up?.fotoUrl) {
                usuarioSalvo.foto = up.fotoUrl;
                usuarioSalvo.fotoUrl = up.fotoUrl;
              }
            } catch (e) {
              console.warn('Upload de foto falhou após cadastro:', e);
              // segue sem travar a criação da conta
            }
          }

          // 4) Salva no localStorage e navega
          localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
          alert('✅ Conta criada com sucesso!');
          this.router.navigate(['/login']);
        } catch (e) {
          console.error('Falha no login/ upload pós-cadastro:', e);
          // fallback: salva usuário sem foto
          const usuarioSalvo = {
            ...usuarioFinal,
            id: res.id,
            foto: null
          };
          localStorage.setItem('usuarioLogado', JSON.stringify(usuarioSalvo));
          alert('Conta criada, mas não foi possível concluir o envio da foto. Você pode enviar depois em Perfil.');
          this.router.navigate(['/login']);
        }
      },
      error: (err) => {
        console.error('Erro ao cadastrar:', err);
        alert(err?.error?.erro || 'Erro ao criar conta. Verifique os dados.');
      }
    });
  }
}
