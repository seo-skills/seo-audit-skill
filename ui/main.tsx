import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
// The brand faces, bundled with the UI so nothing is fetched at runtime.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './styles/tailwind.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
