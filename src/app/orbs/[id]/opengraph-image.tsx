import { ImageResponse } from 'next/og';
import { orbs } from '@/registry/registry';
import { OG_BG, OG_SIZE, ogFonts, ogImage } from '@/og/og-assets';

export const generateStaticParams = () => orbs.map(({ id }) => ({ id }));

export const alt = 'Animated AI-assistant orb from the VoiceOrbs gallery';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const orb = orbs.find((o) => o.id === id);
  const name = orb?.name ?? 'VoiceOrbs';
  const tagline = orb?.tagline ?? 'Copy-paste animated orbs for AI assistants.';
  const [fonts, preview] = await Promise.all([ogFonts(), ogImage(`og/orbs/${orb?.id ?? 'siri-sheet'}.png`)]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 56,
          padding: '0 80px 0 56px',
          backgroundColor: OG_BG,
          fontFamily: 'Geist',
        }}
      >
        <img src={preview} width={460} height={460} alt="" />
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 580 }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: '#9aa1c2' }}>VoiceOrbs</div>
          <div
            style={{
              marginTop: 18,
              fontSize: 68,
              fontWeight: 600,
              color: '#f4f5fb',
              lineHeight: 1.04,
              letterSpacing: -2.5,
            }}
          >
            {name}
          </div>
          <div style={{ marginTop: 22, fontSize: 29, color: '#9aa1c2', lineHeight: 1.35 }}>{tagline}</div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
