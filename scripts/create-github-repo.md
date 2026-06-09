# Criar repositório no GitHub

Opção 1 - GitHub CLI:
```bash
gh auth login
gh repo create hello --public --source=. --remote=origin --push
```

Opção 2 - Manual:
1. Crie um repositório chamado `hello` no GitHub.
2. Rode:
```bash
git remote add origin https://github.com/SEU_USUARIO/hello.git
git branch -M main
git push -u origin main
```
