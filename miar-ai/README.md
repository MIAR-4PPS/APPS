# MIAR AI

Assistente de IA pessoal, autoconstrutiva: pode ler e reescrever seus
próprios componentes em `components/` através de ferramentas reais de
IA (list_files / read_file / write_file), sem simulação.

## Rodando no Codespaces

Este Codespace já está configurado (`.devcontainer/devcontainer.json`)
para instalar as dependências e subir o servidor automaticamente em
`http://localhost:4000` assim que o ambiente abre. Se precisar iniciar
manualmente:

```
cd miar-ai
npm install
npm start
```

## Providers de IA

As chaves configuradas como secrets do Codespaces são detectadas e
cadastradas automaticamente na primeira execução:

- `GROQ_API_KEY`
- `GEMINI_API_KEY`
- `MISTRAL_API_KEY`
- `OPENROUTER_API_KEY`

Também dá para adicionar, editar ou remover chaves direto pela tela
de Configurações (⚙️) do app — sem precisar mexer em secrets.

## Estrutura

- `server.js` — backend Express, persistência em `db.json` (arquivo
  local, nunca versionado), providers, histórias, memória infinita,
  upload de arquivos e as rotas de autoedição.
- `public/` — frontend (tema verde claro/escuro, histórias, chat,
  voz, câmera, botões arrastáveis).
- `components/` — sandbox onde a própria IA pode ler e escrever
  arquivos quando autorizada, via `/api/agent/*`.
- `uploads/` — anexos enviados pelo chat (local, não versionado).

## Acesso de celular e PC ao mesmo tempo

Com a porta 4000 encaminhada pelo Codespaces (pública ou privada com
seu login do GitHub), o mesmo backend e o mesmo `db.json` atendem
qualquer dispositivo que abrir a URL do Codespace — histórias,
mensagens e memória ficam sincronizadas porque é o mesmo servidor
para todos os acessos.
