import { CodePane } from '@/components/code-pane';
import type { Recipe } from './recipes';

interface RecipeCardProps {
  recipe: Recipe;
  start?: boolean;
}

export const RecipeCard = ({ recipe, start = false }: RecipeCardProps) => (
  <article
    id={recipe.id}
    className="scroll-mt-32 overflow-hidden rounded-xl border border-border bg-panel"
  >
    <div className="flex flex-col gap-2.5 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-foreground">{recipe.name}</h2>
        <span className="rounded-full border border-border px-2.5 py-0.5 font-mono text-xs text-muted">
          {recipe.badge}
        </span>
        {start && (
          <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
            Start here
          </span>
        )}
      </div>
      <p className="max-w-3xl text-sm leading-relaxed text-muted">{recipe.intro}</p>
      {recipe.adapterPath ? (
        <p className="text-xs text-muted">
          Copy the adapter from{' '}
          <code className="rounded bg-code px-1.5 py-0.5 font-mono text-code-foreground">
            {recipe.adapterPath}
          </code>{' '}
          into your project first.
        </p>
      ) : null}
    </div>
    <CodePane code={recipe.code} copyLabel="Copy recipe" flush preClassName="max-h-96" />
  </article>
);
