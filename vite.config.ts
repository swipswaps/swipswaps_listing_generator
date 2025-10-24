import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    plugins: [react()],
    // The 'define' block and related console logs are removed.
    // The Gemini API key will now be accessed directly via `import.meta.env.VITE_API_KEY`
    // in `services/geminiService.ts` for consistent client-side behavior with Vite.
  };
});