import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Breeze Box',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // §6: the shell must work from a 360px phone up. Pinch zoom stays enabled.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
