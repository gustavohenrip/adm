# MEMORY

## Erros registrados

- 2026-04-24: Ao criar o repositório privado `gustavohenrip/adm`, usei `gh repo create ... --remote=origin` mesmo já existindo um remoto `origin` local. O repo foi criado, mas a etapa de adicionar remoto falhou. Correção aplicada: validei o repo e executei `git push -u origin main`. Próxima vez: verificar `git remote -v` e, se `origin` já existir, criar o repo sem tentar recriar o remoto ou apenas fazer push.
