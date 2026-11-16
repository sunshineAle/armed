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
| `src/nucleo/backup.js` | Backup em arquivo criptografado (PBKDF2-SHA-256, 600 mil voltas + AES-GCM 256). A senha nunca é guardada |
| `src/nucleo/demo.js` | Dados fictícios |
| `src/telas/` | Hoje, Remédios, Rotinas, Ajustes, Entrada |
| `src/janelas/` | Janelas por cima: cadastros, detalhe, "+", alarme |

## Linha vermelha

O Airmed é organizador e lembrete. Nunca calcula, sugere nem bloqueia dose. SOS e janela só mostram o que a pessoa anotou.

## Limites desta versão

- O lembrete só toca com o app aberto no navegador. Alarme em tela cheia com o celular bloqueado: só na capa Android.
- Backup só em arquivo (manual). Sem envio automático para nuvem, sem Google Agenda, só o tema Ervas.
- Entrada, janela do "+" e Ajustes são provisórios (telas ainda não desenhadas).
