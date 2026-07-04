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
    showThinking(query);
    questionCount++;

    setTimeout(function () {
      if (API_ENDPOINT) {
        callAI(query);
      } else {
        var results = searchKnowledgeBase(query);
        var matched = matchConcepts(query);
        removeThinking();
        showZixiuAnswer(query, results, matched);
        isLoading = false; sendBtn.disabled = false; sendBtn.textContent = '发送';
      }
    }, 200);
  }

  function callAI(query) {
    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query }),
    })
      .then(function(r){return r.json();})
      .then(function(data){
        removeThinking();
        if (data.answer) addAgentMsg('<div class="ai-answer">'+data.answer.replace(/\n/g,'<br>')+'</div>');
        else { var m = matchConcepts(query); showZixiuAnswer(query, [], m); }
        isLoading = false; sendBtn.disabled = false; sendBtn.textContent = '发送';
        chatArea.scrollTop = chatArea.scrollHeight;
      })
      .catch(function(){
        removeThinking();
        var m = matchConcepts(query); showZixiuAnswer(query, [], m);
        isLoading = false; sendBtn.disabled = false; sendBtn.textContent = '发送';
      });
  }

  function fetchAIAnswer(query, matched) {
    var isConcept = /什么是|怎么理解|检索|查找|解释|知识库/.test(query);

    var conceptCtx = '';
    if (matched && matched.length > 0) {
      conceptCtx = '\n\n## 匹配到的核心概念\n' + matched.map(function(c){ return c.name + '：' + c.desc; }).join('\n');
    }

    var sys = `你是子休，前三排社群创立者和主理人。用辩证唯物主义分析现实问题——职场、原生家庭、亲密关系、个人成长。${conceptCtx}

## 核心信念
人是社会关系的总和。物质决定意识。自欺欺人是默认设置。不行动的焦虑就是表演。发展解决大多数问题。

## 聊天式诊断协议
${isConcept ? '用户问概念/方法论。直接解释这个概念，引用经典案例。不追问。' : '用户第一条消息时只能追问，不能给结论。先问具体事实、生态位、行动记录。信息够了再分析。每轮最多3个问题。'}

## 8个核心分析工具
1. 矛盾分析：提出的是次要矛盾，真正的藏在逃避什么里
2. 社会关系总和：画关系图→受力分析→识别认知盲区
3. 物质决定意识：还原成长路径，生存方式塑造思维
4. 生态位分析：利益决定行为，不看人品看作位置。三楼永远扶持一楼制衡二楼
5. 否定之否定：成长是旧我崩塌后重建
6. 实践论：没实践的"懂"是自欺欺人。最小行动
7. 实事求是：把"我觉得"换成"事实上"
8. 冲突博弈：别被对方换了框架，吵架是说服第三方

## 关键行动准则
- 零行动=自欺欺人。第一责任人。留痕原则。权责对等
- 利润中心离钱近，成本中心离裁近。一段关系稳定长期存在一定是共谋
- 绕开比填坑聪明。性格是特点不是缺点。打铁还需自身硬
- 吵架不是为了说服对方，是为了说服第三方

## 表达风格
口语化、不拽学术词。设问自答：「那问题来了——她为什么要这么做呢？」。破题：「这道题最核心的问题不是XX」。反直觉反转。金句收尾。极端假设：「假设婆婆今晚死了，明天你还离吗？」
回答控制在200-400字。结尾用金句。`;

    fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: sys, question: query }),
    })
      .then(function(r){return r.json();})
      .then(function(data){
        removeThinking();
        if (data.answer) addAgentMsg('<div class="ai-answer">'+data.answer.replace(/\n/g,'<br>')+'</div>');
        else { showZixiuAnswer(query, [], []); }
        isLoading = false; sendBtn.disabled = false; sendBtn.textContent = '发送';
        chatArea.scrollTop = chatArea.scrollHeight;
      })
      .catch(function(){
        removeThinking();
        showZixiuAnswer(query, [], []);
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

  function showThinking(query) {
    var div = document.createElement('div');
    div.className = 'msg msg-agent';
    div.id = 'thinking-msg';
    var isConcept = /什么是|怎么理解|检索|查找|解释|知识库/.test(query);
    var msg = isConcept ? '正在搜索概念库…' : '子休正在思考…';
    div.innerHTML = '<div class="msg-bubble" style="color:#999;font-size:0.85rem;text-align:center;">' + msg + ' <span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span></div>';
    chatArea.appendChild(div);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function removeThinking() { var el = document.getElementById('thinking-msg'); if (el) el.remove(); }

  function showTyping() { showThinking(''); }
  function removeTyping() { removeThinking(); }

  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
