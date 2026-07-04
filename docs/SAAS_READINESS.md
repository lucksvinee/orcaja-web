# SaaS Readiness

## Estado atual

O projeto agora tem uma base para SaaS comercial:

- Autenticacao por Firebase Auth.
- Perfis com `role`, `status`, `plan` e periodo de trial.
- Firestore Rules com isolamento por `user_id`.
- Storage Rules para logos de empresa.
- Cloud Functions administrativas para status/plano/uso.
- API serverless `/api/comparar-precos` para Vercel.
- Emuladores configurados para desenvolvimento.
- Estrutura de regras de calculo separada em utilitarios reutilizaveis.
- Calculadora de materiais para estimar metragem de cabo, eletroduto, caixas, disjuntores e mao de obra a partir do tipo de servico.

## Modelo de dados recomendado

### `profiles/{uid}`

```js
{
  email: string,
  role: 'tenant' | 'admin',
  status: 'trialing' | 'active' | 'blocked' | 'cancelled',
  plan: 'trial' | 'starter' | 'pro' | 'business',
  trial_ends_at: Timestamp,
  created_at: string,
  updated_at: string
}
```

### `company_profiles/{uid}`

```js
{
  user_id: string,
  company_name: string,
  company_address: string,
  company_phone: string,
  company_email: string,
  logo_path: string
}
```

### `clientes/{docId}`

```js
{
  user_id: string,
  nome: string,
  email: string,
  telefone: string,
  endereco: string,
  created_at: string
}
```

### `orcamentos/{docId}`

```js
{
  user_id: string,
  cliente_id: string,
  numero: number,
  itens: array,
  servicos: array,
  total: number,
  status: 'pendente' | 'aprovado' | 'recusado' | 'concluido',
  created_at: string,
  updated_at: string
}
```

### `catalog_overrides/{uid}`

```js
{
  user_id: string,
  materiais: {
    [catalogItemId]: { qtd: number, precoVenda: number, custo: number }
  },
  servicos: {
    [catalogItemId]: { horas: number, valorHora: number }
  },
  updated_at: string
}
```

Guarda a tabela de preços personalizada de cada prestador sem alterar o catálogo padrão do sistema.

## Proximas entregas comerciais

1. Cobrança: integrar Stripe, Mercado Pago ou Asaas.
2. Limites por plano: maximo de orcamentos, IA e usuarios.
3. Link publico do orçamento: cliente aprova/recusa sem login.
4. Upload de logo e personalizacao do PDF.
5. Recuperacao de senha e verificacao de email.
6. Exportacao CSV/PDF dos dados do prestador.
7. Testes de Firestore Rules com Firebase Emulator.
8. Monitoramento de erro: Sentry, Firebase Crashlytics Web alternativo ou logs estruturados.
9. Backup automatizado do Firestore.
10. Termos de uso, privacidade e consentimento LGPD.

## Politica operacional sugerida

- `trialing`: acesso liberado ate `trial_ends_at`. Ao expirar, o app mostra aviso de pagamento e as Firestore Rules bloqueiam leitura/escrita dos dados do tenant.
- `active`: cliente pagante.
- `blocked`: inadimplente ou bloqueio administrativo.
- `cancelled`: contrato encerrado, acesso desativado.

Nunca promova usuario para admin pelo frontend. Use Firebase Admin SDK em ambiente controlado.

Para projetos que ja tinham perfis `trialing` com `trial_ends_at` em string, execute `npm run admin:migrate-trial-dates` uma vez antes de publicar as novas Firestore Rules.
