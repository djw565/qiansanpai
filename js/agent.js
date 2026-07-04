/**
 * 子休 · 知识库 Agent（本地搜索版）
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
    chatHistory.forEach(function (msg) { appendMsgEl(msg.role, msg.content); });
    var intro = document.querySelector('.agent-intro');
    if (intro && chatHistory.length) intro.style.display = 'none';
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
    loadKnowledgeBase();
  }

  function loadKnowledgeBase() {
    var loaded = 0;
    fetch('concepts.json').then(function(r){return r.json();}).then(function(d){concepts = d.concepts||{}; loaded++; check();}).catch(function(){loaded++; check();});
    fetch('articles.json').then(function(r){return r.json();}).then(function(d){fulltextDB = d; loaded++; check();}).catch(function(){loaded++; check();});
    function check() {
      if (loaded >= 2) {
        isDBReady = true;
        if (chatHistory.length === 0) addSystemMsg('我是子休。输入关键词搜索知识库，或描述你的情况。');
        else restoreChat();
      }
    }
  }

  function handleSend() {
    if (isLoading) return;
    var query = inputEl.value.trim();
    if (!query) return;
    if (!isDBReady) { addSystemMsg('知识库还在加载…'); return; }

    inputEl.value = '';
    isLoading = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '…';

    addUserMsg(query);
    showTyping();
    questionCount++;

    setTimeout(function () {
      var matched = matchConcepts(query);
      var ctx = Object.keys(concepts).length > 0 ? '可用概念：' + Object.keys(concepts).join('、') : '';

      if (API_ENDPOINT) {
        fetchAIAnswer(query, ctx, [], matched);
      } else {
        var results = searchKnowledgeBase(query);
        removeTyping();
        showZixiuAnswer(query, results, matched);
        isLoading = false;
        sendBtn.disabled = false;
        sendBtn.textContent = '发送';
      }
    }, 200);
  }

  function fetchAIAnswer(query, context, _, matched) {
    var isConcept = /什么是|怎么理解|检索|查找|解释|知识库/.test(query);
    var sys = '你是子休，前三排社群主理人。用辩证唯物主义分析现实问题。' +
      '信念：人是社会关系的总和、物质决定意识、自欺欺人是默认设置、发展解决大多数问题。' +
      '风格：口语化、设问自答、金句收尾。回答200-400字。' +
      (isConcept ? '用户问概念，直接解释。' : '先追问定位问题，不能首轮给结论。') +
      '可用概念：' + (context||'');

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: sys, question: query }),
    })
      .then(function(r){return r.json();})
      .then(function(data){
        removeTyping();
        if (data.answer) addAgentMsg('<div class="ai-answer">'+data.answer.replace(/\n/g,'<br>')+'</div>');
        else showZixiuAnswer(query, [], matched);
        isLoading = false; sendBtn.disabled = false; sendBtn.textContent = '发送';
        chatArea.scrollTop = chatArea.scrollHeight;
      })
      .catch(function(){
        removeTyping();
        showZixiuAnswer(query, [], matched);
        isLoading = false; sendBtn.disabled = false; sendBtn.textContent = '发送';
      });
  }

  function matchConcepts(query) {
    var m = [];
    for (var n in concepts) {
      if (query.indexOf(n) !== -1 || n.indexOf(query) !== -1) m.push({ name: n, desc: concepts[n] });
    }
    return m.slice(0, 5);
  }

  function searchKnowledgeBase(query) {
    if (!fulltextDB.length) return [];
    var terms = tokenize(query);
    if (!terms.length) return [];
    var scored = [];
    fulltextDB.forEach(function (doc, idx) {
      var s = 0, title = (doc.title||'').toLowerCase();
      terms.forEach(function (t) { var tl = t.toLowerCase(); if (title.indexOf(tl) !== -1) s += 15; });
      if (s > 0) scored.push({ idx: idx, score: s, doc: doc });
    });
    scored.sort(function(a,b){return b.score-a.score;});
    return scored.slice(0, 5);
  }

  function tokenize(text) {
    var tokens = [], parts = text.split(/\s+/);
    parts.forEach(function (p) {
      if (p.length >= 2) tokens.push(p);
      for (var i=0; i<p.length-1; i++) for (var j=2; j<=4 && i+j<=p.length; j++) tokens.push(p.slice(i,i+j));
    });
    var seen = {};
    return tokens.filter(function(t){return t.length>=2 && (seen[t]?false:(seen[t]=true));});
  }

  function showZixiuAnswer(query, results, matched) {
    var html = '';
    var isConcept = /什么是|怎么理解|什么叫|检索|查找|解释|知识库|概念/.test(query);

    if (matched.length > 0) {
      html += '<p>涉及的核心概念：</p>';
      matched.forEach(function (c) {
        html += '<div class="quote-block"><strong>' + c.name + '</strong>：' + c.desc + '</div>';
      });
    }

    if (isConcept && matched.length > 0) {
      html += '<p>👉 <a href="concepts.html">在概念库中查看更多 →</a></p>';
    }

    if (results.length > 0) {
      html += '<div class="related-articles"><div class="related-title">📚 相关文章（' + results.length + '篇）：</div>';
      results.forEach(function (r) {
        var d = r.doc, href = d.type === 'pdf' ? (d.slug + '.html') : ('articles/' + d.slug + '.html');
        html += '<a href="' + href + '" class="related-card" target="_blank"><span class="rel-date">' + (d.date_display||'') + '</span><strong>' + d.title + '</strong></a>';
      });
      html += '</div>';
    }

    if (!matched.length && !results.length) {
      html = '<p>没有找到直接匹配的内容。试试换个关键词，或浏览 <a href="concepts.html">概念库</a>。</p>';
    }

    if (!isConcept && matched.length === 0 && results.length > 0) {
      html = '<p>我先确认几个事——</p><p>🔍 具体说说发生了什么？举个例子。</p><p>🔍 你为这件事做过什么实际行动？</p>' + html;
    }

    addAgentMsg(html);
    chatArea.scrollTop = chatArea.scrollHeight;
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
