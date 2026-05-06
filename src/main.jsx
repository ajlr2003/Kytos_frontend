/**
 * src/main.jsx
 *
 * Application entry point. Mounts the React root onto the #root DOM element
 * defined in index.html. StrictMode is enabled in all environments to surface
 * potential issues early during development.
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
