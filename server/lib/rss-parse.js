/**
 * Lightweight RSS/Atom item parser (no extra dependencies).
 */
function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripTags(s) {
  return decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function parseRssItems(xml, limit = 20) {
  if (!xml) return [];
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || xml.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  blocks.slice(0, limit).forEach((block) => {
    const title = decodeEntities((block.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]);
    let link =
      decodeEntities((block.match(/<link[^>]*>([\s\S]*?)<\/link>/i) || [])[1]) ||
      ((block.match(/<link[^>]+href=["']([^"']+)["']/i) || [])[1]);
    const guid = decodeEntities((block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1]);
    const pubDate =
      decodeEntities((block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i) || [])[1]) ||
      decodeEntities((block.match(/<published[^>]*>([\s\S]*?)<\/published>/i) || [])[1]) ||
      decodeEntities((block.match(/<updated[^>]*>([\s\S]*?)<\/updated>/i) || [])[1]);
    const description =
      decodeEntities((block.match(/<description[^>]*>([\s\S]*?)<\/description>/i) || [])[1]) ||
      decodeEntities((block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i) || [])[1]) ||
      decodeEntities((block.match(/<content[^>]*>([\s\S]*?)<\/content>/i) || [])[1]);
    let imageUrl =
      ((block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i) || [])[1]) ||
      ((block.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["']image/i) || [])[1]) ||
      ((block.match(/<itunes:image[^>]+href=["']([^"']+)["']/i) || [])[1]);
    if (!imageUrl) {
      const imgInDesc = (description || '').match(/src=["']([^"']+)["']/i);
      if (imgInDesc) imageUrl = imgInDesc[1];
    }
    if (!title && !link) return;
    items.push({
      id: guid || link || title,
      title: stripTags(title),
      link: link || null,
      summary: stripTags(description).slice(0, 500),
      imageUrl: imageUrl || null,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString()
    });
  });
  return items;
}

module.exports = { parseRssItems, stripTags, decodeEntities };
