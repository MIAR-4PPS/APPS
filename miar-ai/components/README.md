# Componentes editáveis pela IA

Estes arquivos podem ser lidos e reescritos pela própria IA através das
ferramentas list_files / read_file / write_file (rota /api/agent/*).

Isto é a base real da "IA autoconstrutiva": a IA não edita o servidor
inteiro (isso seria perigoso), ela edita snippets de componente aqui
dentro. O servidor recarrega o componente na próxima renderização.

Comece com welcome-note.txt como exemplo.
