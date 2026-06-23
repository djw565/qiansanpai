/**
 * 每日金句 — 基于日期种子，每天随机展示一条金句
 * 同一天所有人看到同一条，每 24 小时自动更换
 */
(function () {
  'use strict';

  function init() {
    var quoteText = document.getElementById('quote-text');
    var quoteSource = document.getElementById('quote-source');
    if (!quoteText) return;

    fetch('quotes.json')
      .then(function (resp) { return resp.json(); })
      .then(function (quotes) {
        if (!quotes || !quotes.length) {
          quoteText.textContent = '学而不思则罔，思而不学则殆。';
          quoteSource.innerHTML = '—— 《论语》';
          return;
        }
        displayDailyQuote(quotes, quoteText, quoteSource);
      })
      .catch(function () {
        quoteText.textContent = '世界上只有一种真正的英雄主义，那就是在认清生活真相之后依然热爱生活。';
        quoteSource.innerHTML = '—— 罗曼·罗兰';
      });
  }

  function displayDailyQuote(quotes, textEl, sourceEl) {
    // 用今天的日期作为随机种子，保证同一天所有人看到同一条
    var today = new Date();
    var seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();

    // 伪随机数生成器（基于种子）
    var index = seededRandom(seed) % quotes.length;
    var quote = quotes[index];

    textEl.textContent = '「' + quote + '」';

    // 简洁的来源标注
    sourceEl.innerHTML = '—— 前三排 · 学习小组';
  }

  function seededRandom(seed) {
    // 简单的 mulberry32 伪随机算法
    var t = seed + 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
