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
  logo_path: string,
  company_accent_color: string,
  company_terms: string
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
  status: 'rascunho' | 'enviado' | 'visualizado' | 'aprovado' | 'recusado' | 'concluído',
  share_token: string,
  public_url: string,
  public_updated_at: string,
  revision_count: number,
  created_at: string,
  updated_at: string
}
```

### `orcamentos/{docId}/revisions/{revisionId}`

```js
{
  user_id: string,
  orcamento_id: string,
  revision_number: number,
  changed_at: string,
  changed_by: string,
  changed_fields: array,
  snapshot: object
}
```

Guarda um retrato anterior do orçamento antes de cada alteração, permitindo auditoria e comparação.

### `tenant_counters/{uid}`

```js
{
  user_id: string,
  next_orcamento_number: number,
  updated_at: string
}
```

Controla a numeração sequencial de orçamentos por prestador.

### `public_orcamentos/{shareToken}`

```js
{
  user_id: string,
  orcamento_id: string,
  share_token: string,
  public_url: string,
  numero: number,
  status: 'enviado' | 'visualizado' | 'aprovado' | 'recusado' | 'concluído',
  cliente: { nome: string },
  company: {
    name: string,
    address: string,
    phone: string,
    email: string,
    accent_color: string,
    terms: string
  },
  itens: array,
  servicos: array,
  total: number,
  total_materiais: number,
  total_servicos: number,
  valid_until: string,
  published_at: string,
  updated_at: string,
  viewed_at: string,
  responded_at: string
}
```

Versão pública e segura da proposta. O prestador publica com login; o cliente acessa por token e só pode marcar como visualizado, aprovado ou recusado.

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
3. Pagamento online: link PIX/cartao e baixa automatica do status do tenant.
4. Upload de logo usando Firebase Storage quando o Storage estiver ativo.
5. Verificacao de email.
6. Exportacao CSV/PDF dos dados do prestador. CSV de clientes e orcamentos ja disponivel no dashboard.
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
