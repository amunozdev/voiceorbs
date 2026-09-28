import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/orb-icons';
import { RecipeCard } from './recipe-card';
import { recipes, START_RECIPE_ID } from './recipes';

export const metadata: Metadata = {
  title: 'Recipes | VoiceOrbs',
  description:
    'Integration recipes for wiring VoiceOrbs orbs to real voice stacks: plain microphone, Vapi, ElevenLabs Agents, LiveKit Agents and OpenAI Realtime.',
};

const RecipesPage = () => (
  <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-5 sm:py-16">
    <header className="mb-8 max-w-2xl">
      <Link
        href="/"
        className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-foreground"
      >
        <ArrowLeftIcon />
        Back to the gallery
      </Link>
      <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">
        Integration recipes
      </h1>
      <p className="mt-4 text-pretty text-base text-muted">
        Every orb takes the same two inputs: <span className="text-foreground">state</span> (the
        assistant lifecycle) and <span className="text-foreground">levelRef</span> (a live 0..1
        audio amplitude). These recipes show how to feed both from real voice stacks using the
        typed copy-paste adapters in{' '}
        <code className="rounded bg-code px-1.5 py-0.5 font-mono text-sm text-code-foreground">
          src/registry/lib
        </code>
        . The adapters type each provider surface structurally, so nothing here adds an SDK
        dependency to your bundle until you install the one you actually use.
      </p>
    </header>

    <nav
      aria-label="Jump to a recipe"
      className="sticky top-14 z-30 -mx-4 mb-8 border-b border-border bg-background/80 px-4 py-2.5 backdrop-blur sm:-mx-5 sm:px-5"
    >
      <ul className="flex gap-1.5 overflow-x-auto pr-6 [mask-image:linear-gradient(to_right,black_85%,transparent)] sm:pr-0 sm:[mask-image:none]">
        {recipes.map((recipe) => (
          <li key={recipe.id} className="shrink-0">
            <a
              href={`#${recipe.id}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted transition-colors hover:border-accent hover:text-foreground sm:min-h-8"
            >
              {recipe.name}
              {recipe.id === START_RECIPE_ID && (
                <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
                  Start here
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </nav>

    <div className="flex flex-col gap-10">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} start={recipe.id === START_RECIPE_ID} />
      ))}
    </div>
  </main>
);

export default RecipesPage;
