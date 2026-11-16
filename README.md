# Airmed — versão de teste

Web app de teste do Airmed: remédios e rotinas com lembrete, num lugar só. Um projeto Alt Design Creative.

- **Base:** Vue 3 + Vite.
- **Publicação:** a cada envio para a `main`, o GitHub testa, compila e publica no GitHub Pages (`.github/workflows/publicar.yml`). Precisa estar ligado em Settings → Pages → Source: **GitHub Actions**.
- **Dados:** só no navegador do aparelho (`localStorage`, chave `airmed-teste:v1`). Nada vai para servidor.
- **Nomes de remédio no código e nos testes são inventados.** Nunca colocar nome, dose ou horário real aqui.

## Rodar

```sh
npm ci
npm test          # motor de lembrete
npm run dev       # desenvolvimento
npm run build     # compila para dist/
```

## Como está organizado

| Pasta | O que tem |
|---|---|
| `src/nucleo/motor.js` | Motor de lembrete compartilhado (repetição, situação, semana, estoque, SOS) |
| `src/nucleo/dados.js` | Guarda os dados no aparelho; marcar, desfazer, adiar |
| `src/nucleo/avisos.js` | Relógio, notificação discreta e abertura do alarme |
| `src/nucleo/acesso.js` | Acesso no aparelho, na lógica do Dagda Capital: apelido, senha ou PIN (só o hash fica guardado), chave mestra e chave de recuperação de 24 caracteres, espera depois de erros, bloqueio automático |
| `src/nucleo/backup.js` | Backup em arquivo, compactado e trancado pela chave mestra (AES-GCM 256). Abre com a senha de acesso da época ou com a chave de recuperação |
| `src/nucleo/nuvem/` | Google Drive: conexão (token só na memória), envio conferido, até 4 cópias e exclusão protegida |
| `src/nucleo/demo.js` | Dados fictícios |
| `src/telas/` | Hoje, Remédios, Rotinas, Ajustes, Entrada |
| `src/janelas/` | Janelas por cima: cadastros, detalhe, "+", alarme |

## Linha vermelha

O Airmed é organizador e lembrete. Nunca calcula, sugere nem bloqueia dose. SOS e janela só mostram o que a pessoa anotou.

## Limites desta versão

- O lembrete só toca com o app aberto no navegador. Alarme em tela cheia com o celular bloqueado: só na capa Android.
- Backup em arquivo e no Google Drive (área oculta do app, até 4 cópias conferidas). Pasta do PC e biometria ainda não entraram. Sem Google Agenda, só o tema Ervas.
- A conexão Google é, por enquanto, a mesma do Dagda Capital (`src/config.js`). O Airmed só mexe nos arquivos `airmed-backup-*.airmed`.
- Como no Dagda Capital, a senha protege a entrada do app e tranca os backups; os dados no navegador do aparelho não são criptografados.
- Entrada, janela do "+" e Ajustes são provisórios (telas ainda não desenhadas).
