import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/]posthog-js[\\/]/.test(id)) return 'posthog'
        },
      },
    },
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(d => !/(^|\/)posthog[-.]/.test(d)),
    },
  },
})
