/**
 * 前三排 · 学习小组 — 客户端搜索
 * 基于 articles.json 实现实时中文搜索
 */

(function () {
  'use strict';

  var articles = [];
  var searchInput = null;
  var mainContent = null;
  var resultCount = null;
  var allYearSections = null;
  var debounceTimer = null;

  // ============ 初始化 ============

  function init() {
    searchInput = document.getElementById('search-input');
    mainContent = document.querySelector('.main-content');
    if (!searchInput || !mainContent) return;

    // 保存所有年份区块的引用
    allYearSections = mainContent.querySelectorAll('.year-section');

    // 创建结果计数元素
    resultCount = document.createElement('div');
    resultCount.className = 'search-result-count';
    resultCount.style.display = 'none';
    mainContent.insertBefore(resultCount, mainContent.firstChild);

    // 加载文章数据
    fetch('articles.json')
      .then(function (resp) { return resp.json(); })
      .then(function (data) {
        articles = data;
      })
      .catch(function () {
        console.warn('articles.json 加载失败，搜索功能不可用');
      });

    // 绑定事件
    searchInput.addEventListener('input', onSearchInput);
    searchInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        searchInput.value = '';
        clearSearch();
      }
    });
  }

  // ============ 搜索逻辑 ============

  function onSearchInput() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 250);
  }

  function doSearch() {
    var query = searchInput.value.trim();

    if (!query) {
      clearSearch();
      return;
    }

    if (!articles.length) {
      return;
    }

    // 分词：按空格或中文逐字
    var terms = query.split(/\s+/).filter(Boolean);
    if (terms.length === 0) {
      clearSearch();
      return;
    }

    var results = articles.filter(function (article) {
      return terms.every(function (term) {
        return matchArticle(article, term);
      });
    });

    renderResults(results, query);
  }

  function matchArticle(article, term) {
    var lowerTerm = term.toLowerCase();

    // 搜索标题
    if (article.title && article.title.toLowerCase().indexOf(lowerTerm) !== -1) {
      return true;
    }
    // 搜索摘要
    if (article.excerpt && article.excerpt.toLowerCase().indexOf(lowerTerm) !== -1) {
      return true;
    }
    // 搜索标签
    if (article.tags && article.tags.some(function (t) {
      return t.toLowerCase().indexOf(lowerTerm) !== -1;
    })) {
      return true;
    }
    // 搜索类型
    if (article.type_cn && article.type_cn.indexOf(term) !== -1) {
      return true;
    }
    return false;
  }

  // ============ 渲染结果 ============

  function renderResults(results, query) {
    // 显示计数
    resultCount.style.display = 'block';
    resultCount.innerHTML = '找到 <strong>' + results.length + '</strong> 篇相关文章';

    // 隐藏所有年份区块，重新构建
    allYearSections.forEach(function (section) {
      section.style.display = 'none';
    });

    if (results.length === 0) {
      showNoResults(query);
      return;
    }

    // 按年份分组
    var byYear = {};
    results.forEach(function (a) {
      var year = a.date ? a.date.slice(0, 4) : '未分类';
      if (!byYear[year]) byYear[year] = [];
      byYear[year].push(a);
    });

    // 移除旧的搜索结果区块
    var oldResults = mainContent.querySelectorAll('.search-results');
    oldResults.forEach(function (el) { el.remove(); });

    // 生成搜索结果 HTML
    var years = Object.keys(byYear).sort().reverse();
    years.forEach(function (year) {
      var section = document.createElement('section');
      section.className = 'year-section search-results';

      var heading = document.createElement('h2');
      heading.className = 'year-heading';
      heading.innerHTML = year + ' 年 <span class="count">(' + byYear[year].length + ' 篇)</span>';
      section.appendChild(heading);

      byYear[year].forEach(function (a) {
        var card = createArticleCard(a, query);
        section.appendChild(card);
      });

      mainContent.appendChild(section);
    });
  }

  function createArticleCard(article, query) {
    var card = document.createElement('a');
    card.className = 'article-card';
    card.href = 'articles/' + article.slug + '.html';

    // 高亮匹配文字
    var titleHtml = highlightText(article.title, query);
    var excerptHtml = article.excerpt ? highlightText(article.excerpt, query) : '';

    // 类型标签
    var typeClass = article.type || 'article';
    var tagsHtml = (article.tags || []).slice(0, 2).map(function (t) {
      return '<span class="article-type">' + t + '</span>';
    }).join('');

    card.innerHTML =
      '<div class="article-meta">' +
        '<span class="article-date">' + (article.date_display || '') + '</span>' +
        '<span class="article-type ' + typeClass + '">' + (article.type_cn || '') + '</span>' +
        tagsHtml +
      '</div>' +
      '<div class="article-title">' + titleHtml + '</div>' +
      (excerptHtml ? '<div class="article-excerpt">' + excerptHtml + '</div>' : '');

    return card;
  }

  function highlightText(text, query) {
    if (!text || !query) return text || '';

    var terms = query.split(/\s+/).filter(Boolean);
    var result = text;

    terms.forEach(function (term) {
      var escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var regex = new RegExp('(' + escaped + ')', 'gi');
      result = result.replace(regex, '<mark class="search-highlight">$1</mark>');
    });

    return result;
  }

  function showNoResults(query) {
    var oldResults = mainContent.querySelectorAll('.search-results');
    oldResults.forEach(function (el) { el.remove(); });

    var empty = document.createElement('div');
    empty.className = 'search-no-results search-results';
    empty.innerHTML =
      '<div class="no-results-icon">🔍</div>' +
      '<p>没有找到与 "<strong>' + query + '</strong>" 相关的文章</p>' +
      '<p class="no-results-hint">试试换个关键词，或按 <kbd>Esc</kbd> 清除搜索</p>';
    mainContent.appendChild(empty);
  }

  function clearSearch() {
    if (resultCount) resultCount.style.display = 'none';

    // 移除搜索结果
    var oldResults = mainContent.querySelectorAll('.search-results');
    oldResults.forEach(function (el) { el.remove(); });

    // 恢复原始年份区块
    allYearSections.forEach(function (section) {
      section.style.display = '';
    });
  }

  // ============ 启动 ============
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
