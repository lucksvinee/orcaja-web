# Analise do Projeto de Extensao - OrcaJa Web

## 1. Identificacao do projeto

**Nome do projeto:** OrcaJa Web  
**Tipo:** Aplicacao web SaaS/PWA para criacao e gestao de orcamentos.  
**Publico-alvo:** prestadores de servico autonomos e pequenos negocios, especialmente nas areas de eletrica, hidraulica, pintura, acabamento e manutencao residencial.  
**Stack principal:** React, Vite, Firebase Auth, Firestore, Firebase Cloud Functions, Firebase Storage, Vercel Serverless Functions, PWA, Tailwind CSS, jsPDF e Zod.

## 2. Resumo executivo

O OrcaJa Web e um sistema voltado para digitalizar e simplificar o processo de criacao de orcamentos por prestadores de servico. A aplicacao permite cadastrar clientes, montar orcamentos com materiais e mao de obra, usar catalogos prontos, personalizar precos, calcular insumos automaticamente, gerar PDF profissional, compartilhar mensagens por WhatsApp e acompanhar o status comercial das propostas.

O projeto tem boa aderencia a uma proposta de extensao, pois atua sobre um problema real de pequenos prestadores: dificuldade de organizar clientes, precificar servicos, formalizar propostas e acompanhar oportunidades comerciais. A solucao pode contribuir para profissionalizacao, aumento de produtividade, melhoria na comunicacao com clientes e reducao de erros manuais.

## 3. Problema abordado

Muitos profissionais autonomos fazem orcamentos em papel, mensagens soltas ou planilhas improvisadas. Isso gera problemas como:

- perda de historico de clientes;
- falta de padronizacao na precificacao;
- dificuldade para lembrar materiais necessarios;
- demora para enviar proposta ao cliente;
- pouca visibilidade sobre orcamentos pendentes, aprovados e recusados;
- baixa formalizacao do atendimento.

O OrcaJa propoe uma ferramenta simples e acessivel para transformar esse fluxo em um processo digital, organizado e mais profissional.

## 4. Objetivo geral

Desenvolver uma aplicacao web para auxiliar prestadores de servico na criacao, organizacao e acompanhamento de orcamentos, promovendo inclusao digital, melhoria operacional e profissionalizacao do atendimento ao cliente.

## 5. Objetivos especificos

- Permitir cadastro e consulta de clientes.
- Criar orcamentos com materiais, servicos e totalizacao automatica.
- Disponibilizar catalogo inicial de materiais, servicos e pacotes.
- Permitir personalizacao de precos por usuario.
- Gerar PDF de orcamento com dados do cliente e da empresa.
- Facilitar contato com o cliente via WhatsApp.
- Acompanhar status de orcamentos em um painel comercial.
- Proteger dados por usuario com autenticacao e regras de acesso.
- Oferecer estrutura SaaS com perfil, plano, status e painel administrativo.

## 6. Funcionalidades implementadas

### Autenticacao e perfis

- Login, cadastro e recuperacao de senha por Firebase Auth.
- Criacao automatica de perfil de usuario tenant em trial.
- Controle de acesso por perfil e status.
- Redirecionamento para tela de bloqueio quando o usuario esta sem acesso ativo.
- Area administrativa para visualizar perfis e alterar status.

### Clientes

- Cadastro de cliente com validacao de nome, email e telefone.
- Listagem, busca e exclusao de clientes.
- Atalhos para telefone, email e WhatsApp.
- Pagina de detalhe com historico de orcamentos, valor total e ticket medio.

### Orcamentos

- Criacao e edicao de orcamentos.
- Inclusao de materiais e servicos manualmente.
- Edicao de quantidade, preco de venda, custo, horas e valor por hora.
- Calculo automatico de total de materiais, total de mao de obra e total geral.
- Salvamento no Firestore com vinculacao ao usuario e ao cliente.
- Atualizacao de status: pendente, aprovado, recusado e concluido.

### Catalogo rapido

- Catalogo inicial de materiais por categoria.
- Catalogo inicial de servicos por categoria.
- Pacotes prontos para servicos comuns.
- Busca e filtro por categoria.
- Persistencia de precos personalizados por usuario em `catalog_overrides`.

### Calculadora de materiais

- Estimativa de materiais para:
  - novo ponto de tomada;
  - instalacao de chuveiro;
  - pontos de iluminacao.
- Calculo de metragem de cabo, eletroduto, caixas, conectores, disjuntores e mao de obra.
- Inclusao automatica do plano calculado no orcamento.

### PDF e compartilhamento

- Geracao de PDF A4 com dados da empresa, dados do cliente, itens, subtotais, total e observacoes.
- Compartilhamento por WhatsApp com resumo de materiais, servicos e total.
- Cadastro de dados da empresa para aparecer no PDF.

### IA e comparacao de precos

- Cloud Function autenticada `gerarOrcamentoComIA`, atualmente como placeholder seguro.
- Controle de uso da funcionalidade de IA.
- API serverless `/api/comparar-precos` com busca no Mercado Livre e fallback estimado.
- Plugin local no Vite para endpoint de comparacao durante desenvolvimento.

### PWA e deploy

- Manifest PWA configurado.
- Service worker gerado pelo `vite-plugin-pwa`.
- Configuracao de deploy na Vercel com rewrite para SPA.
- Configuracao Firebase para Auth, Firestore, Storage, Functions e emuladores.

## 7. Arquitetura tecnica

### Front-end

- `src/App.jsx`: roteamento, protecao de rotas e carregamento de perfil.
- `src/components/Dashboard.jsx`: painel principal com metricas e pipeline.
- `src/ClientesPage.jsx`: listagem e cadastro de clientes.
- `src/components/ClienteDetail.jsx`: historico e resumo por cliente.
- `src/components/NovoOrcamento.jsx`: principal tela de criacao/edicao de orcamentos.
- `src/components/Login.jsx`: autenticacao, cadastro e recuperacao de senha.
- `src/components/AdminDashboard.jsx`: gestao administrativa de tenants.
- `src/components/BlockedPage.jsx`: bloqueio de acesso por status.

### Hooks e regras de negocio no front-end

- `src/useClientes.js`: busca, criacao e exclusao de clientes por usuario.
- `src/useOrcamentos.js`: busca, criacao, edicao e exclusao de orcamentos.
- `src/orcamentoUtils.js`: calculos de totais, ids e rascunhos.
- `src/materialCalculator.js`: calculadora tecnica de materiais.
- `src/catalogoOrcamento.js`: catalogo base, pacotes e overrides.
- `src/profileUtils.js`: criacao de perfil trial.

### Back-end e infraestrutura

- `firestore.rules`: regras de seguranca por usuario, admin e status ativo.
- `storage.rules`: regras para upload seguro de imagem por usuario.
- `functions/index.js`: funcoes administrativas e placeholder de IA.
- `api/comparar-precos.js`: API Vercel para comparacao de precos.
- `firebase.json`: configuracao de rules, functions e emuladores.
- `vite.config.js`: configuracao Vite, PWA e endpoint local de comparacao.

## 8. Modelo de dados

O projeto usa colecoes principais no Firestore:

- `profiles/{uid}`: perfil, role, status, plano e trial.
- `company_profiles/{uid}`: dados da empresa do prestador.
- `clientes/{docId}`: cadastro dos clientes do prestador.
- `orcamentos/{docId}`: orcamentos vinculados ao usuario e ao cliente.
- `catalog_overrides/{uid}`: precos personalizados por usuario.
- `usage/{uid}`: contadores de uso de funcionalidades.
- `public_orcamentos/{publicId}`: previsto nas regras para orcamentos publicos publicados.

## 9. Seguranca e privacidade

Pontos positivos:

- Autenticacao por Firebase Auth.
- Separacao de dados por `user_id`.
- Regras Firestore bloqueiam leitura e escrita entre usuarios comuns.
- Usuario bloqueado ou cancelado perde acesso a criacao/edicao de dados.
- Admin pode listar e gerenciar perfis.
- Storage restringe imagens a arquivos menores que 5 MB e content type de imagem.
- Cloud Functions administrativas exigem custom claim `admin`.

Pontos de atencao:

- A tela admin atual altera status diretamente pelo Firestore, enquanto as Cloud Functions ja oferecem fluxo administrativo mais robusto. Para producao, e melhor a tela admin chamar `setTenantStatus` e `setTenantPlan`.
- Nao ha ainda testes automatizados das Firestore Rules com emulator.
- Nao ha politicas de privacidade, termos de uso e consentimento LGPD no produto.
- A funcionalidade de logo no Storage esta prevista nas regras, mas a tela atual salva apenas dados textuais da empresa.

## 10. Validacao tecnica realizada

Comandos executados:

```bash
npm run build
npm run lint
```

Resultado:

- Build de producao passou.
- Lint passou sem erros.
- O build gerou apenas um aviso de performance: chunk principal maior que 500 kB. Isso nao bloqueia a entrega, mas indica oportunidade de code splitting.

Observacao:

- Os arquivos de teste foram removidos para deixar o repositorio mais enxuto para a entrega academica.

## 11. Pontos fortes para defender na faculdade

- Projeto resolve problema real de organizacao e formalizacao de orcamentos.
- Tem aplicabilidade social e economica para pequenos prestadores.
- Possui fluxo completo: cliente -> orcamento -> PDF -> WhatsApp -> acompanhamento.
- Usa tecnologias modernas e proximas do mercado.
- Tem autenticacao, regras de seguranca e estrutura multiusuario.
- Possui regras de calculo separadas em modulos reutilizaveis, o que facilita manutencao e futuras validacoes.
- Esta preparado para demonstracao por build de producao.
- Tem documentacao inicial de Firebase e readiness SaaS.

## 12. Limitacoes atuais

- Assistente de IA ainda e placeholder; ele retorna sugestoes fixas baseadas no prompt, sem integracao real com provedor de IA.
- Comparacao de precos depende de API externa e usa fallback estimado quando a busca falha.
- Nao ha testes automatizados versionados no repositorio final.
- Nao ha testes automatizados das regras do Firestore.
- Nao ha tela publica para cliente aprovar/recusar orcamento sem login.
- Nao ha integracao de pagamento/assinatura real.
- O PDF nao inclui logo da empresa, embora exista estrutura de Storage para logos.
- Scripts soltos de teste/desenvolvimento foram removidos para a versao final de entrega.

## 13. Recomendacoes antes da submissao

Prioridade alta:

1. Confirmar o modelo exigido pela faculdade e adaptar os textos de objetivo, metodologia, resultados e impacto.
2. Remover ou mover para uma pasta `scripts/` os arquivos soltos de teste manual.
3. Explicar no relatorio que a IA esta em modo demonstrativo/placeholder.
4. Incluir prints das principais telas: login, dashboard, clientes, novo orcamento, PDF e admin.
5. Gravar um video curto demonstrando o fluxo completo.

Prioridade media:

1. Adicionar testes de Firestore Rules com Firebase Emulator.
2. Trocar a tela admin para usar Cloud Functions em vez de update direto no Firestore.
3. Implementar upload de logo da empresa.
4. Criar pagina publica de aceite/recusa de orcamento.
5. Aplicar code splitting na tela de orcamento/PDF para reduzir o chunk principal.

Prioridade futura:

1. Integrar gateway de pagamento.
2. Conectar IA real via Secret Manager.
3. Criar exportacao CSV/PDF de dados.
4. Adicionar monitoramento de erros.
5. Formalizar termos de uso e politica de privacidade.

## 14. Possivel enquadramento como projeto de extensao

Tema sugerido:

**Digitalizacao de processos comerciais para prestadores de servico autonomos.**

Problema social/profissional:

Pequenos prestadores muitas vezes nao possuem ferramentas acessiveis para organizar clientes, calcular materiais, formalizar propostas e acompanhar oportunidades de venda.

Proposta de intervencao:

Disponibilizar e demonstrar uma aplicacao web que apoia o prestador na criacao de orcamentos padronizados, com calculo automatizado, registro de historico e compartilhamento rapido com clientes.

Publico beneficiado:

Profissionais autonomos, microempreendedores individuais, eletricistas, encanadores, pintores, instaladores e pequenos prestadores de manutencao residencial.

Resultados esperados:

- reducao do tempo de criacao de orcamentos;
- melhoria na organizacao de clientes e propostas;
- maior profissionalismo no atendimento;
- reducao de erros de calculo;
- aumento da capacidade de acompanhamento comercial.

Indicadores possiveis:

- quantidade de clientes cadastrados;
- quantidade de orcamentos gerados;
- tempo medio para montar uma proposta;
- percentual de orcamentos aprovados;
- feedback de prestadores que testaram a aplicacao.

## 15. Conclusao

O OrcaJa Web esta em um estado bom para ser apresentado como projeto academico e demonstravel. Ele possui uma proposta clara, problema bem definido, fluxo funcional, uso de tecnologias atuais, seguranca basica e documentacao inicial.

Para submissao como projeto de extensao, o principal ajuste nao e tecnico, mas narrativo: conectar o sistema ao impacto social/profissional, explicar o publico beneficiado, descrever a metodologia de aplicacao e deixar transparentes as limitacoes atuais, principalmente a IA placeholder e a ausencia de testes de regras Firebase.
