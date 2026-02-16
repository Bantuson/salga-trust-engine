import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envDir: path.resolve(__dirname, '..'),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
    // Ensure shared components resolve dependencies from this project's node_modules
    dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'clsx', 'class-variance-authority', 'react-loading-skeleton'],
    preserveSymlinks: false,
  },
  optimizeDeps: {
    // Include shared folder in dependency optimization
    include: ['react', 'react-dom', 'react/jsx-runtime', 'clsx', 'class-variance-authority', 'react-loading-skeleton'],
  },
  server: {
    port: 5173, // Municipal dashboard
    fs: {
      // Allow serving files from shared folder
      allow: ['..'],
    },
  },
})
