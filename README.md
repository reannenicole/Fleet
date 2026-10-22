# Fleet Compliance Desk

A plain-English handbook of the fleet compliance rules in Great Britain: guides, key numbers, official tools and a glossary, plus law updates and fleet news gathered automatically every morning.

It's general guidance, not legal advice. Every guide links to its official sources.

## What's in this repository

| File or folder | What it is |
| --- | --- |
| `index.html` | Home page |
| `guides.html` and `guide-*.html` | The guides |
| `reference.html` | Key numbers, defect gradings, official tools and glossary |
| `updates.html` | Law and guidance updates (filled in automatically) |
| `news.html` | Fleet news (filled in automatically) |
| `style.css`, `site.js` | The look of the site, and the code that shows the updates |
| `feeds.json` | Which sources are checked, and the words used to filter them |
| `scripts/fetch_news.py` | The script that checks the sources |
| `data/news.json` | Written by the robot every morning. Don't edit it by hand |
| `.github/workflows/update-news.yml` | Runs the script every morning at about 06:15 UTC |

## How the updates work

Every morning, GitHub runs `scripts/fetch_news.py`. It reads the sources in `feeds.json`:

- New laws, Acts and draft laws from legislation.gov.uk
- Guidance, consultations and news from DVSA, DVLA, the Traffic Commissioners and the Department for Transport on GOV.UK
- DVSA's Moving On blog

It keeps only items whose titles match the fleet word lists, drops noise such as local road closure orders, and saves the results to `data/news.json`. Items are kept for a year, so the updates page builds up over time.

To run it straight away: **Actions → Update news → Run workflow**.

## Changing what gets collected

Edit `feeds.json`:

- `word_lists` are the words an item's title must contain to be kept. A word ending in `*` matches anything starting with it, so `tachograph*` matches tachograph and tachographs.
- `exclude` drops any item whose title contains one of those words.
- Each feed has a `name`, a `section` (`updates` or `news`), a `type` (the label shown on the site), a `url` (or a list of URLs, to read more than one page) and an optional `include` list.

Saving a change to `feeds.json` runs the update automatically.

## Editing a guide

1. Open the guide's file, for example `guide-tyres-speed-limiters.html`, and select the pencil icon.
2. Change the text between the tags. Keep the tags themselves (`<li>`, `<strong>` and so on) as they are.
3. Update the "Last checked" date near the top.
4. Select **Commit changes**.

The site updates within a minute or two.
