import type { Metadata, Viewport } from 'next';
import './globals.css';

/**
 * The tool's own shell. Deliberately thin: the district header, the manifest,
 * the service worker and the install prompt all belong to /apps/shell, which
 * this is served under (§2, §11).
 */
export const metadata: Metadata = {
  title: 'Ed Code Assistant',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
