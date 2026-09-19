/* UESTC 832 study site — client behaviour (progress, nav, TOC, search). */
(function () {
  'use strict';

  var SITE = window.__SITE__ || { prefix: '', total: 0 };
  var STORE_KEY = 'ue832:mastered';

  /* ------------------------------------------------------------- progress */

  function loadDone() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return new Set();
    }
  }

  function saveDone(set) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(Array.from(set)));
    } catch (e) {
      /* storage disabled — progress simply won't persist */
    }
  }

  var done = loadDone();

  function paintProgress() {
    var total = SITE.total || 0;
    var pct = total ? Math.round((done.size / total) * 100) : 0;
    var ring = document.querySelector('[data-progress-ring]');
    if (ring) {
      ring.style.setProperty('--p', pct);
      var label = ring.querySelector('span');
      if (label) label.textContent = pct + '%';
    }
    var count = document.querySelector('[data-progress-count]');
    if (count) count.textContent = String(done.size);
  }

  function paintChecks() {
    document.querySelectorAll('[data-check]').forEach(function (box) {
      var on = done.has(box.getAttribute('data-check'));
      box.classList.toggle('is-done', on);
      box.setAttribute('aria-checked', on ? 'true' : 'false');
    });
  }

  function toggle(id) {
    if (done.has(id)) done.delete(id);
    else done.add(id);
    saveDone(done);
    paintChecks();
    paintProgress();
  }

  document.addEventListener('click', function (ev) {
    var box = ev.target.closest('[data-check]');
    if (box) {
      ev.preventDefault();
      ev.stopPropagation();
      toggle(box.getAttribute('data-check'));
      return;
    }
    var reset = ev.target.closest('[data-progress-reset]');
    if (reset) {
      if (window.confirm('清空全部「已掌握」标记？')) {
        done = new Set();
        saveDone(done);
        paintChecks();
        paintProgress();
      }
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    var box = ev.target.closest('[data-check]');
    if (box) {
      ev.preventDefault();
      toggle(box.getAttribute('data-check'));
    }
  });

  /* ------------------------------------------------------- groups & search */

  document.querySelectorAll('.nav-group-title').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.nav-group');
      group.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', group.classList.contains('is-open') ? 'true' : 'false');
    });
  });

  var search = document.getElementById('navSearch');
  if (search) {
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      document.querySelectorAll('.nav-group').forEach(function (group) {
        var visible = 0;
        group.querySelectorAll('.nav-item').forEach(function (item) {
          var hay = (item.textContent || '').toLowerCase();
          var hit = !q || hay.indexOf(q) !== -1;
          item.style.display = hit ? '' : 'none';
          if (hit) visible += 1;
        });
        group.style.display = !q || visible ? '' : 'none';
        if (q) group.classList.add('is-open');
      });
    });
  }

  /* -------------------------------------------------------------- sidebar */

  var sidebar = document.getElementById('sidebar');
  function closeSidebar() { if (sidebar) sidebar.classList.remove('is-open'); }
  var menuBtn = document.querySelector('.menu-btn');
  if (menuBtn && sidebar) menuBtn.addEventListener('click', function () { sidebar.classList.add('is-open'); });
  var closeBtn = document.querySelector('.sidebar-close');
  if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
  document.addEventListener('click', function (ev) {
    if (window.innerWidth > 900) return;
    if (!sidebar || !sidebar.classList.contains('is-open')) return;
    if (sidebar.contains(ev.target) || (menuBtn && menuBtn.contains(ev.target))) return;
    closeSidebar();
  });

  /* -------------------------------------------------- tables / scroll state */

  document.querySelectorAll('.article table').forEach(function (table) {
    if (table.parentElement && table.parentElement.classList.contains('table-wrap')) return;
    var wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    table.parentNode.insertBefore(wrap, table);
    wrap.appendChild(table);
  });

  var bar = document.querySelector('[data-scroll-progress]');
  var backTop = document.querySelector('[data-back-top]');
  function onScroll() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
    if (bar) bar.style.width = pct.toFixed(2) + '%';
    if (backTop) backTop.classList.toggle('is-visible', h.scrollTop > 600);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (backTop) {
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* ------------------------------------------------- TOC active highlighting */

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"]'));
  if (tocLinks.length) {
    var headings = tocLinks
      .map(function (a) {
        var id = decodeURIComponent(a.getAttribute('href').slice(1));
        var el = document.getElementById(id);
        return el ? { el: el, link: a } : null;
      })
      .filter(Boolean);

    var obs = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          headings.forEach(function (h) { h.link.classList.remove('is-current'); });
          var hit = headings.find(function (h) { return h.el === entry.target; });
          if (hit) hit.link.classList.add('is-current');
        });
      },
      { rootMargin: '-72px 0px -72% 0px', threshold: 0 }
    );
    headings.forEach(function (h) { obs.observe(h.el); });
  }

  /* --------------------------------------------- in-page search (⌘/Ctrl + K) */

  var indexCache = null;
  function loadIndex() {
    if (indexCache) return Promise.resolve(indexCache);
    if (Array.isArray(window.__SEARCH_INDEX__)) {
      indexCache = window.__SEARCH_INDEX__;
      return Promise.resolve(indexCache);
    }
    return fetch(SITE.searchIndex)
      .then(function (r) { return r.json(); })
      .then(function (data) { indexCache = data; return data; })
      .catch(function () { indexCache = []; return indexCache; });
  }

  function makeOverlay() {
    var el = document.createElement('div');
    el.className = 'search-overlay';
    el.innerHTML =
      '<div class="search-panel" role="dialog" aria-modal="true" aria-label="站内搜索">' +
      '<input type="search" id="siteSearchInput" placeholder="搜索全站考点，例如：耗尽区宽度 / 雪崩击穿 / Webster" autocomplete="off">' +
      '<div class="search-results" id="siteSearchResults"></div>' +
      '<div class="search-hint">Esc 关闭 · Enter 打开第一条</div></div>';
    document.body.appendChild(el);
    el.addEventListener('click', function (ev) { if (ev.target === el) closeSearch(); });
    return el;
  }

  var overlay = null;
  function openSearch() {
    if (!overlay) overlay = makeOverlay();
    overlay.classList.add('is-open');
    var input = overlay.querySelector('#siteSearchInput');
    input.value = '';
    input.focus();
    renderResults('');
    loadIndex().then(function () { renderResults(input.value); });
  }
  function closeSearch() { if (overlay) overlay.classList.remove('is-open'); }

  function renderResults(q) {
    var box = overlay.querySelector('#siteSearchResults');
    if (!indexCache) { box.innerHTML = '<p class="search-empty">载入中…</p>'; return; }
    var query = q.trim().toLowerCase();
    var hits = [];
    indexCache.forEach(function (page) {
      if (!query) {
        hits.push({ href: page.href, title: page.title, sub: page.group, text: '' });
        return;
      }
      var inTitle = page.title.toLowerCase().indexOf(query) !== -1;
      var pos = page.text.toLowerCase().indexOf(query);
      var heading = page.toc.find(function (t) { return t.text.toLowerCase().indexOf(query) !== -1; });
      if (!inTitle && pos === -1 && !heading) return;
      var snippet = '';
      if (pos !== -1) {
        var from = Math.max(0, pos - 45);
        snippet = (from > 0 ? '…' : '') + page.text.slice(from, pos + 90) + '…';
      }
      hits.push({
        href: heading ? page.href.replace(/\.html$/, '.html') + '#' + encodeURIComponent(heading.id) : page.href,
        title: page.title,
        sub: heading ? '小节：' + heading.text : page.group,
        text: snippet,
        score: (inTitle ? 3 : 0) + (heading ? 2 : 0) + (pos !== -1 ? 1 : 0),
      });
    });
    hits.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
    if (!hits.length) { box.innerHTML = '<p class="search-empty">没有匹配结果</p>'; return; }
    box.innerHTML = hits
      .slice(0, 30)
      .map(function (h) {
        return (
          '<a class="search-hit" href="' + SITE.prefix + h.href + '"><strong>' + h.title +
          '</strong><small>' + h.sub + '</small>' +
          (h.text ? '<span>' + h.text.replace(/</g, '&lt;') + '</span>' : '') +
          '</a>'
        );
      })
      .join('');
  }

  document.addEventListener('keydown', function (ev) {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      openSearch();
      return;
    }
    if (!overlay || !overlay.classList.contains('is-open')) return;
    if (ev.key === 'Escape') { closeSearch(); return; }
    if (ev.key === 'Enter') {
      var first = overlay.querySelector('.search-hit');
      if (first) window.location.href = first.getAttribute('href');
    }
  });
  document.querySelectorAll('[data-open-search]').forEach(function (btn) {
    btn.addEventListener('click', openSearch);
  });

  // expose for the search panel wiring after it is created
  var liveSearchInput = null;
  document.addEventListener('input', function (ev) {
    if (ev.target && ev.target.id === 'siteSearchInput') {
      liveSearchInput = ev.target;
      renderResults(ev.target.value);
    }
  });

  paintChecks();
  paintProgress();

  /* -------------------------------------------------- article task lists */

  var taskBoxes = Array.prototype.slice.call(
    document.querySelectorAll('.article li > input[type="checkbox"]')
  );
  if (taskBoxes.length) {
    var taskKey = 'ue832:tasks:' + (document.body.getAttribute('data-page-id') || 'page');
    var taskState = {};
    try { taskState = JSON.parse(localStorage.getItem(taskKey) || '{}') || {}; } catch (e) { taskState = {}; }

    var bar2 = document.querySelector('[data-check-progress]');
    function paintTasks() {
      var doneCount = taskBoxes.filter(function (b) { return b.checked; }).length;
      if (bar2) {
        var pct = Math.round((doneCount / taskBoxes.length) * 100);
        bar2.innerHTML =
          '<strong>本页清单进度：' + doneCount + ' / ' + taskBoxes.length + '（' + pct + '%）</strong>' +
          '<span class="check-bar"><i style="width:' + pct + '%"></i></span>';
      }
    }
    taskBoxes.forEach(function (box, i) {
      box.disabled = false;
      box.checked = !!taskState[i];
      box.addEventListener('change', function () {
        taskState[i] = box.checked;
        try { localStorage.setItem(taskKey, JSON.stringify(taskState)); } catch (e) { /* ignore */ }
        paintTasks();
      });
    });
    paintTasks();
  }
})();
