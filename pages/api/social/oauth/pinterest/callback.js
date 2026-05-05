export default async function handler(req, res) {
  const site = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const redirect = new URL('/modules/social_media/setup', site);
  redirect.searchParams.set('connect', 'error');
  redirect.searchParams.set('message', 'Pinterest OAuth callback is not implemented yet in this build.');
  return res.redirect(redirect.toString());
}