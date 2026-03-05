/**
 * Root application component — layout shell with header and page routing.
 */

import { useState } from 'react';
import { Header } from './components/Header.js';
import { AuditPage } from './pages/AuditPage.js';
import { HistoryPage } from './pages/HistoryPage.js';
import { useAuditStore } from './stores/audit-store.js';

export function App() {
  const [activeView, setActiveView] = useState<'audit' | 'history'>('audit');
  const { url, result } = useAuditStore();

  return (
    <div>
      <Header
        url={url}
        crawledPages={result?.crawledPages}
        activeView={activeView}
        onViewChange={setActiveView}
      />
      {activeView === 'audit' ? <AuditPage /> : <HistoryPage onNavigateToAudit={() => setActiveView('audit')} />}
    </div>
  );
}
