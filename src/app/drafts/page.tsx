import type { Metadata } from 'next';
import { draftOrbs } from '@/registry/registry';
import { readAdapterFiles, readOrbFiles, readSharedFiles } from '@/registry/read-files';
import { Gallery } from '@/components/gallery';
import { toGalleryOrb } from '@/components/gallery-orb';

export const metadata: Metadata = {
  title: 'Draft orbs | VoiceOrbs',
  robots: { index: false, follow: false },
};

const Page = async () => {
  const [fileEntries, shared, adapters] = await Promise.all([
    Promise.all(draftOrbs.map(async (orb) => [orb.id, await readOrbFiles(orb)] as const)),
    readSharedFiles(),
    readAdapterFiles(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-5 sm:py-16">
      <header className="mb-8 max-w-2xl">
        <h1 className="text-balance text-3xl font-bold tracking-tight">Draft orbs</h1>
        <p className="mt-3 text-sm text-muted">Work in progress, not listed in the public gallery.</p>
      </header>
      <Gallery
        orbs={draftOrbs.map(toGalleryOrb)}
        playground={{ files: Object.fromEntries(fileEntries), shared, adapters }}
      />
    </main>
  );
};

export default Page;
