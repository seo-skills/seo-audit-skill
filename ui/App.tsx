/**
 * The app shell.
 *
 * One React app, two hosts. Electron loads it from `file://`, where only a
 * hash router works; `seomator serve` serves it over HTTP, where real paths
 * are what a user expects to be able to bookmark and share.
 */

import { HashRouter, BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header.js';
import { HomePage } from './pages/HomePage.js';
import { AuditDetailPage } from './pages/AuditDetailPage.js';
import { ComparePage } from './pages/ComparePage.js';
import { RunPage } from './pages/RunPage.js';
import { getHost } from './lib/api-client.js';

export function App() {
  const host = getHost();
  const Router = host === 'electron' ? HashRouter : BrowserRouter;

  return (
    <Router>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Header canRunAudits />
      <main id="main" className="pt-[var(--header-height)]">
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* The old two-tab shell linked here; keep the URL working. */}
          <Route path="/history" element={<Navigate to="/" replace />} />
          <Route path="/audits/:id" element={<AuditDetailPage />} />
          <Route path="/compare/:id" element={<ComparePage />} />
          <Route path="/compare/:id/:against" element={<ComparePage />} />
          <Route path="/run" element={<RunPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
    </Router>
  );
}

function NotFound() {
  return (
    <div className="max-w-[var(--content-max-width)] mx-auto p-6 text-center py-16">
      <p className="text-base font-medium mb-1" style={{ color: 'var(--color-text)' }}>
        That page does not exist
      </p>
      <a href="/" className="text-sm underline" style={{ color: 'var(--color-accent)' }}>
        Back to history
      </a>
    </div>
  );
}
