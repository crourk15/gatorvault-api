/**
 * Social crawlers hitting vault SPA player URLs get no OG tags.
 * Rewrite them to /share/player/:slug so X / iMessage / Slack unfurl the card.
 */
const BOT_RE =
  /Twitterbot|facebookexternalhit|Facebot|LinkedInBot|Slackbot|Discordbot|WhatsApp|TelegramBot|Applebot|SkypeUriPreview|Slack-ImgProxy|Embedly|redditbot|Pinterest/i;

export default async (request, context) => {
  const url = new URL(request.url);
  const match = url.pathname.match(
    /^\/vault\/(?:futurecast|recruiting)\/player\/([^/]+)(\/?)$/i
  );
  if (!match) return context.next();

  const ua = request.headers.get('user-agent') || '';
  if (BOT_RE.test(ua)) {
    const slug = decodeURIComponent(match[1]);
    url.pathname = `/share/player/${encodeURIComponent(slug)}`;
    url.search = '';
    url.hash = '';
    return Response.redirect(url.toString(), 302);
  }

  // No-slash player URLs 500/503 through this edge path on Netlify
  // (`Error - Request ID: …`). The trailing-slash SPA shell always serves.
  if (match[2] !== '/') {
    url.pathname = `${url.pathname}/`;
    return Response.redirect(url.toString(), 308);
  }

  return context.next();
};
