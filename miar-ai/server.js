// MIAR AI — servidor real. Tudo aqui grava em disco de verdade (db.json).
// Nada de resposta simulada: sem provider configurado, o endpoint de chat
// devolve erro explícito, nunca texto inventado.

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const DB_PATH = path.join(__dirname, 'db.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const COMPONENTS_DIR = path.join(__dirname, 'components');
const PORT = process.env.PORT || 4000;

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(COMPONENTS_DIR)) fs.mkdirSync(COMPONENTS_DIR, { recursive: true });

// Se existirem variáveis de ambiente (ex.: secrets do Codespaces) para os
// providers e ainda não houver um provider salvo com essa chave, cria
// automaticamente — real, não simulado, lido direto do ambiente.
const ENV_PROVIDER_MAP = [
  { name: 'groq', env: 'GROQ_API_KEY' },
  { name: 'gemini', env: 'GEMINI_API_KEY' },
  { name: 'mistral', env: 'MISTRAL_API_KEY' },
  { name: 'openrouter', env: 'OPENROUTER_API_KEY' },
];

// Um secret do Codespaces pode conter várias chaves juntas (uma por linha,
// ou separadas por vírgula/espaço) — cada uma vira um provider independente.
function splitKeys(raw) {
  return raw
    .split(/[\s,;]+/)
    .map(k => k.trim())
    .filter(k => k.length >= 10);
}

function seedProvidersFromEnv(db) {
  let changed = false;

  // Limpa qualquer provider salvo anteriormente com chave inválida (mais de
  // um valor colado junto, com espaço/quebra de linha dentro) — resquício
  // de uma versão anterior que não separava as chaves do secret.
  const before = db.providers.length;
  db.providers = db.providers.filter(p => !p.apiKey || !/\s/.test(p.apiKey));
  if (db.providers.length !== before) changed = true;

  for (const { name, env } of ENV_PROVIDER_MAP) {
    const raw = process.env[env];
    if (!raw) continue;
    const keys = splitKeys(raw);
    keys.forEach((key, idx) => {
      const already = db.providers.find(p => p.name === name && p.apiKey === key);
      if (already) return;
      db.providers.push({
        id: crypto.randomUUID(),
        name,
        label: keys.length > 1 ? `${name} #${idx + 1} (secrets)` : `${name} (secrets)`,
        apiKey: key,
        model: '',
        enabled: idx === 0 && !db.providers.some(p => p.name === name && p.enabled),
        createdAt: Date.now(),
      });
      changed = true;
    });
  }
  return changed;
}

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      settings: { theme: 'light' },
      providers: [], // { id, name(groq|gemini|mistral|openrouter), label, apiKey, model, enabled, createdAt }
      stories: [],
      conversations: [],
      messages: [],
      memory: [], // { id, fact, createdAt }
      buttonPositions: {},
    };
    seedProvidersFromEnv(initial);
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  if (seedProvidersFromEnv(db)) fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
  return db;
}
function saveDB(db) { fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2)); }

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

const upload = multer({ storage: multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}-${file.originalname}`),
}) }); // sem limits: aceita qualquer tipo/tamanho, como pedido

// ============ PROVIDERS (múltiplas APIs configuráveis) ============
app.get('/api/providers', (req, res) => {
  const db = loadDB();
  // nunca devolve a chave inteira pro front, só os últimos 4 caracteres
  res.json(db.providers.map(p => ({ ...p, apiKey: undefined, apiKeyMasked: p.apiKey ? `••••${p.apiKey.slice(-4)}` : '' })));
});

app.post('/api/providers', (req, res) => {
  const { name, label, apiKey, model } = req.body;
  const VALID = ['groq', 'gemini', 'mistral', 'openrouter'];
  if (!VALID.includes(name)) return res.status(400).json({ error: `Provider inválido. Use um de: ${VALID.join(', ')}` });
  if (!apiKey) return res.status(400).json({ error: 'apiKey é obrigatória' });
  const db = loadDB();
  const provider = { id: crypto.randomUUID(), name, label: label || name, apiKey, model: model || '', enabled: true, createdAt: Date.now() };
  db.providers.push(provider);
  saveDB(db);
  res.status(201).json({ ...provider, apiKey: undefined });
});

app.put('/api/providers/:id', (req, res) => {
  const db = loadDB();
  const p = db.providers.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Provider não encontrado' });
  const { label, apiKey, model, enabled } = req.body;
  if (label !== undefined) p.label = label;
  if (apiKey !== undefined && apiKey) p.apiKey = apiKey; // "olho mágico": só troca se mandar valor novo
  if (model !== undefined) p.model = model;
  if (enabled !== undefined) p.enabled = enabled;
  saveDB(db);
  res.json({ ...p, apiKey: undefined });
});

app.delete('/api/providers/:id', (req, res) => {
  const db = loadDB();
  db.providers = db.providers.filter(p => p.id !== req.params.id);
  saveDB(db);
  res.status(204).end();
});

// ============ HISTÓRIAS (no lugar de "Projetos") ============
app.get('/api/stories', (req, res) => {
  const db = loadDB();
  res.json(db.stories);
});

app.post('/api/stories', (req, res) => {
  const db = loadDB();
  const { name, description, color } = req.body;
  const story = {
    id: crypto.randomUUID(),
    name: (name && name.trim()) || `História ${db.stories.length + 1}`,
    description: description || '',
    color: color || '#2e7d32',
    createdAt: Date.now(),
  };
  db.stories.push(story);
  saveDB(db);
  res.status(201).json(story);
});

app.put('/api/stories/:id', (req, res) => {
  const db = loadDB();
  const s = db.stories.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'História não encontrada' });
  const { name, description, color } = req.body;
  if (name !== undefined) s.name = name;
  if (description !== undefined) s.description = description;
  if (color !== undefined) s.color = color;
  saveDB(db);
  res.json(s);
});

app.delete('/api/stories/:id', (req, res) => {
  const db = loadDB();
  db.stories = db.stories.filter(s => s.id !== req.params.id);
  const convIds = db.conversations.filter(c => c.storyId === req.params.id).map(c => c.id);
  db.conversations = db.conversations.filter(c => c.storyId !== req.params.id);
  db.messages = db.messages.filter(m => !convIds.includes(m.conversationId));
  saveDB(db);
  res.status(204).end();
});

// texto concatenado de TODAS as conversas de uma história (usado quando o
// usuário pede pra IA ler tudo daquele núcleo antes de responder)
app.get('/api/stories/:id/full-context', (req, res) => {
  const db = loadDB();
  const convIds = db.conversations.filter(c => c.storyId === req.params.id).map(c => c.id);
  const msgs = db.messages.filter(m => convIds.includes(m.conversationId));
  const text = msgs.map(m => `[${m.role}] ${m.content}`).join('\n');
  res.json({ charCount: text.length, text });
});

// ============ CONVERSAS ============
app.get('/api/stories/:id/conversations', (req, res) => {
  const db = loadDB();
  res.json(db.conversations.filter(c => c.storyId === req.params.id));
});

app.post('/api/stories/:id/conversations', (req, res) => {
  const db = loadDB();
  const conv = { id: crypto.randomUUID(), storyId: req.params.id, title: req.body.title || 'Nova conversa', createdAt: Date.now() };
  db.conversations.push(conv);
  saveDB(db);
  res.status(201).json(conv);
});

app.delete('/api/conversations/:id', (req, res) => {
  const db = loadDB();
  db.conversations = db.conversations.filter(c => c.id !== req.params.id);
  db.messages = db.messages.filter(m => m.conversationId !== req.params.id);
  saveDB(db);
  res.status(204).end();
});

app.get('/api/conversations/:id/messages', (req, res) => {
  const db = loadDB();
  res.json(db.messages.filter(m => m.conversationId === req.params.id));
});

// ============ MEMÓRIA INFINITA (com aviso de sobrecarga real) ============
const MEMORY_WARN_THRESHOLD = 400; // fatos — acima disso, avisamos de verdade

app.get('/api/memory', (req, res) => {
  const db = loadDB();
  res.json({ facts: db.memory, overloaded: db.memory.length > MEMORY_WARN_THRESHOLD });
});

app.post('/api/memory', (req, res) => {
  const { fact } = req.body;
  if (!fact || !fact.trim()) return res.status(400).json({ error: 'fact vazio' });
  const db = loadDB();
  const item = { id: crypto.randomUUID(), fact: fact.trim(), createdAt: Date.now() };
  db.memory.push(item);
  saveDB(db);
  res.status(201).json({ item, overloaded: db.memory.length > MEMORY_WARN_THRESHOLD, total: db.memory.length });
});

app.delete('/api/memory/:id', (req, res) => {
  const db = loadDB();
  db.memory = db.memory.filter(m => m.id !== req.params.id);
  saveDB(db);
  res.status(204).end();
});

app.delete('/api/memory', (req, res) => {
  const db = loadDB();
  db.memory = [];
  saveDB(db);
  res.status(204).end();
});

// ============ POSIÇÕES DOS BOTÕES ARRASTÁVEIS ============
app.get('/api/button-positions', (req, res) => {
  const db = loadDB();
  res.json(db.buttonPositions || {});
});
app.put('/api/button-positions', (req, res) => {
  const db = loadDB();
  db.buttonPositions = { ...(db.buttonPositions || {}), ...req.body };
  saveDB(db);
  res.json(db.buttonPositions);
});

// ============ UPLOAD (sem limite de tamanho ou tipo) ============
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo recebido' });
  res.status(201).json({
    filename: req.file.originalname,
    url: `/uploads/${req.file.filename}`,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
});

// ============ FERRAMENTAS DE AUTOEDIÇÃO (real, sandboxed em /components) ============
function safeComponentPath(name) {
  const resolved = path.resolve(COMPONENTS_DIR, name);
  if (!resolved.startsWith(COMPONENTS_DIR)) throw new Error('Caminho fora da área permitida (components/)');
  return resolved;
}

app.get('/api/agent/list-files', (req, res) => {
  const files = fs.readdirSync(COMPONENTS_DIR);
  res.json(files);
});

app.get('/api/agent/read-file', (req, res) => {
  try {
    const p = safeComponentPath(req.query.name);
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'Arquivo não existe' });
    res.json({ name: req.query.name, content: fs.readFileSync(p, 'utf-8') });
  } catch (e) { res.status(400).json({ error: String(e.message) }); }
});

app.post('/api/agent/write-file', (req, res) => {
  try {
    const { name, content } = req.body;
    const p = safeComponentPath(name);
    fs.writeFileSync(p, content ?? '');
    res.json({ ok: true, name });
  } catch (e) { res.status(400).json({ error: String(e.message) }); }
});

// ============ CHAT — chamada real ao provider ativo, com tool-calling p/ autoedição ============
const TOOLS = [
  { type: 'function', function: { name: 'list_files', description: 'Lista os arquivos editáveis do próprio app (pasta components/)', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'read_file', description: 'Lê o conteúdo de um arquivo editável do app', parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'write_file', description: 'Sobrescreve um arquivo editável do app com novo conteúdo', parameters: { type: 'object', properties: { name: { type: 'string' }, content: { type: 'string' } }, required: ['name', 'content'] } } },
];

function runTool(name, args) {
  if (name === 'list_files') return fs.readdirSync(COMPONENTS_DIR);
  if (name === 'read_file') {
    const p = safeComponentPath(args.name);
    return fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : { error: 'não existe' };
  }
  if (name === 'write_file') {
    const p = safeComponentPath(args.name);
    fs.writeFileSync(p, args.content ?? '');
    return { ok: true };
  }
  return { error: 'ferramenta desconhecida' };
}

async function callGroq(apiKey, model, messages, useTools) {
  const body = { model: model || 'llama-3.3-70b-versatile', messages };
  if (useTools) { body.tools = TOOLS; body.tool_choice = 'auto'; }
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Groq: ${await r.text()}`);
  return r.json();
}

async function callOpenRouter(apiKey, model, messages) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model || 'meta-llama/llama-3.3-70b-instruct:free', messages }),
  });
  if (!r.ok) throw new Error(`OpenRouter: ${await r.text()}`);
  return r.json();
}

async function callMistral(apiKey, model, messages) {
  const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: model || 'mistral-small-latest', messages }),
  });
  if (!r.ok) throw new Error(`Mistral: ${await r.text()}`);
  return r.json();
}

async function callGemini(apiKey, model, messages) {
  const contents = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const sys = messages.find(m => m.role === 'system');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${apiKey}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, systemInstruction: sys ? { parts: [{ text: sys.content }] } : undefined }),
  });
  if (!r.ok) throw new Error(`Gemini: ${await r.text()}`);
  const data = await r.json();
  return { choices: [{ message: { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '' } }] };
}

app.post('/api/chat', async (req, res) => {
  const { conversationId, storyId, message, providerId, useFullStoryContext, allowSelfEdit } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'Mensagem vazia' });

  const db = loadDB();
  const userMsg = { id: crypto.randomUUID(), conversationId, role: 'user', content: message, createdAt: Date.now() };
  db.messages.push(userMsg);
  saveDB(db);

  const provider = providerId ? db.providers.find(p => p.id === providerId && p.enabled) : db.providers.find(p => p.enabled);
  if (!provider) {
    return res.status(503).json({ error: 'SEM_PROVIDER', message: 'Nenhum provider de IA configurado/ativado ainda. Vá em Configurações e adicione uma chave (Groq, Gemini, Mistral ou OpenRouter). A mensagem foi salva.' });
  }

  const story = db.stories.find(s => s.id === storyId);
  let systemPrompt = `Você é a MIAR AI, assistente pessoal do Robson. Contexto: história "${story?.name || 'sem história'}".`;
  if (db.memory.length) systemPrompt += `\n\nFatos que você deve lembrar sobre o usuário:\n${db.memory.map(m => `- ${m.fact}`).join('\n')}`;
  if (useFullStoryContext && story) {
    const convIds = db.conversations.filter(c => c.storyId === story.id).map(c => c.id);
    const allText = db.messages.filter(m => convIds.includes(m.conversationId)).map(m => `[${m.role}] ${m.content}`).join('\n');
    systemPrompt += `\n\nHistórico completo desta história (leia tudo antes de responder):\n${allText.slice(-20000)}`;
  }
  if (allowSelfEdit) systemPrompt += `\n\nVocê tem ferramentas para listar, ler e reescrever arquivos de componente do próprio app (pasta components/). Use quando o usuário pedir para mudar algo do próprio app.`;

  const history = db.messages.filter(m => m.conversationId === conversationId).slice(-40).map(m => ({ role: m.role, content: m.content }));
  const messages = [{ role: 'system', content: systemPrompt }, ...history];

  try {
    let reply;
    if (provider.name === 'groq') {
      let data = await callGroq(provider.apiKey, provider.model, messages, !!allowSelfEdit);
      let choice = data.choices[0];
      let loopGuard = 0;
      while (choice.message.tool_calls && loopGuard < 5) {
        messages.push(choice.message);
        for (const tc of choice.message.tool_calls) {
          const args = JSON.parse(tc.function.arguments || '{}');
          const result = runTool(tc.function.name, args);
          messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        data = await callGroq(provider.apiKey, provider.model, messages, true);
        choice = data.choices[0];
        loopGuard++;
      }
      reply = choice.message.content || '(a IA executou uma ação nos arquivos e não retornou texto)';
    } else if (provider.name === 'gemini') {
      const data = await callGemini(provider.apiKey, provider.model, messages);
      reply = data.choices[0].message.content;
    } else if (provider.name === 'mistral') {
      const data = await callMistral(provider.apiKey, provider.model, messages);
      reply = data.choices[0].message.content;
    } else if (provider.name === 'openrouter') {
      const data = await callOpenRouter(provider.apiKey, provider.model, messages);
      reply = data.choices[0].message.content;
    } else {
      return res.status(400).json({ error: 'PROVIDER_DESCONHECIDO' });
    }

    const aiMsg = { id: crypto.randomUUID(), conversationId, role: 'assistant', content: reply, createdAt: Date.now(), provider: provider.name };
    const db2 = loadDB();
    db2.messages.push(aiMsg);
    saveDB(db2);
    res.json({ reply, messageId: aiMsg.id, provider: provider.name });
  } catch (err) {
    res.status(502).json({ error: 'FALHA_PROVIDER', message: String(err.message || err) });
  }
});

app.get('/api/health', (req, res) => {
  const db = loadDB();
  res.json({ ok: true, providersConfigured: db.providers.length, providersEnabled: db.providers.filter(p => p.enabled).length, time: Date.now() });
});

app.listen(PORT, () => {
  console.log(`MIAR AI rodando em http://localhost:${PORT}`);
});
