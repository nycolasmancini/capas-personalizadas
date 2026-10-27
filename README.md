# Estúdio de capas

Ferramenta interna para lojistas montarem capas transparentes anti-impacto personalizadas, mostrarem a prévia ao cliente e enviarem o pedido para produção, já com o arquivo de impressão UV pronto.

Produção: https://capas.unilaser.com.br (o endereço https://capas-personalizadas.vercel.app continua funcionando)

## Fluxo

1. **Lojista** entra com Google (ou, nas lojas de rede como a Beep, com usuário e senha), toca em *Nova capa*, escolhe o celular e monta a arte.
2. *Concluir* gera a prévia (JPG 1080×1350) e os arquivos de produção. O pedido fica em **Aguardando cliente**.
3. Lojista mostra ao cliente (imagem + link público `/p/CÓDIGO`). Se a loja tem WhatsApp cadastrado, a página pública traz os botões *Aprovar* e *Pedir ajuste*, que abrem uma conversa com a loja já com o código do pedido. Pode editar quantas vezes precisar.
4. *Cliente aprovou* → aparece a **unidade de retirada** (a do vendedor da loja; sem vendedor, a loja escolhe entre SP e Limeira), o preço da unidade e o prazo.
   - Loja PIX: gera o **PIX do Mercado Pago** (QR + copia e cola). Pagou → **Recebido**.
   - Loja/rede **faturada**: vai direto para **Recebido** e entra em *Painel → A faturar*.
5. Produção baixa o **PDF Mimaki** e avança: Recebido → Em produção → Pronto para retirar → Retirado. O prazo (dias úteis da unidade) conta a partir do pagamento.
6. Produção pode **editar a arte** em qualquer etapa (*Editar arte*). Cada ajuste vira uma versão (dá para voltar); opcionalmente pede nova aprovação ao cliente.

## Vendedores e redes

- *Painel → Vendedores*: cada vendedor tem um link `/v/slug`. Quem se cadastra por ele fica ligado ao vendedor. Lojas antigas são ligadas em *Lojas e acessos*. Com e-mail Google, o vendedor acompanha as lojas e pedidos em `/vendedor`.
- *Painel → Redes*: rede (ex.: Beep) com vendedor e forma de pagamento únicos. Cada loja ganha um login **usuário + senha** criado no Clerk (exige *Username* e *Password* ativados no dashboard do Clerk). O gestor da rede entra com Google e vê todas as lojas em `/rede`.
- *Painel → Unidades e preços*: endereço, prazo e preço de cada unidade, e o nome da cor especial do branco no PDF.

## Arquivos por pedido

| Arquivo | Conteúdo |
|---|---|
| PDF Mimaki (gerado na hora) | Página no tamanho real (mm), arte 300 dpi + camada de branco na cor especial (padrão `White`, com sobreimpressão). Sem recorte de câmera |
| `impressao-300dpi.png` | Arte em tamanho real, 300 dpi, fundo transparente, sem furos de câmera |
| `camada-branco.png` | Mesma dimensão. Preto = imprimir branco; transparente = cristal |
| `previa.jpg` | Imagem enviada ao cliente |

## Pagamento (Mercado Pago)

Variáveis: `MP_ACCESS_TOKEN` (credencial de produção `APP_USR-…`) e `MP_WEBHOOK_SECRET` (assinatura secreta do webhook `https://<domínio>/api/mercadopago/webhook`, evento *Pagamentos*). Sem o token, o pedido fica em *Aguardando pagamento* e a produção confirma com *Recebi o pagamento por fora*.

## Aparelhos

A geometria de cada modelo (em mm) fica no banco e é editável em *Painel → Aparelhos*. As medidas de largura/altura vêm das especificações oficiais; a posição dos módulos de câmera é aproximada. Antes de imprimir um modelo pela primeira vez: baixe o gabarito SVG, imprima em 100% e confira sobre uma capa física, ajuste se necessário e marque **Gabarito conferido**.

## Stack

- Next.js 16 (App Router) na Vercel
- Clerk (login Google) · Neon Postgres + Drizzle · Vercel Blob (fotos e arquivos)
- Editor em canvas com Konva (gestos de pinça, rotação, colagens com máscara)

## Desenvolvimento

```bash
vercel env pull .env.local   # variáveis de ambiente
npm install
npm run db:push              # aplica o esquema no banco
npm run db:v2                # unidades SP/Limeira e ajustes padrão (seguro repetir)
npm run db:seed              # aparelhos e artes iniciais (não sobrescreve ajustes)
npm run dev
```

Variáveis próprias: `ADMIN_EMAILS` (e-mails separados por vírgula que viram administradores no primeiro login). Marca exibida: `src/lib/brand.ts`.

A página inicial (`/`) monta a vitrine com três aparelhos que têm foto de mockup no banco e artes de `public/artes` (`src/components/CaseShowcase.tsx`); sem banco, cai no desenho vetorial.
