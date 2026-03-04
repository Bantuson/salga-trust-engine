/**
 * usePageHeader — Convenience hook for pages to set a title + optional action buttons
 * in the DashboardLayout header bar via LayoutHeaderContext.
 *
 * Clears header content on unmount so stale headers don't persist across navigations.
 *
 * When title is '', the h1 is skipped and only actions are rendered (full-width).
 */

import { useEffect, type ReactNode, createElement } from 'react';
import { useLayoutHeader } from '../contexts/LayoutHeaderContext';

export function usePageHeader(title: string, actions?: ReactNode): void {
  const { setHeaderContent } = useLayoutHeader();

  useEffect(() => {
    // When title is empty, render only the actions at full width
    if (title === '') {
      setHeaderContent(
        actions
          ? createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                },
              },
              actions
            )
          : null
      );
    } else {
      setHeaderContent(
        createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
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
                    marginLeft: 'auto',
                  },
                },
                actions
              )
            : null
        )
      );
    }

    return () => {
      setHeaderContent(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, setHeaderContent]);
}
