/* Fleet Compliance Desk: loads data/news.json (written by the daily GitHub Action) and renders the feeds. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
  var UPDATE_TYPES = ["New law", "Draft law", "Consultation", "Guidance update"];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function safeLink(url) { return /^https?:\/\//.test(url || "") ? url : "#"; }
  function isNew(iso) { return iso && (Date.now() - new Date(iso).getTime()) < 3 * 24 * 3600 * 1000; }
  function sectionOf(i) { return i.section || (UPDATE_TYPES.indexOf(i.type) >= 0 ? "updates" : "news"); }

  if ($("today")) {
    $("today").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function itemCard(i) {
    var a = el("a", "item"); a.href = safeLink(i.link); a.target = "_blank"; a.rel = "noopener";
    var m = el("div", "meta");
    var b = el("span", "badge", i.type || "News"); b.setAttribute("data-type", i.type || "News"); m.appendChild(b);
    m.appendChild(el("span", null, i.source));
    if (i.date) { var t = el("time", null, fmt.format(new Date(i.date))); t.dateTime = i.date; m.appendChild(t); }
    if (isNew(i.date)) m.appendChild(el("span", "new", "New"));
    a.appendChild(m);
    a.appendChild(el("h3", null, i.title));
    if (i.summary) a.appendChild(el("p", null, i.summary));
    var li = el("li"); li.appendChild(a);
    return li;
  }

  function fillList(ul, items, emptyText) {
    ul.textContent = "";
    if (!items.length) { ul.appendChild(el("li", "empty", emptyText)); return; }
    items.forEach(function (i) { ul.appendChild(itemCard(i)); });
  }

  function setupFeedPage(all) {
    var feed = $("feed");
    if (!feed) return;
    var section = feed.getAttribute("data-section");
    var items = all.filter(function (i) { return sectionOf(i) === section; });
    var key = section === "updates" ? "type" : "source";
    var options = ["All"];
    if (section === "updates") {
      UPDATE_TYPES.forEach(function (t) { if (items.some(function (i) { return i.type === t; })) options.push(t); });
    } else {
      items.forEach(function (i) { if (options.indexOf(i.source) < 0) options.push(i.source); });
    }
    var state = { pick: "All", q: "" };

    function render() {
      var q = state.q.toLowerCase();
      var list = items.filter(function (i) {
        if (state.pick !== "All" && i[key] !== state.pick) return false;
        return !q || (i.title + " " + (i.summary || "") + " " + i.source).toLowerCase().indexOf(q) >= 0;
      });
      if ($("count")) $("count").textContent = list.length + (list.length === 1 ? " item" : " items");
      fillList(feed, list, items.length
        ? "Nothing matches that. Try another word or filter."
        : "Nothing here yet. Items appear after the next morning update.");
    }

    var box = $("chips");
    if (box) {
      var drawChips = function () {
        box.textContent = "";
        options.forEach(function (o) {
          var c = el("button", "chip", o); c.type = "button";
          c.setAttribute("aria-pressed", String(o === state.pick));
          c.addEventListener("click", function () { state.pick = o; drawChips(); render(); });
          box.appendChild(c);
        });
      };
      drawChips();
    }
    if ($("q")) $("q").addEventListener("input", function (e) { state.q = e.target.value; render(); });
    render();
  }

  function renderStatus(feeds, section) {
    var ul = $("status");
    if (!ul) return;
    ul.textContent = "";
    (feeds || []).filter(function (f) { return !section || (f.section || "updates") === section; }).forEach(function (f) {
      var li = el("li");
      li.appendChild(el("span", null, f.source));
      li.appendChild(el("span", f.ok ? "ok" : "bad", f.ok ? f.count + " found" : "Unavailable"));
      ul.appendChild(li);
    });
  }

  // Works whether the site sits at the top of the repository or in a folder below it
  function load(paths) {
    if (!paths.length) return Promise.reject(new Error("not found"));
    return fetch(paths[0], { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return load(paths.slice(1)); });
  }

  var needsData = $("feed") || $("home-updates") || $("home-news") || $("updated");
  if (!needsData) return;

  load(["data/news.json", "../data/news.json"])
    .then(function (data) {
      var items = data.items || [];
      if ($("updated")) {
        $("updated").textContent = data.updated
          ? "Updated " + new Date(data.updated).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
          : "Live updates start after the first morning run";
      }
      if ($("home-updates")) fillList($("home-updates"), items.filter(function (i) { return sectionOf(i) === "updates"; }).slice(0, 4),
        "No law or guidance changes found yet. They appear after the next morning update.");
      if ($("home-news")) fillList($("home-news"), items.filter(function (i) { return sectionOf(i) === "news"; }).slice(0, 4),
        "No news yet. It appears after the next morning update.");
      setupFeedPage(items);
      var feed = $("feed");
      renderStatus(data.feeds, feed ? feed.getAttribute("data-section") : null);
    })
    .catch(function () {
      if ($("updated")) $("updated").textContent = "Couldn't load the latest updates";
      ["home-updates", "home-news", "feed"].forEach(function (id) {
        if ($(id)) fillList($(id), [], "Couldn't load the latest items. Try refreshing the page.");
      });
    });
})();
