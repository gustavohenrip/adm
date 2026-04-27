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
- 2026-04-27: Magnet pode chegar ao app por extensao e protocolo ao mesmo tempo. Deduplicar por hash/URL, nao por ID de preview.
- 2026-04-27: Ao pedir "substituir arquivo", confirmar no app e tambem enviar flag ao backend para apagar o destino. So perguntar sem mudar o backend vira resume parcial.
- 2026-04-27: Nao encadear comandos com `&&` em shell nesta repo; usar execucoes separadas para manter saida limpa e seguir o padrao pedido.
- 2026-04-27: Em downloads longos, `stop()` nao pode apenas setar flag; precisa interromper thread e fechar stream/conexao ativa para delete/pause nao ficarem travados.
- 2026-04-27: Se `package.json` ja foi alterado manualmente, nao rodar `npm version` para sincronizar lockfile; usar `npm install --package-lock-only`.
- 2026-04-27: Monitores periodicos nao podem salvar entidades carregadas antes de um delete; isso pode recriar download removido. Salvar progresso somente se o registro ainda existir sob o mesmo lock.
