'use client';

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    width="14"
    height="14"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={clsx('transition-transform motion-reduce:transition-none', open && 'rotate-180')}
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export const Disclosure = ({
  label,
  children,
  defaultOpen = false,
  className,
}: {
  label: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <div className={clsx('flex flex-col gap-3', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="inline-flex min-h-10 w-fit items-center gap-1.5 rounded-md text-xs font-medium text-muted transition-colors hover:text-foreground sm:min-h-7"
      >
        {label}
        <ChevronIcon open={open} />
      </button>
      <div id={panelId} hidden={!open} className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
};
