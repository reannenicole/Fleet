# Fleet Compliance Desk

A small news site with daily UK fleet compliance and vehicle safety headlines from official sources (DVSA, the Traffic Commissioners and the Department for Transport). It runs free on GitHub Pages and updates itself every morning.

## How it works

- `feeds.json`: the list of news feeds. Add or remove feeds here.
- `scripts/fetch_news.py`: fetches every feed and writes `data/news.json`.
- `.github/workflows/update-news.yml`: runs that script every day at 06:15 UTC and saves the result.
- `index.html`, `style.css`, `app.js`: the page itself. It reads `data/news.json`.

## Set it up (about 10 minutes)

1. **Create the repository.** On GitHub, click **New**, name it something like `fleet-compliance-desk`, set it to **Public**, and create it.
2. **Upload the files.** Click **Add file → Upload files**, then drag in everything from this folder, keeping the folders as they are. The `.github` folder is hidden on some computers. If you can't see it, create the file on GitHub instead: **Add file → Create new file**, type `.github/workflows/update-news.yml` as the name, and paste in the contents.
3. **Turn on Pages.** Go to **Settings → Pages**. Under "Build and deployment", choose **Deploy from a branch**, select `main` and `/ (root)`, then click **Save**.
4. **Allow the daily update to save.** Go to **Settings → Actions → General → Workflow permissions**, choose **Read and write permissions**, then click **Save**.
5. **Run the first update.** Go to the **Actions** tab, click **Update news**, then **Run workflow**. After about a minute, the live headlines replace the starter ones.

Your site will be at `https://<your-username>.github.io/fleet-compliance-desk/`.

## Adding a source

Add an entry to `feeds.json` with a name, a tag and an RSS or Atom feed URL, then commit. The update runs automatically. If a feed ever stops working, the site keeps going and the Sources panel shows it as "Unavailable".

Most GOV.UK organisations have a feed in this format:
`https://www.gov.uk/search/news-and-communications.atom?organisations%5B%5D=<organisation-slug>`
