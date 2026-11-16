<script setup>
// Ícones de traço 1,5, 24×24, em currentColor.
defineProps({ nome: String, tam: { type: Number, default: 22 }, traco: { type: Number, default: 1.5 } })
const D = {
  hoje: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M2.5 12h2M19.5 12h2M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  capsula: '<path d="M10.5 20.5 3.5 13.5a5 5 0 0 1 7-7l7 7a5 5 0 0 1-7 7Z"/><path d="m8.5 8.5 7 7"/>',
  rotina: '<path d="M17 2.5l3.5 3.5-3.5 3.5"/><path d="M3.5 11.5v-1A4.5 4.5 0 0 1 8 6h12.5"/><path d="M7 21.5 3.5 18 7 14.5"/><path d="M20.5 12.5v1A4.5 4.5 0 0 1 16 18H3.5"/>',
  ajustes: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  comprimido: '<circle cx="12" cy="12" r="8"/><path d="M7 17 17 7"/>',
  gotas: '<path d="M12 3.5s6 6.8 6 10.8a6 6 0 0 1-12 0c0-4 6-10.8 6-10.8Z"/>',
  colirio: '<path d="M10.5 2.5h3v3h-3z"/><path d="M9 5.5h6l1 3v6a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6z"/><path d="M12 19v.5M12 21.5v.5"/>',
  xarope: '<path d="M9.5 3h5v3h-5z"/><path d="M8 9a3 3 0 0 1 1.5-3h5A3 3 0 0 1 16 9v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2z"/><path d="M8 12h8M8 17h8"/>',
  pomada: '<path d="M8 3h8l1 12H7z"/><path d="M9.5 15v3h5v-3M10.5 18v3h3v-3"/>',
  adesivo: '<rect x="4" y="4" width="16" height="16" rx="4"/><rect x="9" y="9" width="6" height="6" rx="1.5"/>',
  injecao: '<path d="m17 3 4 4M19 5l-3 3M14.5 6.5l3 3L9 18l-3.5.5L6 15z"/><path d="m5.5 18.5-2.5 2.5M11 10l2 2M9 12l2 2"/>',
  inalador: '<path d="M9 3h6v9H9z"/><path d="M9 9H7a2 2 0 0 0-2 2l-1 8a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-7"/>',
  outro: '<rect x="4" y="6" width="16" height="14" rx="3"/><path d="M9 6V4h6v2M12 10v6M9 13h6"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M16 3v4M8 3v4M3.5 10h17"/>',
  sos: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="m6 6 3.5 3.5M14.5 14.5 18 18M14.5 9.5 18 6M6 18l3.5-3.5"/>',
  atencao: '<path d="M12 4 2.5 20h19L12 4Z"/><path d="M12 10v4M12 17v.5"/>',
  atrasado: '<circle cx="12" cy="13" r="7"/><path d="M12 10v3l2 2M5 4 2.5 6.5M19 4l2.5 2.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/>',
  feito: '<path d="m5 12 4.5 4.5L19 7"/>',
  pulado: '<path d="M6 12h12"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  direita: '<path d="m9 6 6 6-6 6"/>',
  circulo: '<circle cx="12" cy="12" r="9"/>',
  marcar: '<circle cx="12" cy="12" r="8.5"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  lembrar: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 21h4"/>',
  cobrar: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 21h4M2.5 9a9 9 0 0 1 2.5-5M21.5 9A9 9 0 0 0 19 4"/>',
  cadeado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  marca: '<path d="M12 3a9 9 0 1 1-8.5 6"/><path d="M12 17v-6M12 13c-2 0-3.5-1.5-3.5-3.5 2 0 3.5 1.5 3.5 3.5M12 11c2 0 3.5-1.5 3.5-3.5-2 0-3.5 1.5-3.5 3.5"/>',
  lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  baixar: '<path d="M12 4v11M7.5 11 12 15.5 16.5 11M5 19.5h14"/>',
  digital: '<path d="M7 19c1.2-2 1.8-4.2 1.8-7a3.2 3.2 0 0 1 6.4 0c0 3.2-.5 5.8-1.6 8"/><path d="M12 12c0 3-.6 5.6-1.8 7.8M5.2 15.5c.4-1.2.6-2.3.6-3.5a6.2 6.2 0 0 1 12.4 0c0 1.5-.1 2.9-.4 4.2M4.6 9.5A7.6 7.6 0 0 1 12 4.4a7.6 7.6 0 0 1 4.8 1.7"/>',
  apagar: '<path d="M9 5h10.5a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z"/><path d="m12 9.5 5 5M17 9.5l-5 5"/>',
  celular: '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 17.5h2"/>',
  nuvem: '<path d="M7 18.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 9.1a4.7 4.7 0 0 1 .4 9.4z"/>',
  // categorias
  saude: '<path d="M12 20s-7.5-4.5-7.5-10A4.5 4.5 0 0 1 12 7.5 4.5 4.5 0 0 1 19.5 10C19.5 15.5 12 20 12 20Z"/>',
  casa: '<path d="M4 11 12 4l8 7v9H4z"/><path d="M10 20v-5h4v5"/>',
  estudos: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M12 4h6.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H12"/>',
  pessoal: '<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  lazer: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  trabalho: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V5h6v2.5M3.5 13h17"/>',
  organizacao: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="m3.5 6 1 1 1.5-2M3.5 12l1 1 1.5-2M3.5 18l1 1 1.5-2"/>',
  etiqueta: '<path d="M4 4h7l9 9-7 7-9-9z"/><circle cx="8.5" cy="8.5" r="1.2"/>',
}
</script>

<template>
  <svg :width="tam" :height="tam" viewBox="0 0 24 24" fill="none" stroke="currentColor" :stroke-width="traco"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" v-html="D[nome] || D.outro"></svg>
</template>
