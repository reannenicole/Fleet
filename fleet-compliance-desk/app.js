(function () {
  var state = { items: [], source: "All", q: "" };
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
  // Soft pastel per source, assigned in order of appearance
  var PALETTE = ["#8FB8F0", "#9FD8B0", "#F4A6A0", "#C9B3F2", "#F2CF8A", "#8ED6D4"];
  var colours = {};

  function colourFor(source) {
    if (!colours[source]) colours[source] = PALETTE[Object.keys(colours).length % PALETTE.length];
    return colours[source];
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function safeLink(url) { return /^https?:\/\//.test(url || "") ? url : "#"; }
  function isNew(iso) { return iso && (Date.now() - new Date(iso).getTime()) < 3 * 24 * 3600 * 1000; }

  function srcLabel(source) {
    var s = el("span", "src");
    var dot = el("span", "swatch"); dot.style.background = colourFor(source);
    s.appendChild(dot); s.appendChild(el("span", null, source));
    return s;
  }

  function meta(i) {
    var m = el("div", "meta");
    m.appendChild(srcLabel(i.source));
    if (i.date) { var t = el("time", null, fmt.format(new Date(i.date))); t.dateTime = i.date; m.appendChild(t); }
    if (isNew(i.date)) m.appendChild(el("span", "new", "New"));
    return m;
  }

  function renderChips() {
    var sources = ["All"];
    state.items.forEach(function (i) { if (sources.indexOf(i.source) < 0) sources.push(i.source); });
    var box = $("chips"); box.textContent = "";
    sources.forEach(function (s) {
      var b = el("button", "chip"); b.type = "button";
      if (s !== "All") { var d = el("span", "swatch"); d.style.background = colourFor(s); b.appendChild(d); }
      b.appendChild(el("span", null, s));
      b.setAttribute("aria-pressed", String(s === state.source));
      b.addEventListener("click", function () { state.source = s; renderChips(); render(); });
      box.appendChild(b);
    });
  }

  function render() {
    var q = state.q.toLowerCase();
    var list = state.items.filter(function (i) {
      if (state.source !== "All" && i.source !== state.source) return false;
      return !q || (i.title + " " + (i.summary || "")).toLowerCase().indexOf(q) >= 0;
    });
    var lead = $("lead"), ol = $("articles");
    lead.textContent = ""; ol.textContent = "";

    if (!list.length) {
      $("count").textContent = "";
      ol.appendChild(el("li", "empty", state.items.length
        ? "Nothing matches that. Try another word or source."
        : "No headlines yet. They'll appear after the first morning update."));
      return;
    }

    var top = list[0];
    var a = el("a", "lead"); a.href = safeLink(top.link); a.target = "_blank"; a.rel = "noopener";
    a.style.setProperty("--tint", colourFor(top.source));
    a.appendChild(el("div", "kicker", "Lead story"));
    a.appendChild(meta(top));
    a.appendChild(el("h3", null, top.title));
    if (top.summary) a.appendChild(el("p", null, top.summary));
    a.appendChild(el("span", "more", "Read the full story →"));
    lead.appendChild(a);

    var rest = list.slice(1);
    $("count").textContent = rest.length ? "More headlines · " + rest.length : "";
    rest.forEach(function (i) {
      var li = el("li");
      var c = el("a", "card"); c.href = safeLink(i.link); c.target = "_blank"; c.rel = "noopener";
      c.appendChild(meta(i));
      c.appendChild(el("h3", null, i.title));
      if (i.summary) c.appendChild(el("p", null, i.summary));
      li.appendChild(c); ol.appendChild(li);
    });
  }

  function renderStatus(feeds) {
    var ul = $("status"); ul.textContent = "";
    (feeds || []).forEach(function (f) {
      var li = el("li");
      li.appendChild(srcLabel(f.source));
      li.appendChild(el("span", f.ok ? "ok" : "bad", f.ok ? f.count + " stories" : "Unavailable"));
      ul.appendChild(li);
    });
  }

  $("today").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  $("q").addEventListener("input", function (e) { state.q = e.target.value; render(); });

  // Works whether the page sits at the top of the repository or inside a folder
  function load(paths) {
    if (!paths.length) return Promise.reject(new Error("not found"));
    return fetch(paths[0], { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .catch(function () { return load(paths.slice(1)); });
  }

  // The daily update writes to the repository's top-level data folder, so try that first
  load(["../data/news.json", "data/news.json"])
    .then(function (data) {
      state.items = data.items || [];
      state.items.forEach(function (i) { colourFor(i.source); });
      $("updated").textContent = data.updated
        ? "Updated " + new Date(data.updated).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
        : "Not updated yet";
      renderStatus(data.feeds); renderChips(); render();
    })
    .catch(function () { $("updated").textContent = "Couldn't load headlines"; renderChips(); render(); });
})();
