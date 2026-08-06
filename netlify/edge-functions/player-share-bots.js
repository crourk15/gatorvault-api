/**
 * Social crawlers hitting vault SPA player URLs get no OG tags.
 * Rewrite them to /share/player/:slug so X / iMessage / Slack unfurl the card.
 */
const BOT_RE =
  /Twitterbot|facebookexternalhit|Facebot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|SkypeUriPreview|Slack-ImgProxy|Embedly|redditbot|Pinterest/i;

export default async (request, context) => {
  const ua = request.headers.get('user-agent') || '';
  if (!BOT_RE.test(ua)) return context.next();

  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/vault\/(?:futurecast|recruiting)\/player\/([^/]+)\/?$/i
  );
  if (!match) return context.next();

  const slug = decodeURIComponent(match[1]);
  url.pathname = `/share/player/${encodeURIComponent(slug)}`;
  url.search = '';
  url.hash = '';
  return Response.redirect(url.toString(), 302);
};
