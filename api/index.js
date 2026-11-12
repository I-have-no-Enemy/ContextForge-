/**
 * Vercel Function entry: the whole Express API behind one function.
 *
 * vercel.json rewrites /api/(.*) to this file, so req.url keeps the original path (/api/v1/...)
 * and the Express router in backend/src/routes sees the same URLs as in development.
 *
 * Why CommonJS with a dynamic import: the backend is compiled ES modules (backend/dist, built by
 * `npm run build` in vercel.json's buildCommand). A static `import` of a path that only exists after
 * the build would break `vercel dev` before the build, and the literal path in `import()` is still
 * traced by Vercel's file tracer so the compiled backend ships with the function.
 */
let appPromise;

function loadApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { createApp } = await import('../backend/dist/app.js');
      const { getJwtSecret } = await import('../backend/dist/config/env.js');
      getJwtSecret(); // fail on a missing or weak JWT_SECRET at cold start, with a clear log line
      // The site itself is served by Vercel's CDN from frontend/dist, so Express serves only the API.
      return createApp({ webRoot: null });
    })();
    // a failed cold start must not be cached forever
    appPromise.catch(() => {
      appPromise = undefined;
    });
  }
  return appPromise;
}

/**
 * Vercel's Node helpers can parse the request body lazily (req.body getter) and that consumes the
 * stream, after which express.json() would read nothing. Replace the lazy getter with a plain empty
 * property so body-parser reads the stream itself. If the platform already parsed the body into a
 * plain property, tell body-parser to keep it.
 */
function leaveBodyToExpress(req) {
  const d = Object.getOwnPropertyDescriptor(req, 'body');
  if (d && typeof d.get === 'function') {
    Object.defineProperty(req, 'body', { value: undefined, writable: true, configurable: true, enumerable: true });
  } else if (d && d.value !== undefined && d.value !== null) {
    req._body = true;
  }
}

module.exports = async function handler(req, res) {
  leaveBodyToExpress(req);
  const app = await loadApp();
  return app(req, res);
};

// Same intent as the helper override above, for runtimes that read this export.
module.exports.config = { api: { bodyParser: false } };
