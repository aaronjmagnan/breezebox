import type { Metadata, Viewport } from 'next';
import { getDistrict } from '@/lib/district/server';
import { PwaProvider } from '@/components/pwa-provider';
import './globals.css';

/**
 * Title and theme color come from the district the hostname resolved to, so
 * each district's installed app is its own (§8, §11).
 */
export async function generateMetadata(): Promise<Metadata> {
  const district = await getDistrict();

  return {
    title: district?.app_name ?? 'Breeze Box',
    applicationName: district?.app_name ?? 'Breeze Box',
    // Per-district manifest (§11). Served before sign-in, so the install
    // prompt can appear at all.
    manifest: '/manifest.webmanifest',
    icons: {
      icon: [{ url: '/icons/app?size=192', sizes: '192x192', type: 'image/png' }],
      apple: [{ url: '/icons/app?size=192', sizes: '192x192', type: 'image/png' }],
    },
    appleWebApp: {
      capable: true,
      title: district?.app_name ?? 'Breeze Box',
      statusBarStyle: 'default',
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const district = await getDistrict();

  return {
    width: 'device-width',
    initialScale: 1,
    // Pinch zoom stays enabled on purpose: disabling it fails WCAG 1.4.4 and
    // this is software people read forms in.
    viewportFit: 'cover',
    themeColor: district?.theme_color ?? '#4a7fb5',
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
