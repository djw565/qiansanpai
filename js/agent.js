/**
 * 前三排 · 知识库 Agent
 * 客户端全文检索 + 智能回答
 */
(function () {
  'use strict';

  var fulltextDB = [];
  var chatArea = null;
  var inputEl = null;
  var sendBtn = null;
  var isLoading = false;

  function init() {
    chatArea = document.getElementById('chat-area');
    inputEl = document.getElementById('agent-input');
    sendBtn = document.getElementById('agent-send');
    if (!chatArea || !inputEl || !sendBtn) return;

    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSend();
    });

    // 点击示例问题自动填入
    var hints = document.querySelectorAll('.hint em');
    hints.forEach(function (h) {
      h.addEventListener('click', function () {
        inputEl.value = this.textContent;
        handleSend();
      });
    });

    // 加载知识库
    loadKnowledgeBase();
  }

  function loadKnowledgeBase() {
    fetch('fulltext.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        fulltextDB = data;
        addSystemMsg('知识库已加载，共 ' + data.length + ' 篇文章，可以开始提问了。');
      })
      .catch(function () {
        // 降级到 articles.json
        fetch('articles.json')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            fulltextDB = data;
            addSystemMsg('知识库已加载（基础模式），可以开始提问了。');
          })
          .catch(function () {
            addSystemMsg('知识库加载失败，请刷新重试。');
          });
      });
  }

  function handleSend() {
    if (isLoading) return;
    var query = inputEl.value.trim();
    if (!query) return;

    inputEl.value = '';
    isLoading = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '搜索中...';

    addUserMsg(query);
    showTyping();

    // 搜索知识库
    setTimeout(function () {
      var results = searchKnowledgeBase(query);
      removeTyping();
      showAnswer(query, results);
      isLoading = false;
      sendBtn.disabled = false;
      sendBtn.textContent = '发送';
    }, 400); // 小延迟让加载动画可见
  }

  // ============ 搜索 ============

  function searchKnowledgeBase(query) {
    if (!fulltextDB.length) return [];

    // 分词
    var terms = tokenize(query);
    if (!terms.length) return [];

    var scored = [];

    fulltextDB.forEach(function (doc, idx) {
      var score = 0;
      var title = doc.title || '';
      var text = doc.fulltext || doc.excerpt || '';

      // 标题匹配（权重高）
      terms.forEach(function (t) {
        if (title.indexOf(t) !== -1) score += 10;
        var count = (text.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
        score += count * 2;
      });

      if (score > 0) {
        scored.push({ idx: idx, score: score, doc: doc });
      }
    });

    // 排序取前5
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 5);
  }

  function tokenize(text) {
    // 简单分词：按空格 + 提取2-8字的中文片段
    var tokens = [];
    // 先按空格分
    var parts = text.split(/\s+/);
    parts.forEach(function (p) {
      if (p.length >= 2) tokens.push(p);
      // 额外提取中文关键词（2-6字滑动窗口）
      if (p.length >= 6) {
        for (var i = 0; i < p.length - 1; i++) {
          for (var j = 2; j <= 6 && i + j <= p.length; j++) {
            tokens.push(p.slice(i, i + j));
          }
        }
      }
    });
    // 去重
    var seen = {};
    return tokens.filter(function (t) { return seen[t] ? false : (seen[t] = true); });
  }

  // ============ 回答生成 ============

  function showAnswer(query, results) {
    var html = '';

    if (!results.length) {
      html = '<p>我在知识库中没有找到与「<strong>' + query + '</strong>」直接相关的内容。</p>';
      html += '<p>试试换个关键词，或点击下方链接浏览全部文章。</p>';
    } else {
      html = '<p>关于「<strong>' + query + '</strong>」，找到 ' + results.length + ' 篇相关内容：</p>';

      // 最佳匹配引用
      var best = results[0].doc;
      var excerpt = extractRelevantExcerpt(best, query);
      if (excerpt) {
        html += '<div class="quote-block">' + excerpt;
        html += '<span class="quote-source">—— <a href="articles/' + best.slug + '.html" target="_blank">' + best.title + '</a></span>';
        html += '</div>';
      }

      // 综合简短回答
      if (results.length >= 2 && results[0].score > 20) {
        html += '<p>综合来看，知识库中关于这个话题的核心观点是：<strong>' + summarize(results) + '</strong></p>';
      }

      // 相关文章列表
      html += '<div class="related-articles">';
      html += '<div class="related-title">📚 相关文章：</div>';
      results.forEach(function (r) {
        var d = r.doc;
        var href = d.type === 'pdf' ? d.slug : 'articles/' + d.slug + '.html';
        html += '<a href="' + href + '" class="related-card" target="_blank">';
        html += '<span class="rel-date">' + (d.date_display || '') + '</span>';
        html += '<strong>' + d.title + '</strong>';
        html += '</a>';
      });
      html += '</div>';
    }

    addAgentMsg(html);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function extractRelevantExcerpt(doc, query) {
    var text = doc.fulltext || '';
    if (!text) return doc.excerpt || '';

    var terms = tokenize(query);
    if (!terms.length) return text.slice(0, 200) + '…';

    // 找包含最多关键词的段落
    var paragraphs = text.split(/\n\s*\n/);
    var bestPara = '';
    var bestScore = 0;

    paragraphs.forEach(function (para) {
      var paraText = para.replace(/\n/g, ' ').trim();
      if (paraText.length < 10) return;
      var score = 0;
      terms.forEach(function (t) {
        score += (paraText.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      });
      if (score > bestScore) {
        bestScore = score;
        bestPara = paraText;
      }
    });

    if (bestPara && bestPara.length > 200) {
      bestPara = bestPara.slice(0, 200) + '…';
    }
    return bestPara || text.slice(0, 200) + '…';
  }

  function summarize(results) {
    // 简单摘要：取排名最高的关键词做综合
    var titles = results.slice(0, 3).map(function (r) { return r.doc.title; });
    if (titles.length >= 2) {
      return '请查看下方「' + titles[0] + '」等文章获取详细分析';
    }
    return '建议阅读下方推荐文章获取深入理解';
  }

  // ============ UI 辅助 ============

  function addUserMsg(text) {
    var div = document.createElement('div');
    div.className = 'msg msg-user';
    div.innerHTML = '<div class="msg-bubble">' + text + '</div>';
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function addAgentMsg(html) {
    var div = document.createElement('div');
    div.className = 'msg msg-agent';
    div.innerHTML = '<div class="msg-bubble">' + html + '</div>';
    chatArea.appendChild(div);
  }

  function addSystemMsg(text) {
    var div = document.createElement('div');
    div.className = 'msg msg-agent';
    div.innerHTML = '<div class="msg-bubble" style="font-size:0.82rem;color:var(--text-secondary);text-align:center;">' + text + '</div>';
    chatArea.appendChild(div);
    // 移除初始介绍
    var intro = document.querySelector('.agent-intro');
    if (intro) intro.style.display = 'none';
  }

  function showTyping() {
    var div = document.createElement('div');
    div.className = 'msg msg-agent';
    div.id = 'typing-msg';
    div.innerHTML = '<div class="msg-bubble"><div class="typing-indicator"><span></span><span></span><span></span></div></div>';
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function removeTyping() {
    var el = document.getElementById('typing-msg');
    if (el) el.remove();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
