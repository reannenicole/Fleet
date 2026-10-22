"""Fetch the RSS/Atom feeds listed in feeds.json and write data/news.json."""
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
UA = "Mozilla/5.0 (compatible; FleetComplianceDesk/1.0; +https://github.com)"


def clean(text, limit=280):
    text = unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def parse_date(value):
    if not value:
        return None
    value = value.strip()
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


def parse(xml_bytes, feed):
    root = ET.fromstring(xml_bytes)
    items = []
    if root.tag == f"{ATOM}feed":
        for e in root.findall(f"{ATOM}entry"):
            link = ""
            for l in e.findall(f"{ATOM}link"):
                if l.get("rel", "alternate") == "alternate":
                    link = l.get("href", ""); break
            items.append({
                "title": clean(e.findtext(f"{ATOM}title"), 200),
                "link": link,
                "summary": clean(e.findtext(f"{ATOM}summary") or e.findtext(f"{ATOM}content")),
                "date": parse_date(e.findtext(f"{ATOM}published") or e.findtext(f"{ATOM}updated")),
            })
    else:
        for e in root.iter("item"):
            items.append({
                "title": clean(e.findtext("title"), 200),
                "link": (e.findtext("link") or "").strip(),
                "summary": clean(e.findtext("description")),
                "date": parse_date(e.findtext("pubDate") or e.findtext("{http://purl.org/dc/elements/1.1/}date")),
            })
    for it in items:
        it["source"] = feed["name"]
        it["tag"] = feed.get("tag", "")
    return [i for i in items if i["title"] and i["link"]]


def main():
    cfg = json.loads((ROOT / "feeds.json").read_text(encoding="utf-8"))
    cutoff = datetime.now(timezone.utc) - timedelta(days=cfg.get("max_age_days", 120))
    all_items, report = [], []
    for feed in cfg["feeds"]:
        try:
            req = urllib.request.Request(feed["url"], headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                items = parse(r.read(), feed)
            report.append({"source": feed["name"], "ok": True, "count": len(items)})
            all_items.extend(items)
        except Exception as exc:
            report.append({"source": feed["name"], "ok": False, "error": str(exc)[:200]})
            print(f"WARN {feed['name']}: {exc}", file=sys.stderr)

    seen, out = set(), []
    for it in sorted(all_items, key=lambda i: i["date"] or datetime.min.replace(tzinfo=timezone.utc), reverse=True):
        if it["link"] in seen or (it["date"] and it["date"] < cutoff):
            continue
        seen.add(it["link"])
        it["date"] = it["date"].isoformat() if it["date"] else None
        out.append(it)
    out = out[: cfg.get("max_items", 120)]

    data = {"updated": datetime.now(timezone.utc).isoformat(timespec="minutes"), "feeds": report, "items": out}
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data" / "news.json").write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(out)} items from {sum(1 for r in report if r['ok'])}/{len(report)} feeds")


if __name__ == "__main__":
    main()
