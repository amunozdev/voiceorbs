import clsx from 'clsx';

const GRID_COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' };

interface SegmentOption {
  label: string;
  value: number;
}

export const SegmentedControl = ({
  label,
  options,
  value,
  onChange,
  defaultValue,
}: {
  label: string;
  options: SegmentOption[];
  value: number;
  onChange: (value: number) => void;
  defaultValue?: number;
}) => (
  <div
    role="group"
    aria-label={label}
    className={clsx(
      'grid w-full gap-0.5 rounded-md border border-border bg-panel p-0.5 sm:flex sm:w-fit sm:flex-wrap sm:items-center',
      GRID_COLS[Math.min(options.length, 4)] ?? 'grid-cols-4',
    )}
  >
    {options.map((option) => {
      const active = value === option.value;
      const isDefault = option.value === defaultValue;
      return (
        <button
          key={option.label}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={active}
          className={clsx(
            'relative inline-flex min-h-10 min-w-11 items-center justify-center rounded px-3 text-xs font-medium transition-colors sm:min-h-7 sm:min-w-0 sm:px-2.5',
            active ? 'bg-accent/15 text-accent-foreground' : 'text-muted hover:text-foreground',
          )}
        >
          {option.label}
          {isDefault && (
            <>
              <span
                aria-hidden="true"
                className="absolute top-1 right-1 size-1 rounded-full bg-current opacity-70"
              />
              <span className="sr-only"> (default)</span>
            </>
          )}
        </button>
      );
    })}
  </div>
);
