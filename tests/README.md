# Prayer Dome tests

Lightweight checks with no build step and no CI required.

## Run them

```bash
# 1. Prayer Assistant topic matcher (pure logic, no dependencies)
node tests/assistant.test.js

# 2. Page behaviour — DOM rendering, save/remove, XSS escaping, crisis path
npm install --no-save jsdom
node tests/pages.test.js

# 3. SEO drift — fails if any page's managed <head> block is out of date
python3 seo/apply-seo.py --check
```

Each script exits non-zero on failure, so they drop straight into a CI job or a
pre-commit hook if you ever want one.

## What is covered

**`assistant.test.js`** — 21 assertions that real user phrasings route to the right
topic ("my mother passed away" → grief, "i lost my job and cant pay rent" →
provision), that gibberish falls back to the general prayer rather than guessing,
and that the crisis flag fires on self-harm language but not on ordinary sadness.

**`pages.test.js`** — 36 assertions run against the real HTML in jsdom: topic chips
render, asking a question produces scriptures + prayer points + a written prayer,
saved prayers round-trip through localStorage, the dark-mode toggle persists, and
user input is escaped so `<img src=x onerror=...>` cannot inject. It also asserts
`live.html` contains every element id the Firebase module binds to — that catches a
renamed id that would otherwise silently break the page at runtime.

## Note on `live.html`

`live.html` uses `<script type="module">` with live Firebase imports, which jsdom
cannot execute. The tests therefore verify its **structure** (every id the script
touches exists) rather than its runtime behaviour. The Firestore reads/writes need a
real browser against the live project to exercise fully.
