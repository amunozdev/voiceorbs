'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const VIEWPORT_GAP = 8;

const placePopover = (trigger: HTMLElement, pop: HTMLElement) => {
  pop.style.left = '0px';
  pop.style.top = '';
  pop.style.bottom = '100%';
  const triggerRect = trigger.getBoundingClientRect();
  const popRect = pop.getBoundingClientRect();
  const spaceAbove = triggerRect.top;
  const spaceBelow = window.innerHeight - triggerRect.bottom;
  if (spaceAbove < popRect.height + VIEWPORT_GAP && spaceBelow > spaceAbove) {
    pop.style.bottom = '';
    pop.style.top = '100%';
  }
  const overflowRight = popRect.right - (window.innerWidth - VIEWPORT_GAP);
  const overflowLeft = VIEWPORT_GAP - popRect.left;
  if (overflowRight > 0) pop.style.left = `${-overflowRight}px`;
  else if (overflowLeft > 0) pop.style.left = `${overflowLeft}px`;
};

export const ColorField = ({ label, value, onChange }: ColorFieldProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = ref.current;
    const pop = popRef.current;
    if (!trigger || !pop) return;
    placePopover(trigger, pop);
    const first = pop.querySelector<HTMLElement>('[tabindex="0"], input');
    first?.focus();
    const onResize = () => placePopover(trigger, pop);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    const handleFocusIn = (event: FocusEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="grid h-10 w-12 shrink-0 place-items-center rounded-md sm:h-8 sm:w-10"
      >
        <span
          aria-hidden="true"
          className="h-7 w-10 rounded border border-border sm:h-6 sm:w-8"
          style={{ backgroundColor: value }}
        />
      </button>
      <span id={labelId} className="flex flex-col leading-tight">
        <span>{label}</span>
        <span className="font-mono text-[11px] uppercase text-muted">{value}</span>
      </span>
      {open && (
        <div
          ref={popRef}
          role="dialog"
          aria-label={`${label} color picker`}
          className="absolute z-20 my-2 flex flex-col gap-2 rounded-lg border border-border bg-panel p-2 shadow-lg"
        >
          <HexColorPicker color={value} onChange={onChange} />
          <HexColorInput
            color={value}
            onChange={onChange}
            prefixed
            aria-label={`${label} hex value`}
            className="w-full rounded border border-border bg-transparent px-2 py-1.5 text-center text-xs uppercase text-foreground"
          />
        </div>
      )}
    </div>
  );
};
