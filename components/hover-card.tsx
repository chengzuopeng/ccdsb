'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface Pos {
  x: number;
  y: number;
  placement: 'bottom' | 'top';
  align: 'left' | 'right';
}

interface Props {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
  panelClassName?: string;
  align?: 'left' | 'right';
  delay?: number;
  maxWidth?: number;
}

export function HoverCard({
  children,
  content,
  className,
  panelClassName,
  align = 'left',
  delay = 100,
  maxWidth = 360,
}: Props) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const showTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const [pos, setPos] = useState<Pos | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    return () => {
      if (showTimer.current) window.clearTimeout(showTimer.current);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  function compute(): Pos | null {
    const el = triggerRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const wantWidth = Math.min(maxWidth, window.innerWidth - 16);
    const spaceBelow = window.innerHeight - rect.bottom;
    const placement: 'bottom' | 'top' = spaceBelow < 200 ? 'top' : 'bottom';
    let x: number;
    if (align === 'right') {
      x = Math.min(rect.right, window.innerWidth - 8);
      if (x - wantWidth < 8) x = wantWidth + 8;
    } else {
      x = Math.max(rect.left, 8);
      if (x + wantWidth > window.innerWidth - 8) x = window.innerWidth - wantWidth - 8;
    }
    const y = placement === 'bottom' ? rect.bottom + margin : rect.top - margin;
    return { x, y, placement, align };
  }

  function open() {
    if (hideTimer.current) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (visible) return;
    showTimer.current = window.setTimeout(() => {
      const p = compute();
      if (!p) return;
      setPos(p);
      setVisible(true);
    }, delay);
  }

  function close() {
    if (showTimer.current) {
      window.clearTimeout(showTimer.current);
      showTimer.current = null;
    }
    hideTimer.current = window.setTimeout(() => setVisible(false), 80);
  }

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        className={cn('inline-block', className)}
      >
        {children}
      </span>
      {mounted && pos &&
        createPortal(
          <div
            onMouseEnter={() => {
              if (hideTimer.current) {
                window.clearTimeout(hideTimer.current);
                hideTimer.current = null;
              }
            }}
            onMouseLeave={close}
            style={{
              position: 'fixed',
              left: pos.align === 'right' ? undefined : pos.x,
              right: pos.align === 'right' ? window.innerWidth - pos.x : undefined,
              top: pos.placement === 'bottom' ? pos.y : undefined,
              bottom: pos.placement === 'top' ? window.innerHeight - pos.y : undefined,
              maxWidth,
              transform: visible
                ? 'translateY(0) scale(1)'
                : pos.placement === 'bottom'
                  ? 'translateY(-4px) scale(0.98)'
                  : 'translateY(4px) scale(0.98)',
              opacity: visible ? 1 : 0,
              transitionProperty: 'opacity, transform',
              transitionDuration: '120ms',
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
              transformOrigin: pos.placement === 'bottom' ? 'top' : 'bottom',
              pointerEvents: visible ? 'auto' : 'none',
            }}
            className={cn(
              'z-50 card border-border-hi shadow-xl rounded-button',
              panelClassName,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
