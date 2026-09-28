'use client';

import Link from 'next/link';
import { ArrowRightIcon } from './orb-icons';
import { PROVIDERS, PROVIDER_STORAGE_KEY, PROVIDER_VALUES } from './providers';
import { useStoredChoice } from './use-stored-choice';
import type { PromptProvider } from '@/registry/prompt';

const LINK_CLASS =
  'inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border bg-panel px-3.5 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent-foreground';

export const RecipeLinks = () => {
  const [provider] = useStoredChoice<PromptProvider>(PROVIDER_STORAGE_KEY, PROVIDER_VALUES, 'generic');
  const label = PROVIDERS.find((p) => p.value === provider)?.label;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {provider !== 'generic' && label && (
        <Link href={`/recipes#${provider}`} className={LINK_CLASS}>
          {label} recipe
          <ArrowRightIcon />
        </Link>
      )}
      <Link href="/recipes" className={LINK_CLASS}>
        All integration recipes
        <ArrowRightIcon />
      </Link>
    </div>
  );
};
