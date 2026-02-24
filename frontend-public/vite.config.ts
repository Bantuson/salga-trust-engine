import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),
  server: {
    port: 5174, // Public dashboard
    fs: {
      allow: ['..'],
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'clsx', 'class-variance-authority', 'react-loading-skeleton'],
    preserveSymlinks: false,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'clsx', 'class-variance-authority', 'react-loading-skeleton'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          animations: ['gsap', '@gsap/react', 'lenis', 'animejs'],
        },
      },
    },
  },
})
