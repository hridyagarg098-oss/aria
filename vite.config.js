import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Recharts 3.x ships CJS that needs explicit resolution under ESM
    },
  },
  optimizeDeps: {
    include: [
      'recharts',
      'react-hot-toast',
      'framer-motion',
      'lucide-react',
      'date-fns',
      'clsx',
      'tailwind-merge',
    ],
  },
  server: {
    port: 5173,
    open: true,
  },
});
