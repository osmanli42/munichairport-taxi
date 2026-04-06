import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { locales, defaultLocale } from './i18n';

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'as-needed',
  localeDetection: false,
});

// City blog pages are exclusive to flughafen-muenchen.taxi
const CITY_BLOG_PATTERN = /\/(?:en\/|tr\/)?blog\/taxi-(?!flughafen-muenchen$).+-flughafen-muenchen/;

export default function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  const pathname = request.nextUrl.pathname;

  // Block city slug pages on munichairport.taxi
  if (!host.includes('flughafen-muenchen') && CITY_BLOG_PATTERN.test(pathname)) {
    return NextResponse.rewrite(new URL('/not-found', request.url));
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|admin|.*\\..*).*)'],
};
