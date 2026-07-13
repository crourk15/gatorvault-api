import { pathToFileURL } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err && err.code !== 'ERR_MODULE_NOT_FOUND') throw err;
    const parent = context.parentURL || '';
    if (!parent.includes('client/lib') && !specifier.startsWith('.')) throw err;
    const base = new URL(specifier, parent);
    const candidates = [
      base.href,
      `${base.href}.ts`,
      `${base.href}.tsx`,
      new URL('index.ts', base.href.endsWith('/') ? base.href : `${base.href}/`).href,
    ];
    for (const url of candidates) {
      try {
        return await nextResolve(url, { ...context, parentURL: parent });
      } catch (e) {
        if (e && e.code !== 'ERR_MODULE_NOT_FOUND') throw e;
      }
    }
    throw err;
  }
}
