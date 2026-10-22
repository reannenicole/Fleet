(function () {
  var state = { items: [], source: "All", q: "" };
  var $ = function (id) { return document.getElementById(id); };
  var fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function isNew(iso) {
    return iso && (Date.now() - new Date(iso).getTime()) < 3 * 24 * 3600 * 1000;
  }

  function renderChips() {
    var sources = ["All"];
    state.items.forEach(function (i) { if (sources.indexOf(i.source) < 0) sources.push(i.source); });
    var box = $("chips"); box.textContent = "";
    sources.forEach(function (s) {
      var b = el("button", "chip", s);
      b.type = "button";
      b.setAttribute("aria-pressed", String(s === state.source));
      b.addEventListener("click", function () { state.source = s; renderChips(); renderList(); });
      box.appendChild(b);
    });
  }

  function renderList() {
    var q = state.q.toLowerCase();
    var list = state.items.filter(function (i) {
      if (state.source !== "All" && i.source !== state.source) return false;
      return !q || (i.title + " " + (i.summary || "")).toLowerCase().indexOf(q) >= 0;
    });
    var ol = $("articles"); ol.textContent = "";
    $("count").textContent = list.length + (list.length === 1 ? " headline" : " headlines");
    if (!list.length) {
      ol.appendChild(el("li", "empty", state.items.length
        ? "Nothing matches that search. Try a different word or source."
        : "No headlines yet. They appear after the first daily update runs."));
      return;
    }
    list.forEach(function (i) {
      var li = el("li", "article");
      var meta = el("div", "meta");
      if (i.tag) meta.appendChild(el("span", "tag", i.tag));
      meta.appendChild(el("span", null, i.source));
      if (i.date) {
        var t = el("time", null, fmt.format(new Date(i.date)));
        t.dateTime = i.date; meta.appendChild(t);
      }
      if (isNew(i.date)) meta.appendChild(el("span", "new", "New"));
      li.appendChild(meta);
      var h = el("h3"); var a = el("a", null, i.title);
      a.href = /^https?:\/\//.test(i.link) ? i.link : "#";
      a.target = "_blank"; a.rel = "noopener";
      h.appendChild(a); li.appendChild(h);
      if (i.summary) li.appendChild(el("p", null, i.summary));
      ol.appendChild(li);
    });
  }

  function renderStatus(feeds) {
    var ul = $("status"); ul.textContent = "";
    (feeds || []).forEach(function (f) {
      var li = el("li");
      li.appendChild(el("span", null, f.source));
      li.appendChild(el("span", f.ok ? "ok" : "bad", f.ok ? f.count + " items" : "Unavailable"));
      ul.appendChild(li);
    });
  }

  $("q").addEventListener("input", function (e) { state.q = e.target.value; renderList(); });

  fetch("data/news.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      state.items = data.items || [];
      $("updated").textContent = data.updated
        ? "Updated " + new Date(data.updated).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
        : "Not updated yet";
      renderStatus(data.feeds); renderChips(); renderList();
    })
    .catch(function () {
      $("updated").textContent = "Couldn't load headlines";
      renderChips(); renderList();
    });
})();
