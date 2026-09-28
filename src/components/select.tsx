'use client';

import * as SelectPrimitive from '@radix-ui/react-select';

interface SelectOption {
  value: string;
  label: string;
}

const ChevronIcon = () => (
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
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

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

export const Select = ({
  value,
  onValueChange,
  options,
  ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly SelectOption[];
  ariaLabel: string;
}) => (
  <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
    <SelectPrimitive.Trigger
      aria-label={ariaLabel}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-panel px-2.5 text-xs sm:min-h-8 font-medium text-foreground transition-colors hover:border-accent focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 data-[state=open]:border-accent"
    >
      <SelectPrimitive.Value />
      <SelectPrimitive.Icon className="text-muted">
        <ChevronIcon />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position="popper"
        sideOffset={4}
        className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-panel p-1 shadow-lg"
      >
        <SelectPrimitive.Viewport>
          {options.map((option) => (
            <SelectPrimitive.Item
              key={option.value}
              value={option.value}
              className="flex cursor-pointer items-center justify-between gap-4 rounded px-2 py-2.5 text-xs text-foreground outline-none sm:py-1.5 select-none data-[highlighted]:bg-accent/15 data-[highlighted]:text-accent-foreground data-[state=checked]:text-accent-foreground"
            >
              <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              <SelectPrimitive.ItemIndicator>
                <CheckIcon />
              </SelectPrimitive.ItemIndicator>
            </SelectPrimitive.Item>
          ))}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
);
