import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Load environment variables for the current mode
  // The third parameter '' ensures all environment variables are loaded, not just those prefixed with VITE_
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    define: {
      // Expose VITE_API_KEY as process.env.API_KEY to client-side code
      // This bridges the gap between Vite's import.meta.env and @google/genai's process.env requirement.
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
    },
  };
});