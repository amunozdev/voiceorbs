'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';

interface CopyButtonProps {
  value: string;
  label?: string;
  className?: string;
  variant?: 'outline' | 'solid';
}

type CopyStatus = 'idle' | 'copied' | 'failed';

const STATUS_TEXT: Record<CopyStatus, string> = {
  idle: '',
  copied: 'Copied',
  failed: 'Copy failed',
};

const CheckIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const CopyButton = ({
  value,
  label = 'Copy',
  className,
  variant = 'outline',
}: CopyButtonProps) => {
  const [status, setStatus] = useState<CopyStatus>('idle');
  const timerRef = useRef(0);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setStatus('idle'), 1600);
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className={clsx(
          'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors sm:min-h-8',
          variant === 'solid'
            ? 'border border-accent bg-accent text-white hover:bg-accent/85'
            : 'border border-border bg-panel text-foreground hover:border-accent hover:text-accent-foreground',
          className,
        )}
      >
        {status === 'copied' && <CheckIcon />}
        {label}
      </button>
      <span
        role="status"
        aria-live="polite"
        className={status === 'failed' ? 'text-xs text-muted' : 'sr-only'}
      >
        {STATUS_TEXT[status]}
      </span>
    </>
  );
};
