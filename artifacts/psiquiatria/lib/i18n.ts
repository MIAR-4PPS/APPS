import { getLocales } from "expo-localization";

export type Lang = "pt" | "en" | "es";

export function detectLang(): Lang {
  try {
    const locales = getLocales();
    const code = (locales[0]?.languageCode ?? "pt").toLowerCase();
    if (code.startsWith("en")) return "en";
    if (code.startsWith("es")) return "es";
    return "pt";
  } catch {
    return "pt";
  }
}

export type Strings = {
  greeting: string;
  pencilHint: string;
  listenPresentation: string;
  speedLabel: string;
  helpHint: string;
  suggestions: { id: string; label: string; prompt: string }[];
  inputPlaceholder: string;
  miarThinking: string;
  micHoldHint: string;
  micRecording: string;
  micDenied: string;
  pencilOpen: string;
  pencilSend: string;
  pencilClose: string;
  pencilClear: string;
  pencilEraser: string;
  pencilDefaultText: string;
};

const PT: Strings = {
  greeting:
    "Olá, eu sou o MIAR APPS. Posso ajudar você a criar um aplicativo inteiro, fazer por partes, corrigir erros, melhorar o visual, adicionar ou remover funções, organizar ideias, transcrever áudio, analisar texto, imagem e vídeo, sugerir respostas e simplificar o uso de vários aplicativos em uma central inteligente. No futuro, poderei organizar notificações, mensagens, arquivos e tarefas de outros aplicativos, sempre com permissão do usuário. Diga o que você quer fazer e eu organizo o caminho.",
  pencilHint:
    "Está vendo esse lápis aqui? Escreve pra mim, marca pra mim, que eu vou fazer pra você.",
  listenPresentation: "Ouvir apresentação",
  speedLabel: "Velocidade da voz",
  helpHint: "Fale, escreva ou marque na tela — eu entendo dos três jeitos.",
  suggestions: [
    { id: "criar-app", label: "Criar app inteiro", prompt: "Quero criar um aplicativo inteiro. Me ajuda a começar." },
    { id: "por-partes", label: "Fazer por partes", prompt: "Quero construir por partes. Vamos começar pela primeira tela." },
    { id: "corrigir", label: "Corrigir erro", prompt: "Estou com um erro. Pode me ajudar a corrigir?" },
    { id: "visual", label: "Melhorar visual", prompt: "Quero melhorar o visual do app. O que você sugere?" },
    { id: "add-funcao", label: "Adicionar função", prompt: "Quero adicionar uma função nova." },
    { id: "rem-funcao", label: "Remover função", prompt: "Quero remover uma função que não estou usando." },
    { id: "transcrever", label: "Transcrever áudio", prompt: "Vou te mandar um áudio para transcrever." },
    { id: "imagem", label: "Analisar imagem", prompt: "Vou te mandar uma imagem para você analisar." },
    { id: "video", label: "Analisar vídeo", prompt: "Vou te mandar um vídeo para você analisar." },
    { id: "msgs", label: "Organizar mensagens", prompt: "Me ajuda a organizar minhas mensagens." },
    { id: "notif", label: "Organizar notificações", prompt: "Me ajuda a organizar minhas notificações." },
    { id: "tarefas", label: "Centralizar tarefas", prompt: "Quero centralizar minhas tarefas em um só lugar." },
    { id: "backup", label: "Fazer backup", prompt: "Me ajuda a fazer um backup dos meus dados." },
  ],
  inputPlaceholder: "Manda uma mensagem pra Miar...",
  miarThinking: "Miar tá pensando...",
  micHoldHint: "Segure para gravar, solta automático em 6s",
  micRecording: "Gravando rápido",
  micDenied:
    "Preciso da permissão do microfone. Vá em Configurações do telefone, encontre o MIAR APPS e libere o microfone.",
  pencilOpen: "Abrir modo lápis",
  pencilSend: "Enviar para Miar",
  pencilClose: "Fechar sem enviar",
  pencilClear: "Limpar tudo",
  pencilEraser: "Borracha",
  pencilDefaultText: "Marquei na tela o que quero mudar. Pode ajudar?",
};

const EN: Strings = {
  greeting:
    "Hi, I'm MIAR APPS. I can help you build a whole app, do it in parts, fix errors, improve the look, add or remove features, organize ideas, transcribe audio, analyze text, images and video, suggest replies and simplify using many apps in one smart hub. In the future I'll be able to organize notifications, messages, files and tasks from other apps, always with your permission. Tell me what you want to do and I'll map out the path.",
  pencilHint:
    "See this pencil? Write for me, mark on the screen for me, and I'll do it for you.",
  listenPresentation: "Listen to intro",
  speedLabel: "Voice speed",
  helpHint: "Speak, type or mark on the screen — I understand all three.",
  suggestions: [
    { id: "criar-app", label: "Build a whole app", prompt: "I want to build a whole app. Help me start." },
    { id: "por-partes", label: "Do it in parts", prompt: "Let's build in parts. Start with the first screen." },
    { id: "corrigir", label: "Fix an error", prompt: "I have an error. Can you help me fix it?" },
    { id: "visual", label: "Improve the look", prompt: "I want to improve the visuals. Any suggestions?" },
    { id: "add-funcao", label: "Add a feature", prompt: "I want to add a new feature." },
    { id: "rem-funcao", label: "Remove a feature", prompt: "I want to remove a feature I'm not using." },
    { id: "transcrever", label: "Transcribe audio", prompt: "I'll send an audio to transcribe." },
    { id: "imagem", label: "Analyze image", prompt: "I'll send an image to analyze." },
    { id: "video", label: "Analyze video", prompt: "I'll send a video to analyze." },
    { id: "msgs", label: "Organize messages", prompt: "Help me organize my messages." },
    { id: "notif", label: "Organize notifications", prompt: "Help me organize my notifications." },
    { id: "tarefas", label: "Centralize tasks", prompt: "I want to centralize my tasks in one place." },
    { id: "backup", label: "Make a backup", prompt: "Help me back up my data." },
  ],
  inputPlaceholder: "Send a message to Miar...",
  miarThinking: "Miar is thinking...",
  micHoldHint: "Hold to record, auto stop in 6s",
  micRecording: "Recording fast",
  micDenied:
    "I need microphone permission. Go to phone Settings, find MIAR APPS and enable the microphone.",
  pencilOpen: "Open pencil mode",
  pencilSend: "Send to Miar",
  pencilClose: "Close without sending",
  pencilClear: "Clear all",
  pencilEraser: "Eraser",
  pencilDefaultText: "I marked on the screen what I want to change. Can you help?",
};

const ES: Strings = {
  greeting:
    "Hola, soy MIAR APPS. Puedo ayudarte a crear una aplicación entera, hacerla por partes, corregir errores, mejorar el visual, agregar o quitar funciones, organizar ideas, transcribir audio, analizar texto, imagen y video, sugerir respuestas y simplificar el uso de varias apps en una central inteligente. En el futuro podré organizar notificaciones, mensajes, archivos y tareas de otras aplicaciones, siempre con tu permiso. Dime qué quieres hacer y yo organizo el camino.",
  pencilHint:
    "¿Ves este lápiz? Escribe para mí, marca para mí, que yo lo hago por ti.",
  listenPresentation: "Escuchar presentación",
  speedLabel: "Velocidad de la voz",
  helpHint: "Habla, escribe o marca en la pantalla — entiendo de las tres formas.",
  suggestions: [
    { id: "criar-app", label: "Crear app entera", prompt: "Quiero crear una aplicación entera. Ayúdame a empezar." },
    { id: "por-partes", label: "Hacer por partes", prompt: "Vamos a construir por partes. Empecemos por la primera pantalla." },
    { id: "corrigir", label: "Corregir error", prompt: "Tengo un error. ¿Puedes ayudarme a corregirlo?" },
    { id: "visual", label: "Mejorar visual", prompt: "Quiero mejorar el visual. ¿Qué sugieres?" },
    { id: "add-funcao", label: "Agregar función", prompt: "Quiero agregar una función nueva." },
    { id: "rem-funcao", label: "Quitar función", prompt: "Quiero quitar una función que no uso." },
    { id: "transcrever", label: "Transcribir audio", prompt: "Voy a enviarte un audio para transcribir." },
    { id: "imagem", label: "Analizar imagen", prompt: "Voy a enviarte una imagen para analizar." },
    { id: "video", label: "Analizar video", prompt: "Voy a enviarte un video para analizar." },
    { id: "msgs", label: "Organizar mensajes", prompt: "Ayúdame a organizar mis mensajes." },
    { id: "notif", label: "Organizar notificaciones", prompt: "Ayúdame a organizar mis notificaciones." },
    { id: "tarefas", label: "Centralizar tareas", prompt: "Quiero centralizar mis tareas en un solo lugar." },
    { id: "backup", label: "Hacer respaldo", prompt: "Ayúdame a hacer un respaldo de mis datos." },
  ],
  inputPlaceholder: "Envía un mensaje a Miar...",
  miarThinking: "Miar está pensando...",
  micHoldHint: "Mantén pulsado para grabar, se suelta solo en 6s",
  micRecording: "Grabando rápido",
  micDenied:
    "Necesito permiso del micrófono. Ve a Ajustes del teléfono, busca MIAR APPS y habilita el micrófono.",
  pencilOpen: "Abrir modo lápiz",
  pencilSend: "Enviar a Miar",
  pencilClose: "Cerrar sin enviar",
  pencilClear: "Limpiar todo",
  pencilEraser: "Goma",
  pencilDefaultText: "Marqué en la pantalla lo que quiero cambiar. ¿Puedes ayudar?",
};

export function getStrings(lang?: Lang): Strings {
  const l = lang ?? detectLang();
  if (l === "en") return EN;
  if (l === "es") return ES;
  return PT;
}

export function speechLanguage(lang?: Lang): string {
  const l = lang ?? detectLang();
  if (l === "en") return "en-US";
  if (l === "es") return "es-ES";
  return "pt-BR";
}
