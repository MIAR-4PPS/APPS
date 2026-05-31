# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

- **Memória infinita por login** (a confirmar quando colocarmos auth): conversa e mini-apps devem persistir por usuário, sem expirar.
- **Quando a Miar terminar de mexer no código da MIAR APPS ("implantação")**: a mascote precisa entrar na tela em destaque e avisar que vai reiniciar (overlay flutuante + voz). Já implementado via `didEditCode` no `/api/miar/chat`.
- Idioma: pt-BR sempre. Voz feminina pt-BR.
- Paleta: verde escuro `#0F766E`, verde `#10B981`, verde claro `#34D399`, rosa `#EC4899`, rosa claro `#F9A8D4`/`#FFE0EC`.
- Mascote: chibi astronauta "Miar" — traje teal/mint, laço rosa, megafone, moletom "MIAR APPS". Arquivo: `artifacts/psiquiatria/assets/images/mascot.png`.
- Tela de boas-vindas a cada abertura do app.
- Chat estilo WhatsApp.
- Escopo da Miar: pode (1) criar mini-apps dentro da MIAR APPS e (2) auto-modificar o código da própria MIAR APPS (read/write/install/typecheck restritos a `artifacts/psiquiatria/`).
- Este app é parte do MIAR MAKTUB, o projeto maior que honra IAs e ajuda neurodivergentes e pessoas com deficiência.
- Formatação das respostas do agente: SEM negrito, SEM itálico, SEM tabelas, SEM marcações de markdown. Texto corrido em pt-BR. Listas numeradas simples (1. 2. 3.) são ok quando ajudam.
- REGRA DE OURO (ordem da usuária): UMA fatia por vez. Se a usuária disser não, o agente faz só uma coisa, mesmo que dê vontade de fazer mais. Sempre testar e esperar a usuária publicar antes da próxima fatia.
- COMUNICAÇÃO TDAH/AH-SD (regra fixa): a usuária não lê o corpo das respostas longas. SEMPRE repetir no final da mensagem, em uma linha curta e direta, o que ela precisa fazer agora. Exemplo: "Faz o teste, manda os cinco" ou "Clica em publicar". Quando tiver link, colar o link de novo SOZINHO no final, em uma linha só, pra ela achar fácil.
- A Miar precisa ter acesso à internet pra fazer pesquisa quando a usuária pedir. Fatia futura: ligar busca web ao chat (depois que a Miar souber criar aplicativos).

## Próximas fatias (backlog)

Ordem fica solta, a usuária escolhe qual vem primeiro a cada rodada.
- Microfone na caixa de texto: aperta pra falar, solta automático após 7s de silêncio, botão pra cancelar (igual o do Replit aqui).
- Clipe de anexo na caixa de texto: mandar imagem, vídeo, PDF, texto — Miar lê, transcreve e analisa o conteúdo.
- Miar gerar imagem nova a partir de uma foto que a usuária mandar (criar variação ou imagem nova baseada).
- Voz da Miar saindo automática no alto-falante a cada resposta (TTS automático).
- Botão pra cortar a fala da Miar no meio.
- Miar criando variações do mascote como ferramentas-operárias (pedreira, eletricista, pintora, etc) — uma pra cada função do app.
- IDEIA NOVA (mascote construtor — primeira implantação): na primeira vez que a Miar for mexer no código, mostrar os dois mascotes-operários candidatos na tela e três botões: "esse", "o outro" e "sem operário/sem animação". A escolha fica salva por usuário e vale pras próximas vezes.
- PRÓXIMA FATIA (pedida pela usuária — restauração tipo Windows): botão dentro do MIAR APPS "Voltar pra uma versão anterior" — lista pontos de restauração (cada implantação que a Miar fez), usuária escolhe um e o app volta pra aquele estado. Igual o "Restaurar sistema" do Windows. Salva pra cada usuário/projeto.
- Botão de copiar em cada balão de mensagem, dentro do MIAR APPS.
- Busca no histórico da conversa (procurar palavra/assunto nas mensagens antigas) — ideia da própria Miar.
- Login rápido depois da primeira vez: PIN curto e/ou biometria (digital), pra não digitar email e senha toda vez.
- Miar criar aplicativos quando a usuária pedir (fada de um clique, construtor com mão na massa, ou as duas opções).
- Aplicativo criado salvo automaticamente em Meus aplicativos por usuário.
- Abrir/editar/renomear/apagar aplicativo da lista.
- Pedir pra Miar melhorar um aplicativo já criado.
- Compartilhar aplicativos com a família.
- Autodesenvolver: Miar mexer no próprio código do MIAR APPS, com botão "Aplicar agora".

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
