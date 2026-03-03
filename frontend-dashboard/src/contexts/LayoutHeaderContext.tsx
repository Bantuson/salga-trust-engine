/**
 * LayoutHeaderContext — Allows pages to inject content into the DashboardLayout header bar.
 *
 * Usage: Pages call useLayoutHeader().setHeaderContent(<MyHeader />) or use
 * the convenience hook usePageHeader(title, actions).
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

interface LayoutHeaderContextValue {
  headerContent: ReactNode;
  setHeaderContent: (node: ReactNode) => void;
}

const LayoutHeaderContext = createContext<LayoutHeaderContextValue | null>(null);

export function LayoutHeaderProvider({ children }: { children: ReactNode }) {
  const [headerContent, setHeaderContent] = useState<ReactNode>(null);

  return (
    <LayoutHeaderContext.Provider value={{ headerContent, setHeaderContent }}>
      {children}
    </LayoutHeaderContext.Provider>
  );
}

export function useLayoutHeader(): LayoutHeaderContextValue {
  const ctx = useContext(LayoutHeaderContext);
  if (!ctx) {
    throw new Error('useLayoutHeader must be used within a LayoutHeaderProvider');
  }
  return ctx;
}
