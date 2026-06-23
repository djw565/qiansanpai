/**
 * 子休 · 知识库 Agent
 * 基于辩证唯物主义心理学分析框架，模拟子休的问答风格
 */
(function () {
  'use strict';

  var API_ENDPOINT = 'https://rapid-dawn-e859.snfg624dcg.workers.dev';
  var fulltextDB = [];
  var concepts = {};
  var chatArea = null;
  var inputEl = null;
  var sendBtn = null;
  var isLoading = false;
  var questionCount = 0;
  var chatHistory = [];
  var isDBReady = false;
  var STORAGE_KEY = 'zixiu_chat_history';

  function saveHistory() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory.slice(-50))); } catch(e) {}
  }

  function loadHistory() {
    try { var raw = localStorage.getItem(STORAGE_KEY); if (raw) chatHistory = JSON.parse(raw); } catch(e) { chatHistory = []; }
  }

  function restoreChat() {
    chatHistory.forEach(function (msg) {
      appendMsgEl(msg.role, msg.content);
    });
    if (chatHistory.length) {
      var intro = document.querySelector('.agent-intro');
      if (intro) intro.style.display = 'none';
    }
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function clearHistory() {
    if (confirm('确定清空所有聊天记录？')) {
      chatHistory = [];
      localStorage.removeItem(STORAGE_KEY);
      chatArea.innerHTML = '';
      var intro = document.querySelector('.agent-intro');
      if (intro) intro.style.display = '';
      questionCount = 0;
    }
  }
  window.clearHistory = clearHistory;

  function init() {
    chatArea = document.getElementById('chat-area');
    inputEl = document.getElementById('agent-input');
    sendBtn = document.getElementById('agent-send');
    if (!chatArea || !inputEl || !sendBtn) return;
    loadHistory();
    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSend(); });
    var hints = document.querySelectorAll('.hint em');
    hints.forEach(function (h) {
      h.addEventListener('click', function () { inputEl.value = this.textContent; handleSend(); });
    });
    loadKnowledgeBase();
  }

  function loadKnowledgeBase() {
    var loaded = 0, target = 2;
    var startTime = Date.now();

    fetch('fulltext.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        fulltextDB = data;
        loaded++; checkReady();
      })
      .catch(function () {
        fetch('articles.json')
          .then(function (r) { return r.json(); })
          .then(function (data) { fulltextDB = data; loaded++; checkReady(); })
          .catch(function () { loaded++; checkReady(); });
      });

    fetch('concepts.json')
      .then(function (r) { return r.json(); })
      .then(function (data) { concepts = data.concepts || {}; loaded++; checkReady(); })
      .catch(function () { loaded++; checkReady(); });

    function checkReady() {
      if (loaded >= target) {
        isDBReady = true;
        var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        if (chatHistory.length === 0) {
          addSystemMsg('我是子休。知识库已就绪（' + fulltextDB.length + '篇，' + elapsed + '秒）。说说你遇到的事儿？');
        } else {
          restoreChat();
        }
      }
    }
  }

  function handleSend() {
    if (isLoading) return;
    var query = inputEl.value.trim();
    if (!query) return;

    if (!isDBReady && fulltextDB.length === 0) {
      addSystemMsg('知识库还在加载，稍等几秒…');
      return;
    }

    inputEl.value = '';
    isLoading = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '…';

    addUserMsg(query);
    showTyping();
    questionCount++;

    setTimeout(function () {
      var results = searchKnowledgeBase(query);
      var matchedConcepts = matchConcepts(query);
      var context = buildContext(results, matchedConcepts);

      if (API_ENDPOINT) {
        fetchAIAnswer(query, context, results, matchedConcepts);
      } else {
        removeTyping();
        showZixiuAnswer(query, results, matchedConcepts);
        isLoading = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
      }
    }, 200);
  }

  function matchConcepts(query) {
    var matched = [];
    for (var name in concepts) {
      if (query.indexOf(name) !== -1 || name.indexOf(query) !== -1) matched.push({ name: name, desc: concepts[name] });
    }
    if (!matched.length) {
      for (var name in concepts) {
        var tokens = tokenize(name), qt = tokenize(query);
        if (tokens.filter(function (t) { return qt.indexOf(t) !== -1; }).length >= 1) matched.push({ name: name, desc: concepts[name] });
      }
    }
    return matched.slice(0, 3);
  }

  function searchKnowledgeBase(query) {
    if (!fulltextDB.length) return [];
    var terms = tokenize(query);
    if (!terms.length) return [];
    var scored = [];
    fulltextDB.forEach(function (doc, idx) {
      var score = 0;
      var title = doc.title || '';
      var text = doc.fulltext || doc.excerpt || '';
      terms.forEach(function (t) {
        if (title.indexOf(t) !== -1) score += 12;
        var regex = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        var count = (text.match(regex) || []).length;
        score += count * 2;
      });
      if (score > 0) scored.push({ idx: idx, score: score, doc: doc });
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, 5);
  }

  function tokenize(text) {
    var tokens = [], parts = text.split(/\s+/);
    parts.forEach(function (p) {
      if (p.length >= 2) tokens.push(p);
      if (p.length >= 4) for (var i = 0; i < p.length - 1; i++) for (var j = 2; j <= 5 && i + j <= p.length; j++) tokens.push(p.slice(i, i + j));
    });
    var seen = {};
    return tokens.filter(function (t) { return t.length >= 2 && (seen[t] ? false : (seen[t] = true)); });
  }

  function buildContext(results, concepts) {
    var parts = [];
    if (concepts.length) { parts.push('【匹配概念】'); concepts.forEach(function (c) { parts.push(c.name + '：' + c.desc); }); }
    if (results.length) {
      parts.push('【相关案例摘要】');
      results.slice(0, 3).forEach(function (r) {
        var text = r.doc.fulltext || r.doc.excerpt || '';
        parts.push('《' + r.doc.title + '》' + (text ? '：' + text.slice(0, 300) : ''));
      });
    }
    return parts.join('\n\n');
  }

  function fetchAIAnswer(query, context, results, concepts) {
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query, context: context, isFirst: questionCount <= 1 }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        removeTyping();
        if (data.answer) {
          addAgentMsg('<div class="ai-answer">' + data.answer.replace(/\n/g, '<br>') + '</div>');
        } else {
          showZixiuAnswer(query, results, concepts);
        }
        isLoading = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
        chatArea.scrollTop = chatArea.scrollHeight;
      })
      .catch(function () {
        removeTyping();
        showZixiuAnswer(query, results, concepts);
        isLoading = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
      });
  }

  function showZixiuAnswer(query, results, concepts) {
    var html = '';
    var isFirstRound = questionCount <= 1;
    var hasGoodResults = results.length > 0 && results[0].score > 10;
    if (isFirstRound && !hasGoodResults) {
      html = buildDiagnosticProbe(query, results);
    } else {
      html = buildAnalysis(query, results, concepts);
    }
    addAgentMsg(html);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function buildDiagnosticProbe(query, results) {
    var html = '<p>我先确认几个事——</p>';
    if (query.indexOf('职场') !== -1 || query.indexOf('工作') !== -1 || query.indexOf('领导') !== -1) {
      html += '<p>🔍 你在公司什么位置？利润中心还是成本中心？</p><p>🔍 直属领导是谁的人？他的利益是什么？</p>';
    } else if (query.indexOf('感情') !== -1 || query.indexOf('爱') !== -1 || query.indexOf('关系') !== -1) {
      html += '<p>🔍 这段关系里，谁更需要谁？</p><p>🔍 你描述的是事实，还是感受？</p>';
    } else if (query.indexOf('家庭') !== -1 || query.indexOf('父母') !== -1 || query.indexOf('原生') !== -1) {
      html += '<p>🔍 你现在经济独立吗？住在谁的房子里？</p><p>🔍 你父母靠什么活下来的？</p>';
    } else {
      html += '<p>🔍 具体说说发生了什么？举个例子。</p><p>🔍 你为这件事做过什么实际行动？</p>';
    }
    if (results.length > 0) {
      html += '<div class="related-articles" style="margin-top:1rem;"><div class="related-title">📚 相关案例：</div>';
      results.slice(0, 3).forEach(function (r) {
        var d = r.doc, href = d.type === 'pdf' ? d.slug : 'articles/' + d.slug + '.html';
        html += '<a href="' + href + '" class="related-card" target="_blank"><span class="rel-date">' + (d.date_display || '') + '</span><strong>' + d.title + '</strong></a>';
      });
      html += '</div>';
    }
    return html;
  }

  function buildAnalysis(query, results, concepts) {
    var html = '';
    if (concepts.length > 0) {
      html += '<p>涉及核心概念：</p>';
      concepts.forEach(function (c) { html += '<div class="quote-block"><strong>' + c.name + '</strong>：' + c.desc + '</div>'; });
    }
    if (results.length > 0) {
      var best = results[0].doc;
      var excerpt = extractRelevantExcerpt(best, query);
      if (excerpt) {
        html += '<div class="quote-block">' + excerpt + '<span class="quote-source">—— <a href="articles/' + best.slug + '.html" target="_blank">' + best.title + '</a></span></div>';
      }
    }
    html += '<p style="margin-top:1rem;"><strong>如果只做一件事：</strong></p>';
    if (query.indexOf('职场') !== -1) {
      html += '<p>先画一张图：公司里谁说了算？钱从哪来到哪去？你在这张图里是什么位置？</p>';
    } else if (query.indexOf('关系') !== -1 || query.indexOf('感情') !== -1) {
      html += '<p>别急着判断。先问：这段关系里谁更需要谁。答案往往就在这里。</p>';
    } else {
      html += '<p>别想了。做一件最小的事——现在就做。进一寸有一寸的欢喜。</p>';
    }
    if (results.length > 0) {
      html += '<div class="related-articles" style="margin-top:1rem;"><div class="related-title">📚 深度阅读（' + results.length + '篇）：</div>';
      results.forEach(function (r) {
        var d = r.doc, href = d.type === 'pdf' ? d.slug : 'articles/' + d.slug + '.html';
        html += '<a href="' + href + '" class="related-card" target="_blank"><span class="rel-date">' + (d.date_display || '') + '</span><strong>' + d.title + '</strong></a>';
      });
      html += '</div>';
    }
    if (!results.length && !concepts.length) html = '<p>这个问题在知识库中没找到直接对应的案例。补充更多信息我帮你分析——什么时候开始的？具体发生了什么？</p>';
    return html;
  }

  function extractRelevantExcerpt(doc, query) {
    var text = doc.fulltext || '';
    if (!text) return doc.excerpt || '';
    var terms = tokenize(query), bestPara = '', bestScore = 0;
    (text.split(/\n\s*\n/) || []).forEach(function (para) {
      var pt = para.replace(/\n/g, ' ').trim();
      if (pt.length < 15) return;
      var score = 0;
      terms.forEach(function (t) { var r = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'); score += (pt.match(r) || []).length; });
      if (score > bestScore) { bestScore = score; bestPara = pt; }
    });
    if (bestPara && bestPara.length > 200) bestPara = bestPara.slice(0, 200) + '…';
    return bestPara || text.slice(0, 200) + '…';
  }

  function addUserMsg(text) { chatHistory.push({ role: 'user', content: text }); saveHistory(); appendMsgEl('user', text); }
  function addAgentMsg(html) { chatHistory.push({ role: 'agent', content: html }); saveHistory(); appendMsgEl('agent', html); }

  function appendMsgEl(role, content) {
    var div = document.createElement('div');
    div.className = 'msg msg-' + role;
    div.innerHTML = '<div class="msg-bubble">' + content + '</div>';
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function addSystemMsg(text) {
    var div = document.createElement('div');
    div.className = 'msg msg-agent';
    div.innerHTML = '<div class="msg-bubble" style="font-size:0.85rem;color:var(--text-secondary);text-align:center;border:1px dashed var(--border);">' + text + '</div>';
    chatArea.appendChild(div);
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

  function removeTyping() { var el = document.getElementById('typing-msg'); if (el) el.remove(); }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
