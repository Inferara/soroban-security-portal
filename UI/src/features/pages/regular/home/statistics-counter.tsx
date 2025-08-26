import * as React from "react";
import { FC, useEffect, useMemo, useRef, useState } from "react";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Badge } from "@mui/material";

// ---- Types
type UseCountUpArgs = {
    start?: number;
    end: number;
    duration?: number;
    decimals?: number;
    formatOptions?: Intl.NumberFormatOptions;
};

type UseInViewOptions = {
    threshold?: number;
};

export type AnimatedSuperscriptCounterProps = {
    target?: number;
    superTarget?: number;
    duration?: number;
    superDuration?: number;
    decimals?: number;
    superDecimals?: number;
    targetRaw?: number;
    supRaw?: number;
};

// ---- Utilities
function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !("matchMedia" in window)) return;
        const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
        const onChange = () => setReduced(!!mql.matches);
        onChange();

        if ("addEventListener" in mql) {
            mql.addEventListener("change", onChange);
            return () => mql.removeEventListener("change", onChange as EventListener);
        } else if ("addListener" in mql) {
            // @ts-expect-error: Older Safari
            mql.addListener(onChange);
            return () => {
                // @ts-expect-error: Older Safari
                mql.removeListener(onChange);
            };
        }
    }, []);
    return reduced;
}

function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

// Rounds to the given number of decimals without string formatting
function roundToDecimals(n: number, decimals: number): number {
    if (!Number.isFinite(n)) return 0;
    const m = Math.pow(10, decimals);
    return Math.round(n * m) / m;
}

/** Optimized counter hook
 *  - Avoids re-rendering every RAF frame by only updating React state when the rounded
 *    display value actually changes
 *  - Still animates at 60fps visually
 */
function useCountUp({ start = 0, end, duration = 800, decimals = 0, formatOptions }: UseCountUpArgs) {
    const prefersReduced = usePrefersReducedMotion();
    const [display, setDisplay] = useState<number>(roundToDecimals(start, decimals));

    const fromRef = useRef<number>(start);
    const toRef = useRef<number>(end);
    const startTimeRef = useRef<number>(0);
    const rafRef = useRef<number | null>(null);
    const lastRoundedRef = useRef<number>(display);

    // Stable formatter; constructing Intl.NumberFormat is relatively expensive
    const formatter = useMemo(() => new Intl.NumberFormat(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
        ...formatOptions,
    }), [decimals, formatOptions]);

    const tick = React.useCallback((now: number) => {
        const elapsed = now - startTimeRef.current;
        const t = Math.min(1, duration <= 0 ? 1 : elapsed / duration);
        const eased = easeOutCubic(t);
        const raw = fromRef.current + (toRef.current - fromRef.current) * eased;
        const rounded = roundToDecimals(raw, decimals);
        // Only update React state if the rounded number changed
        if (rounded !== lastRoundedRef.current) {
            lastRoundedRef.current = rounded;
            setDisplay(rounded);
        }
        if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
        }
    }, [decimals, duration]);

    const animateTo = React.useCallback((to: number) => {
        toRef.current = to;
        if (prefersReduced || duration <= 0) {
            const rounded = roundToDecimals(to, decimals);
            lastRoundedRef.current = rounded;
            setDisplay(rounded);
            return;
        }
        fromRef.current = lastRoundedRef.current; // continue from current display
        startTimeRef.current = performance.now();
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(tick);
    }, [decimals, duration, prefersReduced, tick]);

    // Cleanup
    useEffect(() => () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    }, []);

    return { value: display, animateTo, format: (num: number) => formatter.format(num) } as const;
}

function useInView({ threshold = 0.3 }: UseInViewOptions = {}) {
    const ref = useRef<HTMLDivElement | null>(null);
    const [inView, setInView] = useState<boolean>(false);

    useEffect(() => {
        const el = ref.current;
        if (!el || typeof IntersectionObserver === "undefined") return;
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setInView(true);
                io.disconnect();
            }
        }, { threshold });
        io.observe(el);
        return () => io.disconnect();
    }, [threshold]);

    return { ref, inView } as const;
}


export const AnimatedSuperscriptCounter: FC<AnimatedSuperscriptCounterProps> = ({
    duration = 900,
    superDuration = 700,
    decimals = 0,
    superDecimals = 0,
    targetRaw = 0,
    supRaw = 0
}) => {
    const { ref, inView } = useInView();
    const target = Math.max(0, Number.isFinite(targetRaw) ? targetRaw : 0);
    const superTarget = Math.max(0, Number.isFinite(supRaw) ? supRaw : 0);
    const main = useCountUp({ start: 0, end: target, duration, decimals });
    const sup = useCountUp({ start: 0, end: superTarget, duration: superDuration, decimals: superDecimals });

    const safeMain = Math.max(0, Number.isFinite(main.value) ? main.value : 0);
    const safeSup = Math.max(0, Number.isFinite(sup.value) ? sup.value : 0);

    const formatted = useMemo(() => new Intl.NumberFormat(undefined, {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
    }).format(safeMain), [safeMain, decimals]);

    const formattedSup = useMemo(() => new Intl.NumberFormat(undefined, {
        maximumFractionDigits: superDecimals,
        minimumFractionDigits: superDecimals,
    }).format(safeSup), [safeSup, superDecimals]);

    const hasIncrease = safeSup > 0;
    const color = hasIncrease ? "#569e67" : "#9e9e9e";
    const text = hasIncrease ? `+${formattedSup} last month` : '';

    useEffect(() => {
        if (inView) {
            main.animateTo(target);
            sup.animateTo(superTarget);
        }
    }, [inView, main, sup, target, superTarget]);

    return (
        <Box ref={ref}>
            <Badge sx={{
                color: color, "& .MuiBadge-badge": {
                    fontSize: '1.25rem',
                    minWidth: 180,
                    pl: 1,
                }
            }} badgeContent={text}>
                <Typography variant="h1" color="text.secondary">
                    {formatted}
                </Typography>
            </Badge>
        </Box>
    );
}
