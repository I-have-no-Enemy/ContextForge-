# UI checks

`npm run ui:check` drives the built site in a real Chromium and checks behaviour that unit tests cannot see: dialogs freezing the page behind them, the landing page returning to its place, keyboard focus after in-page jumps, heading structure on empty states, touch-target size, and the lane totals against the API.

It is read-only: it never signs in and never writes.

## Run

```bash
npm run build --workspace=frontend
npm run dev --workspace=backend            # API on :5000 (set RATE_LIMIT_PER_MIN=100000 to avoid 429s while checking)
cd frontend && npx vite preview --port 4173 # built site on :4173 (proxies /api to :5000)
npm run ui:check                            # all cases
npm run ui:check -- --only 3,4              # some cases
npm run ui:check -- --list
```

Chromium is found in `%LOCALAPPDATA%\ms-playwright` or `~/.cache/ms-playwright`; set `PLAYWRIGHT_EXECUTABLE_PATH` to use another browser. `BASE` and `API` override the two addresses.

## Cases

1. Dialog: Tab stays inside, wheel on the backdrop does not move the page, wheel inside scrolls the dialog, Esc closes and focus returns
2. Landing page returns to the same scroll position, tab and page after an item is opened (browser back and the Registry link, desktop and phone)
3. The "Browse N skills" jump moves keyboard focus into the registry
4. Full-page empty states (signed out, not found) have exactly one `h1`
5. Phone layout: footer above the dock, no sideways scroll, API docs reachable, one Sign in
6. Stand-alone controls are at least 24px tall (WCAG 2.5.8)
7. Lanes show 8 tiles or fewer and the totals match the API
8. A count of 1 reads "1 export", not "1 exports"
