import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// base relativa: funciona em qualquer endereço (GitHub Pages, domínio próprio, capa Android).
export default defineConfig({
  base: './',
  plugins: [vue()],
})
