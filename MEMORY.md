# MEMORY

- 2026-04-27: Native Messaging so deve ser usado com ID fixo e `allowed_origins` exato. Nao usar wildcard em manifest nativo do Chrome.
- 2026-04-27: Nao assumir `webRequestBlocking` em extensao Chrome Manifest V3 normal. Para Chrome unpacked comum, priorizar captura antes do clique e manter o download API apenas como fallback.
- 2026-04-27: Nao colocar cap visual fixo de velocidade se o sistema esta sem limite real. Se houver limitador, ele precisa vir de configuracao do usuario.
- 2026-04-27: Nao deixar classe de download segmentado criada mas fora do fluxo principal. Otimizacao real precisa estar ligada no servico que inicia o download.
- 2026-04-27: Nao criar download automaticamente quando o fluxo esperado e igual IDM. Primeiro abrir confirmacao no app, mostrar dados principais e pasta, depois iniciar so com confirmacao do usuario.
- 2026-04-27: Magnet precisa ser tratado como URL valida em clipboard, extensao e protocolo do app. Nao limitar deteccao apenas a http/https.
- 2026-04-27: Quando o usuario pedir scripts de build em uma pasta especifica, colocar os lancadores exatamente nessa pasta e validar plataforma antes de empacotar.
- 2026-04-27: Em zsh, `status` e variavel reservada. Usar nomes como `cmd_status` ao validar comandos no shell.
- 2026-04-27: Antes de depender do CI, validar `npm ci --dry-run` nos pacotes alterados. Atualizar versao sozinho nao garante lockfile sincronizado.
