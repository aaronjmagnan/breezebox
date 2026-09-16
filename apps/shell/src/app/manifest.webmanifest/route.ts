import { NextResponse, type NextRequest } from 'next/server';
import { getDistrict } from '@/lib/district/server';

/**
 * The district's PWA manifest (backbone §11).
 *
 * Generated per district from get_district_branding, so each district installs
 * its own app with its own name, icon and color, from the same code.
 *
 * Note this is served before sign-in: the manifest has to be readable for the
 * install prompt to appear at all, and it contains only public branding.
 */
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  const district = await getDistrict();

  if (!district) {
    return NextResponse.json({ error: 'no district for this hostname' }, { status: 404 });
  }

  const manifest = {
    // §11: name and short_name both come from app_name.
    name: district.app_name,
    short_name: district.app_name,
    description: `${district.name} staff apps`,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    theme_color: district.theme_color,
    background_color: district.theme_color,
    lang: 'en',
    dir: 'ltr',
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/app?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // §11 asks for a maskable version. It is generated rather than reusing
      // the district's icon directly: a logo with no safe-area padding gets
      // cropped into a circle on Android, which looks broken.
      {
        src: '/icons/app?size=512&maskable=1',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      // Short cache: a district changing its name or color should see it soon,
      // but not on every navigation.
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
