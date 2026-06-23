/**
 * 前三排 · 学习小组 — 客户端搜索
 * 基于 articles.json + fulltext.json 实现实时全文搜索
 */
(function () {
  'use strict';

  var articles = [];
  var fulltextMap = {}; // slug -> full text
  var fulltextLoaded = false;
  var searchInput = null;
  var mainContent = null;
  var resultCount = null;
  var allYearSections = null;
  var debounceTimer = null;

  function init() {
    searchInput = document.getElementById('search-input');
    mainContent = document.querySelector('.main-content');
    if (!searchInput || !mainContent) return;

    allYearSections = mainContent.querySelectorAll('.year-section');
    resultCount = document.createElement('div');
    resultCount.className = 'search-result-count';
    resultCount.style.display = 'none';
    mainContent.insertBefore(resultCount, mainContent.firstChild);

    // 快速加载元数据
    fetch('articles.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { articles = d; })
      .catch(function () {});

    searchInput.addEventListener('input', onSearchInput);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { searchInput.value = ''; clearSearch(); }
    });

    // 标签点击
    var filterTags = document.querySelectorAll('.filter-tag');
    filterTags.forEach(function (tag) {
      tag.addEventListener('click', function (e) {
        var filter = this.getAttribute('data-filter');
        if (!filter) return;
        e.preventDefault();
        onTagClick(filter, this);
      });
    });
  }

  // ============ 搜索 ============
  var currentTag = null;

  function onSearchInput() {
    // 首次搜索时懒加载全文索引
    if (!fulltextLoaded) {
      fulltextLoaded = true;
      fetch('fulltext.json')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          data.forEach(function (doc) {
            fulltextMap[doc.slug] = doc.fulltext || doc.excerpt || '';
          });
          // 加载完后立即执行当前搜索
          doSearch();
        })
        .catch(function () {});
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 250);
  }

  function doSearch() {
    var query = searchInput.value.trim();
    if (!query) { clearSearch(); return; }
    if (!articles.length) return;

    var terms = query.split(/\s+/).filter(Boolean);
    if (!terms.length) { clearSearch(); return; }

    // 全文评分
    var scored = [];
    articles.forEach(function (a, idx) {
      var score = 0;
      var title = (a.title || '').toLowerCase();
      var ft = (fulltextMap[a.slug] || a.excerpt || '').toLowerCase();

      terms.forEach(function (t) {
        var tl = t.toLowerCase();
        if (title.indexOf(tl) !== -1) score += 15;
        var regex = new RegExp(tl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        score += (ft.match(regex) || []).length * 2;
      });

      if (score > 0) scored.push({ idx: idx, score: score });
    });

    scored.sort(function (a, b) { return b.score - a.score; });

    var results = scored.map(function (s) { return articles[s.idx]; });
    renderResults(results, query);
  }

  function renderResults(results, query) {
    resultCount.style.display = 'block';
    resultCount.innerHTML = '找到 <strong>' + results.length + '</strong> 篇';

    allYearSections.forEach(function (s) { s.style.display = 'none'; });
    var old = mainContent.querySelectorAll('.search-results');
    old.forEach(function (el) { el.remove(); });

    if (!results.length) {
      var empty = document.createElement('div');
      empty.className = 'search-no-results search-results';
      empty.innerHTML = '<div class="no-results-icon">🔍</div><p>没有找到相关内容</p><p class="no-results-hint">试试换个关键词，或按 <kbd>Esc</kbd> 清除</p>';
      mainContent.appendChild(empty);
      return;
    }

    var byYear = {};
    results.forEach(function (a) {
      var y = a.date ? a.date.slice(0, 4) : '未分类';
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(a);
    });

    Object.keys(byYear).sort().reverse().forEach(function (year) {
      var section = document.createElement('section');
      section.className = 'year-section search-results';
      section.innerHTML = '<h2 class="year-heading">' + year + ' 年 <span class="count">(' + byYear[year].length + ' 篇)</span></h2>';
      byYear[year].forEach(function (a) {
        section.appendChild(createCard(a, query));
      });
      mainContent.appendChild(section);
    });
  }

  function createCard(a, query) {
    var card = document.createElement('a');
    card.className = 'article-card';
    var href = (a.type === 'pdf') ? (a.slug + '.html') : ('articles/' + a.slug + '.html');
    card.href = href;

    var title = highlight(a.title || '', query);
    var excerpt = highlight((fulltextMap[a.slug] || a.excerpt || '').slice(0, 120), query);
    var tags = (a.tags || []).slice(0, 2).map(function (t) {
      return '<span class="article-type">' + t + '</span>';
    }).join('');

    card.innerHTML =
      '<div class="article-meta">' +
        '<span class="article-date">' + (a.date_display || '') + '</span>' +
        '<span class="article-type ' + (a.type || '') + '">' + (a.type_cn || '') + '</span>' +
        tags +
      '</div>' +
      '<div class="article-title">' + title + '</div>' +
      (excerpt ? '<div class="article-excerpt">' + excerpt + '</div>' : '');

    return card;
  }

  function highlight(text, query) {
    if (!text || !query) return text || '';
    var terms = query.split(/\s+/).filter(Boolean);
    var result = text;
    terms.forEach(function (t) {
      var escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp('(' + escaped + ')', 'gi'), '<mark class="search-highlight">$1</mark>');
    });
    return result;
  }

  function clearSearch() {
    if (resultCount) resultCount.style.display = 'none';
    var old = mainContent.querySelectorAll('.search-results');
    old.forEach(function (el) { el.remove(); });
    allYearSections.forEach(function (s) { s.style.display = ''; });
    currentTag = null;
  }

  // ============ 标签筛选 ============

  function onTagClick(filter, tagEl) {
    if (filter === 'all') { clearSearch(); updateTagActive(null); return; }
    if (currentTag === filter) { clearSearch(); return; }
    currentTag = filter;
    updateTagActive(tagEl);
    if (!articles.length) return;
    var results = articles.filter(function (a) { return a.tags && a.tags.indexOf(filter) !== -1; });
    searchInput.value = '';
    renderFilterResults(results, filter);
  }

  function updateTagActive(activeEl) {
    var all = document.querySelectorAll('.filter-tag');
    all.forEach(function (t) { t.classList.remove('active'); });
    if (activeEl) activeEl.classList.add('active');
    else {
      var a = document.querySelector('.filter-tag[data-filter="all"]');
      if (a) a.classList.add('active');
    }
  }

  function renderFilterResults(results, filter) {
    resultCount.style.display = 'block';
    resultCount.innerHTML = '筛选 <strong>' + filter + '</strong>：<strong>' + results.length + '</strong> 篇';
    allYearSections.forEach(function (s) { s.style.display = 'none'; });
    var old = mainContent.querySelectorAll('.search-results');
    old.forEach(function (el) { el.remove(); });
    if (!results.length) {
      var empty = document.createElement('div');
      empty.className = 'search-no-results search-results';
      empty.innerHTML = '<p>该标签下暂无内容</p>';
      mainContent.appendChild(empty);
      return;
    }
    var byYear = {};
    results.forEach(function (a) {
      var y = a.date ? a.date.slice(0, 4) : '未分类';
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(a);
    });
    Object.keys(byYear).sort().reverse().forEach(function (year) {
      var section = document.createElement('section');
      section.className = 'year-section search-results';
      section.innerHTML = '<h2 class="year-heading">' + year + ' 年 <span class="count">(' + byYear[year].length + ' 篇)</span></h2>';
      byYear[year].forEach(function (a) { section.appendChild(createCard(a, '')); });
      mainContent.appendChild(section);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
