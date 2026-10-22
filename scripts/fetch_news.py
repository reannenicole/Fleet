"""Fetch the feeds in feeds.json, keep only fleet law and regulation items, and write data/news.json.

Standard library only, so the GitHub Action needs no installs.
- Each feed can have an "include" word list: an item is kept only if its title matches one of the words.
- The top-level "exclude" list drops noise such as local road closure orders.
- Words ending in * match as prefixes (licen* matches licence and licensing).
- Items from earlier runs are kept for max_age_days, so the page builds up a year of changes.
A feed that fails is skipped and reported; the site keeps working.
"""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ATOM = "{http://www.w3.org/2005/Atom}"
UA = "Mozilla/5.0 (compatible; FleetComplianceDesk/2.0; +https://github.com)"


def clean(text, limit=280):
    text = unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def normalise(text):
    return (text or "").lower().replace("’", "'").replace("‘", "'")


def compile_words(words):
    pats = []
    for w in words:
        w = normalise(w)
        if w.endswith("*"):
            pats.append(r"(?<![a-z])" + re.escape(w[:-1]))
        else:
            pats.append(r"(?<![a-z])" + re.escape(w) + r"(?![a-z])")
    return re.compile("|".join(pats)) if pats else None


def parse_date(value):
    if not value:
        return None
    value = str(value).strip()
    try:
        d = parsedate_to_datetime(value)
    except (TypeError, ValueError):
        try:
            d = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)


def parse(xml_bytes):
    root = ET.fromstring(xml_bytes)
    items = []
    if root.tag == f"{ATOM}feed":
        for e in root.findall(f"{ATOM}entry"):
            link = ""
            for l in e.findall(f"{ATOM}link"):
                if l.get("rel", "alternate") == "alternate":
                    link = l.get("href", ""); break
            items.append({
                "title": clean(e.findtext(f"{ATOM}title"), 220),
                "link": link,
                "summary": clean(e.findtext(f"{ATOM}summary") or e.findtext(f"{ATOM}content")),
                "date": parse_date(e.findtext(f"{ATOM}published") or e.findtext(f"{ATOM}updated")),
            })
    else:
        for e in root.iter("item"):
            items.append({
                "title": clean(e.findtext("title"), 220),
                "link": (e.findtext("link") or "").strip(),
                "summary": clean(e.findtext("description")),
                "date": parse_date(e.findtext("pubDate") or e.findtext("{http://purl.org/dc/elements/1.1/}date")),
            })
    return [i for i in items if i["title"] and i["link"]]


def main():
    cfg = json.loads((ROOT / "feeds.json").read_text(encoding="utf-8"))
    lists = cfg.get("word_lists", {})
    exclude = compile_words(cfg.get("exclude", []))
    keep_anyway = compile_words(cfg.get("keep_anyway", []))  # beats exclude, e.g. a testing law that also mentions tachographs
    cutoff = datetime.now(timezone.utc) - timedelta(days=cfg.get("max_age_days", 365))

    feeds = {}
    for f in cfg["feeds"]:
        inc = f.get("include")
        words = lists.get(inc, []) if isinstance(inc, str) else (inc or [])
        feeds[f["name"]] = (f, compile_words(words))

    def keep(item, feed_name):
        f, inc = feeds[feed_name]
        title = normalise(item["title"])
        if exclude and exclude.search(title) and not (keep_anyway and keep_anyway.search(title)):
            return False
        return inc is None or bool(inc.search(title))

    fresh, report = [], []
    for name, (f, _) in feeds.items():
        try:
            items = []
            for url in (f["url"] if isinstance(f["url"], list) else [f["url"]]):  # a feed can list several pages
                req = urllib.request.Request(url, headers={"User-Agent": UA})
                with urllib.request.urlopen(req, timeout=30) as r:
                    items.extend(parse(r.read()))
            kept = [i for i in items if keep(i, name)]
            for i in kept:
                i["source"] = name
                i["type"] = f.get("type", "")
                i["section"] = f.get("section", "updates")
            report.append({"source": name, "type": f.get("type", ""), "section": f.get("section", "updates"),
                           "ok": True, "checked": len(items), "count": len(kept)})
            fresh.extend(kept)
        except Exception as exc:  # one bad feed must not break the rest
            report.append({"source": name, "type": f.get("type", ""), "section": f.get("section", "updates"),
                           "ok": False, "error": str(exc)[:200]})
            print(f"WARN {name}: {exc}", file=sys.stderr)

    # Carry forward earlier items from feeds still configured, re-checked against today's filters
    previous = []
    prev_path = ROOT / "data" / "news.json"
    if prev_path.exists():
        try:
            for p in json.loads(prev_path.read_text(encoding="utf-8")).get("items", []):
                if p.get("source") in feeds and keep(p, p["source"]):
                    f = feeds[p["source"]][0]
                    p["date"] = parse_date(p.get("date"))
                    p["type"] = f.get("type", "")
                    p["section"] = f.get("section", "updates")
                    previous.append(p)
        except (ValueError, KeyError):
            pass

    merged = {}
    for it in fresh + previous:  # fresh wins over older copies of the same link
        if it["link"] not in merged:
            merged[it["link"]] = it

    oldest = datetime.min.replace(tzinfo=timezone.utc)
    out = []
    for it in sorted(merged.values(), key=lambda i: i["date"] or oldest, reverse=True):
        if it["date"] and it["date"] < cutoff:
            continue
        it["date"] = it["date"].isoformat() if it["date"] else None
        out.append(it)
    out = out[: cfg.get("max_items", 200)]

    data = {"updated": datetime.now(timezone.utc).isoformat(timespec="minutes"), "feeds": report, "items": out}
    (ROOT / "data").mkdir(exist_ok=True)
    prev_path.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(out)} items ({len(fresh)} new today) from {sum(1 for r in report if r['ok'])}/{len(report)} feeds")


if __name__ == "__main__":
    main()
