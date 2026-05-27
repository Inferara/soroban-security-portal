import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface RevealOnScrollProps {
  children: ReactNode;
  /** Delay in ms before the reveal transition (for staggering). */
  delay?: number;
}

/**
 * Fades + slides content up when it scrolls into view. No-op (always visible)
 * when the user prefers reduced motion or IntersectionObserver is unavailable.
 */
export const RevealOnScroll: FC<RevealOnScrollProps> = ({ children, delay = 0 }) => {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(reduced);

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <Box
      ref={ref}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(24px)',
        transition: reduced ? 'none' : `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Box>
  );
};
