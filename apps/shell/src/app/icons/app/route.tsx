import { ImageResponse } from 'next/og';
import { NextResponse, type NextRequest } from 'next/server';
import { getDistrict } from '@/lib/district/server';

/**
 * District app icons for the manifest (backbone §11).
 *
 * Generated rather than served straight from districts.icon_url for two
 * reasons:
 *
 *  1. A manifest needs specific sizes in a known format. A district hands us
 *     one URL of unknown dimensions.
 *  2. §11 wants a maskable icon. Android crops a maskable icon to a circle,
 *     so it needs roughly 20% safe-area padding all round. Declaring an
 *     unpadded logo as maskable is worse than declaring none: the logo comes
 *     out visibly clipped.
 *
 * Districts with no icon_url get their initials on their theme color, which
 * beats a generic placeholder on a teacher's home screen.
 *
 * Worth knowing: this fetches districts.icon_url server-side. That URL is set
 * by a super-admin in the control panel (§10), never by a district user, so it
 * is not an open server-side fetch. Keep it that way.
 */
export const runtime = 'nodejs';

const MAX_SIZE = 1024;

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words.map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}

export async function GET(request: NextRequest) {
  const district = await getDistrict();
  if (!district) {
    return NextResponse.json({ error: 'no district for this hostname' }, { status: 404 });
  }

  const params = request.nextUrl.searchParams;
  const requested = Number.parseInt(params.get('size') ?? '512', 10);
  const size = Number.isFinite(requested)
    ? Math.min(Math.max(requested, 48), MAX_SIZE)
    : 512;
  const maskable = params.get('maskable') === '1';

  // Android's maskable spec keeps the middle 80% visible; the safe zone for
  // artwork is tighter still. 62% of the canvas survives every mask shape.
  const artworkScale = maskable ? 0.62 : 0.86;
  const artwork = Math.round(size * artworkScale);

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // A maskable icon must paint edge to edge: any transparency shows
          // up as a hole once the platform applies its shape.
          background: district.theme_color,
        }}
      >
        {district.icon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={district.icon_url}
            alt=""
            width={artwork}
            height={artwork}
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              fontSize: Math.round(artwork * 0.5),
              fontWeight: 600,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            {initials(district.name)}
          </div>
        )}
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        // Icons change only when a district rebrands. A day is plenty, and
        // the manifest itself is on a five-minute cache.
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    },
  );
}
