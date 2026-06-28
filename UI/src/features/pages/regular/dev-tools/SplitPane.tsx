import { FC, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Box, useMediaQuery, useTheme as useMuiTheme } from '@mui/material';

interface SplitPaneProps {
  left: ReactNode;
  right: ReactNode;
  /** Initial width of the left pane, in percent. */
  initialLeftPct?: number;
  minPct?: number;
  maxPct?: number;
  /** localStorage key to persist the divider position. */
  storageKey?: string;
}

/**
 * A horizontally resizable two-pane layout with a draggable divider. On narrow
 * (< md) viewports it falls back to a vertical stack.
 */
export const SplitPane: FC<SplitPaneProps> = ({
  left,
  right,
  initialLeftPct = 50,
  minPct = 28,
  maxPct = 72,
  storageKey,
}) => {
  const muiTheme = useMuiTheme();
  const isNarrow = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [leftPct, setLeftPct] = useState<number>(() => {
    if (storageKey) {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved >= minPct && saved <= maxPct) return saved;
    }
    return initialLeftPct;
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const onMouseDown = () => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPct(Math.min(maxPct, Math.max(minPct, pct)));
    },
    [minPct, maxPct],
  );

  const onMouseUp = useCallback(() => {
    if (!dragging.current) return;
    dragging.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (storageKey) localStorage.setItem(storageKey, String(Math.round(leftPct)));
  }, [leftPct, storageKey]);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  if (isNarrow) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {left}
        {right}
      </Box>
    );
  }

  return (
    <Box ref={containerRef} sx={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
      <Box sx={{ width: `${leftPct}%`, minWidth: 0 }}>{left}</Box>
      <Box
        onMouseDown={onMouseDown}
        role="separator"
        aria-orientation="vertical"
        sx={{
          width: 12,
          flexShrink: 0,
          cursor: 'col-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&:hover .split-bar': { backgroundColor: 'primary.main' },
        }}
      >
        <Box className="split-bar" sx={{ width: 3, height: '100%', borderRadius: 1, backgroundColor: 'divider', transition: 'background-color .15s' }} />
      </Box>
      <Box sx={{ width: `${100 - leftPct}%`, minWidth: 0 }}>{right}</Box>
    </Box>
  );
};
