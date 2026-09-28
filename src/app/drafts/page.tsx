import type { Metadata } from 'next';
import { draftOrbs } from '@/registry/registry';
import { readAdapterFiles, readOrbFiles, readSharedFiles } from '@/registry/read-files';
import { Gallery } from '@/components/gallery';
import type { OrbCardData } from '@/components/orb-card';

export const metadata: Metadata = {
  title: 'Draft orbs | VoiceOrbs',
  robots: { index: false, follow: false },
};

const getDrafts = (): Promise<OrbCardData[]> =>
  Promise.all(
    draftOrbs.map(async (orb) => ({
      id: orb.id,
      name: orb.name,
      tagline: orb.tagline,
      tech: orb.tech,
      dependencies: orb.dependencies,
      defaultColorFrom: orb.defaultColorFrom,
      defaultColorTo: orb.defaultColorTo,
      defaultSize: orb.defaultSize,
      files: await readOrbFiles(orb),
    })),
  );

const Page = async () => {
  const [data, shared, adapters] = await Promise.all([getDrafts(), readSharedFiles(), readAdapterFiles()]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-5 sm:py-16">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-balance text-3xl font-bold tracking-tight">Draft orbs</h1>
        <p className="mt-3 text-sm text-muted">Work in progress, not listed in the public gallery.</p>
      </header>
      <Gallery orbs={data} shared={shared} adapters={adapters} />
    </main>
  );
};

export default Page;
