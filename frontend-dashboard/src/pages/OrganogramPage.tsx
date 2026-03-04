/**
 * OrganogramPage -- standalone page for viewing the department organogram.
 * Route: /departments/organogram
 *
 * Uses setHeaderContent directly (instead of usePageHeader) so TierLegend
 * sits next to the title rather than being pushed to the right.
 */

import { useEffect, createElement } from 'react';
import { useLayoutHeader } from '../contexts/LayoutHeaderContext';
import { OrganogramTree, TierLegend } from '../components/organogram/OrganogramTree';

export function OrganogramPage() {
  const { setHeaderContent } = useLayoutHeader();

  useEffect(() => {
    setHeaderContent(
      createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            gap: 'var(--space-lg)',
          },
        },
        createElement(
          'h1',
          {
            style: {
              fontSize: 'var(--text-lg)',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-display)',
              margin: 0,
              whiteSpace: 'nowrap',
            },
          },
          'Department Organogram'
        ),
        createElement('div', { style: { flex: 1, display: 'flex', justifyContent: 'center' } }, createElement(TierLegend))
      )
    );
    return () => setHeaderContent(null);
  }, [setHeaderContent]);

  return (
    <div style={{
      width: 'calc(100% + 96px)',
      height: 'calc(100vh - 48px - var(--space-md))',
      margin: '-48px',
      marginTop: 'var(--space-md)',
      overflow: 'auto',
    }}>
      <OrganogramTree />
    </div>
  );
}
