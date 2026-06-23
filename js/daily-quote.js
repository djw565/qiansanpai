/**
 * 概念复习卡片 — 每次刷新随机展示一个核心概念
 */
(function () {
  'use strict';

  function init() {
    var quoteText = document.getElementById('quote-text');
    var quoteSource = document.getElementById('quote-source');
    var quoteLabel = document.querySelector('.daily-quote-label');
    if (!quoteText || !quoteSource) return;

    // 更新标签
    if (quoteLabel) quoteLabel.textContent = '✦ 概念复习';

    fetch('concepts.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var concepts = data.concepts || {};
        var names = Object.keys(concepts);
        if (!names.length) return;

        var idx = Math.floor(Math.random() * names.length);
        var name = names[idx];
        var desc = concepts[name];

        quoteText.textContent = '「' + name + '」';
        quoteSource.innerHTML = desc + ' <br><small style="color:#999;">—— 子休 · 前三排概念库（43个概念，刷新随机复习）</small>';
      })
      .catch(function () {
        quoteText.textContent = '「实事求是」';
        quoteSource.innerHTML = '把「我觉得」换成「事实上」。一切分析的前提是把情绪放掉，先看客观事实。';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
