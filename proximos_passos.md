# Próximos passos — Estúdio de capas

Situação em 20/10/2026: o app está publicado em https://capas-personalizadas.vercel.app com editor, área do lojista, painel da produção, login Google (Clerk), banco (Neon) e armazenamento de arquivos (Vercel Blob). O editor e a geração do arquivo de impressão foram testados localmente; o fluxo completo com login real ainda precisa ser validado por vocês.

Legenda de responsável: **[Vocês]** = equipe/empresa · **[Dev]** = desenvolvimento

---

## Fase 1 — Validar o que já existe (antes de chamar qualquer lojista)

- [ ] **[Vocês]** Entrar com `pmcell.conecta@gmail.com` e confirmar que abre o Painel.
- [ ] **[Vocês]** Fazer um pedido completo como teste: *Abrir editor → Nova capa → montar → Concluir → Mostrar ao cliente → Enviar para produção* e ver o aviso chegar no Painel.
- [ ] **[Vocês]** Testar em celulares reais: um iPhone (Safari) e um Android (Chrome). Incluir fotos tiradas na hora, fotos HEIC do iPhone e fotos do WhatsApp.
- [ ] **[Vocês]** Abrir o link público `/p/CÓDIGO` num celular que não está logado.
- [ ] **[Dev]** Corrigir o que aparecer nesses testes.

## Fase 2 — Garantir que a impressão sai certa (crítico)

- [ ] **[Vocês]** Listar os 10–15 modelos mais vendidos. Estes são conferidos primeiro.
- [ ] **[Vocês]** Para cada um deles: *Painel → Aparelhos → modelo → Baixar gabarito SVG*, imprimir em 100% (sem "ajustar à página"), sobrepor numa capa física e anotar as diferenças na posição/tamanho da câmera.
- [ ] **[Vocês]** Ajustar os números no próprio painel e marcar **Gabarito conferido**.
- [ ] **[Vocês]** Imprimir uma capa de teste na impressora UV com os 3 arquivos gerados (impressão, camada de branco, linha de corte) e verificar:
  - tamanho real bate com a capa;
  - a camada de branco é aceita pelo software da impressora (RIP) no formato atual;
  - cores ficam aceitáveis (comparar com a prévia).
- [ ] **[Dev]** Adaptar o formato dos arquivos ao RIP de vocês se necessário (ex.: branco como canal spot, PDF em vez de PNG, sangria/margem, espelhamento, perfil de cor).
- [ ] **[Vocês]** Informar o modelo da impressora e do software de impressão.
- [ ] **[Dev]** *(Recomendado)* **Mesa de impressão**: juntar vários pedidos aprovados num único arquivo, já posicionados no gabarito/berço da impressora (quantas capas cabem por vez). Precisa das medidas do berço.

## Fase 3 — Mockups com cara de foto

**3a. Melhorias no mockup vetorial atual (rápido, vale para todos os modelos)**
- [ ] **[Dev]** Lentes e câmeras desenhadas por modelo (incluindo logo e acabamento).
- [ ] **[Dev]** Paredes laterais da capa visíveis, quinas anti-impacto com volume, degrau em volta da câmera.
- [ ] **[Dev]** Sombra e reflexos mais suaves, que reagem à arte.
- [ ] **[Dev]** Opção de prévia em ângulo 3/4.

**3b. Mockups fotográficos (100% realistas, nos modelos que mais vendem)**
- [ ] **[Vocês]** Sessão de fotos por modelo, com tripé fixo, mesma luz e fundo liso, mínimo de 2000 px de altura:
  1. celular com a capa transparente;
  2. a mesma foto, só a borda e a câmera recortadas, com o miolo transparente (PNG);
  3. o mesmo celular com uma capa impressa toda de branco (gera o mapa de luz e sombra).
  Referência de estrutura: as camadas da Case4you enviadas antes, só como modelo de enquadramento.
- [ ] **[Dev]** Tela no painel para subir as fotos e marcar os 4 cantos + câmera (encaixe da arte na foto).
- [ ] **[Dev]** Motor de composição: arte encaixada na foto × mapa de sombra + reflexos por cima.
- [ ] **[Dev]** O editor usa a foto quando o modelo tiver; senão, cai no vetor.

## Fase 4 — Conteúdo

- [ ] **[Vocês]** Designer subir as artes prontas em *Painel → Artes prontas* (categorias começando com "Fundo" preenchem a capa; as demais viram enfeites).
  Sugestões de categorias: Fundos florais, Fundos abstratos, Nomes e iniciais, Signos, Times, Religião, Pets, Datas comemorativas.
- [ ] **[Dev]** *(Opcional)* Usar o Canva para gerar um lote inicial de artes, revisado pelo designer.
- [ ] **[Dev]** *(Opcional)* **Modelos prontos completos** (arte + espaço de foto + texto editável), ex.: "Nome com flores", "Polaroid com data". O lojista só troca a foto e o nome.
- [ ] **[Vocês]** Ampliar o catálogo de aparelhos conforme os pedidos (*Painel → Aparelhos → Novo modelo*).

## Fase 5 — Colocar em produção de verdade

- [ ] **[Vocês]** Definir o nome/marca definitiva da empresa de design (hoje: "unilaser.", em `src/lib/brand.ts`).
- [ ] **[Vocês]** Escolher um domínio (ex.: `capas.suaempresa.com.br`) e dar acesso ao DNS.
- [ ] **[Dev]** Configurar o domínio na Vercel.
- [ ] **[Dev]** Passar a Clerk para o modo produção (exige o domínio próprio) e criar credenciais Google próprias, para a tela de login mostrar o nome da empresa.
- [ ] **[Dev]** Desligar o login por e-mail/código na Clerk, deixando só "Continuar com Google".
- [ ] **[Dev]** Ícones PNG para "Adicionar à tela inicial" no iPhone (`apple-touch-icon`).
- [ ] **[Dev]** Colocar o código num repositório GitHub ligado à Vercel (deploy automático a cada alteração + versões de teste antes de ir ao ar).

## Fase 6 — Operação e segurança

- [ ] **[Dev]** Limpeza automática de fotos órfãs (enviadas para capas que nunca viraram pedido) com tarefa agendada (cron).
- [ ] **[Vocês + Dev]** **LGPD**: definir por quanto tempo guardar as fotos dos clientes finais (sugestão: 90 dias após "Enviado") e apagar automaticamente depois. Incluir aviso curto no link público.
- [ ] **[Dev]** Monitoramento de erros (avisar quando algo falhar no editor ou no envio).
- [ ] **[Dev]** Backup periódico do banco (Neon tem histórico; confirmar o plano/retensão).
- [ ] **[Dev]** Limites de uso por loja (evitar uploads abusivos) e registro de quem alterou cada status.

## Fase 7 — Melhorias para o dia a dia (depois do lançamento)

- [ ] **[Dev]** Campo "empresa do grupo" em cada loja, para relatórios por empresa.
- [ ] **[Dev]** Busca e filtros no painel (por loja, código, cliente, data, modelo).
- [ ] **[Dev]** Relatórios: pedidos por loja/semana, modelos mais pedidos, tempo médio de produção.
- [ ] **[Dev]** Imprimir etiqueta/ficha do pedido (código, loja, modelo, QR para o pedido).
- [ ] **[Dev]** Histórico de versões da arte (o que o cliente viu vs. o que foi produzido).
- [ ] **[Dev]** Remover fundo de foto com IA (recortar pessoa/pet).
- [ ] **[Dev]** Novos tipos de capa (sem anti-impacto, MagSafe, borda colorida) quando forem produzidos.
- [ ] **[Dev]** Avisos ao lojista quando o status muda (notificação no navegador/app instalado).

---

## O que preciso de vocês para avançar

1. Resultado dos testes da Fase 1 (prints ou descrição do que estranharam).
2. Lista dos 10–15 modelos mais vendidos.
3. Modelo da impressora UV e do software de impressão + medidas do berço/gabarito.
4. Nome definitivo da marca e o domínio.
5. Fotos do primeiro modelo (Fase 3b), quando o designer tiver.
