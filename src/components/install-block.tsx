'use client';

import * as Tabs from '@radix-ui/react-tabs';
import { CopyButton } from './copy-button';
import { useStoredChoice } from './use-stored-choice';

const PACKAGE_MANAGERS = [
  { id: 'npm', run: 'npm i' },
  { id: 'pnpm', run: 'pnpm add' },
  { id: 'yarn', run: 'yarn add' },
  { id: 'bun', run: 'bun add' },
] as const;

type PackageManager = (typeof PACKAGE_MANAGERS)[number]['id'];

const PM_IDS = PACKAGE_MANAGERS.map((pm) => pm.id);

export const InstallBlock = ({ dependencies }: { dependencies: string[] }) => {
  const [pm, setPm] = useStoredChoice<PackageManager>('voiceorbs:package-manager', PM_IDS, 'npm');
  if (dependencies.length === 0) return null;
  return (
    <Tabs.Root
      value={pm}
      onValueChange={(next) => setPm(next as PackageManager)}
      className="overflow-hidden rounded-lg border border-border bg-panel"
    >
      <Tabs.List
        aria-label="Package manager"
        className="flex flex-wrap gap-1 border-b border-border bg-background/60 px-2 py-1.5"
      >
        {PACKAGE_MANAGERS.map((item) => (
          <Tabs.Trigger
            key={item.id}
            value={item.id}
            className="inline-flex min-h-10 min-w-11 items-center justify-center rounded-md px-2.5 text-xs text-muted transition-colors hover:text-foreground data-[state=active]:bg-accent/15 data-[state=active]:text-accent-foreground sm:min-h-7 sm:min-w-0"
          >
            {item.id}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {PACKAGE_MANAGERS.map((item) => {
        const command = `${item.run} ${dependencies.join(' ')}`;
        return (
          <Tabs.Content
            key={item.id}
            value={item.id}
            className="flex items-center gap-2 py-2 pr-2 pl-4"
          >
            <pre className="min-w-0 flex-1 overflow-x-auto font-mono text-xs leading-relaxed text-foreground">
              <span className="select-none text-muted">$ </span>
              {command}
            </pre>
            <CopyButton value={command} label="Copy" className="shrink-0" />
          </Tabs.Content>
        );
      })}
    </Tabs.Root>
  );
};
