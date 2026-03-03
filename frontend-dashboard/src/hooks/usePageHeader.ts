/**
 * usePageHeader — Convenience hook for pages to set a title + optional action buttons
 * in the DashboardLayout header bar via LayoutHeaderContext.
 *
 * Clears header content on unmount so stale headers don't persist across navigations.
 */

import { useEffect, type ReactNode, createElement } from 'react';
import { useLayoutHeader } from '../contexts/LayoutHeaderContext';

export function usePageHeader(title: string, actions?: ReactNode): void {
  const { setHeaderContent } = useLayoutHeader();

  useEffect(() => {
    setHeaderContent(
      createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            gap: 'var(--space-sm)',
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
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          },
          title
        ),
        actions
          ? createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-xs)',
                  flexShrink: 0,
                },
              },
              actions
            )
          : null
      )
    );

    return () => {
      setHeaderContent(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, setHeaderContent]);
}
