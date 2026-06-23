/**
 * 子休 · 知识库 Agent
 * 基于辩证唯物主义心理学分析框架，模拟子休的问答风格
 */
(function () {
  'use strict';

  var fulltextDB = [];
  var concepts = {};
  var chatArea = null;
  var inputEl = null;
  var sendBtn = null;
  var isLoading = false;
  var questionCount = 0; // 模拟子休的轮次追问

  function init() {
    chatArea = document.getElementById('chat-area');
    inputEl = document.getElementById('agent-input');
    sendBtn = document.getElementById('agent-send');
    if (!chatArea || !inputEl || !sendBtn) return;

    sendBtn.addEventListener('click', handleSend);
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSend();
    });

    var hints = document.querySelectorAll('.hint em');
    hints.forEach(function (h) {
      h.addEventListener('click', function () {
        inputEl.value = this.textContent;
        handleSend();
      });
    });

    loadKnowledgeBase();
  }

  function loadKnowledgeBase() {
    // 并行加载全文索引和概念库
    var loaded = 0;
    var target = 2;

    fetch('fulltext.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        fulltextDB = data;
        loaded++;
        checkReady();
      })
      .catch(function () {
        fetch('articles.json')
          .then(function (r) { return r.json(); })
          .then(function (data) { fulltextDB = data; loaded++; checkReady(); })
          .catch(function () { loaded++; checkReady(); });
      });

    fetch('concepts.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        concepts = data.concepts || {};
        loaded++;
        checkReady();
      })
      .catch(function () { loaded++; checkReady(); });

    function checkReady() {
      if (loaded >= target) {
        addSystemMsg('我是子休。前三排社群主理人。用辩证唯物主义的方法分析现实问题。说说你遇到的事儿？');
      }
    }
  }

  function handleSend() {
    if (isLoading) return;
    var query = inputEl.value.trim();
    if (!query) return;

    inputEl.value = '';
    isLoading = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '思考中...';

    addUserMsg(query);
    showTyping();

    questionCount++;

    setTimeout(function () {
      var results = searchKnowledgeBase(query);
      var matchedConcepts = matchConcepts(query);
      removeTyping();
      showZixiuAnswer(query, results, matchedConcepts);
      isLoading = false;
      sendBtn.disabled = false;
      sendBtn.textContent = '发送';
    }, 500);
  }

  // ============ 概念匹配 ============

  function matchConcepts(query) {
    var matched = [];
    for (var name in concepts) {
      if (query.indexOf(name) !== -1 || name.indexOf(query) !== -1) {
        matched.push({ name: name, desc: concepts[name] });
      }
    }
    // 如果没直接命中，模糊匹配
    if (!matched.length) {
      for (var name in concepts) {
        var tokens = tokenize(name);
        var queryTokens = tokenize(query);
        var overlap = tokens.filter(function (t) { return queryTokens.indexOf(t) !== -1; });
        if (overlap.length >= 1) {
          matched.push({ name: name, desc: concepts[name] });
        }
      }
    }
    return matched.slice(0, 3);
  }

  // ============ 搜索 ============

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
    var tokens = [];
    var parts = text.split(/\s+/);
    parts.forEach(function (p) {
      if (p.length >= 2) tokens.push(p);
      if (p.length >= 4) {
        for (var i = 0; i < p.length - 1; i++) {
          for (var j = 2; j <= 5 && i + j <= p.length; j++) {
            tokens.push(p.slice(i, i + j));
          }
        }
      }
    });
    var seen = {};
    return tokens.filter(function (t) { return t.length >= 2 && (seen[t] ? false : (seen[t] = true)); });
  }

  // ============ 子休式回答 ============

  function showZixiuAnswer(query, results, concepts) {
    var html = '';
    var isFirstRound = questionCount <= 1;
    var hasGoodResults = results.length > 0 && results[0].score > 10;

    // === 第1轮：追问模式（模拟子休的诊断流程）===
    if (isFirstRound && !hasGoodResults) {
      html = buildDiagnosticProbe(query, results);
    }
    // === 后续轮次或有结果：综合分析 ===
    else {
      html = buildAnalysis(query, results, concepts);
    }

    addAgentMsg(html);
    chatArea.scrollTop = chatArea.scrollHeight;
  }

  function buildDiagnosticProbe(query, results) {
    var html = '<p>我先确认几个事——</p>';

    // 根据问题类型给追问
    if (query.indexOf('职场') !== -1 || query.indexOf('工作') !== -1 || query.indexOf('领导') !== -1 || query.indexOf('同事') !== -1) {
      html += '<p>🔍 <strong>你在公司是什么位置？利润中心还是成本中心？</strong></p>';
      html += '<p>🔍 <strong>你的直属领导是谁的人？他的利益是什么？</strong></p>';
      html += '<p>把这些信息给我，我才能帮你做生态位分析。</p>';
    } else if (query.indexOf('感情') !== -1 || query.indexOf('爱') !== -1 || query.indexOf('关系') !== -1 || query.indexOf('分手') !== -1) {
      html += '<p>🔍 <strong>这段关系里，谁更需要谁？</strong></p>';
      html += '<p>🔍 <strong>你描述的是客观事实，还是你的感受？</strong></p>';
      html += '<p>先想清楚这两个问题，把答案给我。</p>';
    } else if (query.indexOf('家庭') !== -1 || query.indexOf('父母') !== -1 || query.indexOf('原生') !== -1) {
      html += '<p>🔍 <strong>你现在经济独立吗？住在谁的房子里？吃谁的饭？</strong></p>';
      html += '<p>🔍 <strong>你父母的成长路径是什么——他们靠什么活下来的？</strong></p>';
      html += '<p>物质决定意识。不了解你怎么活下来，就没法理解你为什么这么想。</p>';
    } else {
      html += '<p>🔍 <strong>具体说说发生了什么？举个例子。</strong></p>';
      html += '<p>🔍 <strong>你为这件事做过什么实际行动？</strong></p>';
      html += '<p>说具体的事，不要说感受。事实先行。</p>';
    }

    if (results.length > 0) {
      html += '<div class="related-articles" style="margin-top:1rem;">';
      html += '<div class="related-title">📚 相关案例（供参考）：</div>';
      results.slice(0, 3).forEach(function (r) {
        var d = r.doc;
        var href = d.type === 'pdf' ? d.slug : 'articles/' + d.slug + '.html';
        html += '<a href="' + href + '" class="related-card" target="_blank">';
        html += '<span class="rel-date">' + (d.date_display || '') + '</span>';
        html += '<strong>' + d.title + '</strong>';
        html += '</a>';
      });
      html += '</div>';
    }

    return html;
  }

  function buildAnalysis(query, results, matchedConcepts) {
    var html = '';

    // === 概念命中 ===
    if (matchedConcepts.length > 0) {
      html += '<p>你这个问题涉及几个核心概念：</p>';
      matchedConcepts.forEach(function (c) {
        html += '<div class="quote-block">';
        html += '<strong>' + c.name + '</strong>：' + c.desc;
        html += '</div>';
      });
    }

    // === 最佳匹配引用 ===
    if (results.length > 0) {
      var best = results[0].doc;
      var excerpt = extractRelevantExcerpt(best, query);
      if (excerpt) {
        html += '<p>知识库里最相关的分析——</p>';
        html += '<div class="quote-block">' + excerpt;
        html += '<span class="quote-source">—— <a href="articles/' + best.slug + '.html" target="_blank">' + best.title + '</a></span>';
        html += '</div>';
      }
    }

    // === 子休式最小行动 ===
    html += '<p style="margin-top:1rem;"><strong>如果只做一件事：</strong></p>';
    if (matchedConcepts.length > 0 && matchedConcepts[0].name === '自欺欺人') {
      html += '<p>先承认一个事实——你现在是在真正解决问题，还是在表演解决问题？写下来，写给自己看。不要骗自己。</p>';
    } else if (query.indexOf('职场') !== -1) {
      html += '<p>先画一张图：你的公司里，谁说了算？钱从哪来到哪去？你在这张图里是什么位置？画完你就明白了。</p>';
    } else if (query.indexOf('关系') !== -1 || query.indexOf('感情') !== -1) {
      html += '<p>别急着判断「他爱不爱我」。先问：这段关系里谁更需要谁。答案往往就在这个问题里。</p>';
    } else {
      html += '<p>别想了。做一件最小的事——现在就做。进一寸有一寸的欢喜。</p>';
    }

    // === 相关文章 ===
    if (results.length > 0) {
      html += '<div class="related-articles" style="margin-top:1rem;">';
      html += '<div class="related-title">📚 深度阅读（共 ' + results.length + ' 篇）：</div>';
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

    if (!results.length && !matchedConcepts.length) {
      html = '<p>这个问题我在现有的案例记录中没有找到直接对应的。建议你补充更多具体信息——</p>';
      html += '<p>🔍 什么时候开始的？具体发生了什么？你做了什么？</p>';
    }

    return html;
  }

  function extractRelevantExcerpt(doc, query) {
    var text = doc.fulltext || '';
    if (!text) return doc.excerpt || '';
    var terms = tokenize(query);
    if (!terms.length) return text.slice(0, 200) + '…';

    var paragraphs = text.split(/\n\s*\n/);
    var bestPara = '';
    var bestScore = 0;

    paragraphs.forEach(function (para) {
      var paraText = para.replace(/\n/g, ' ').trim();
      if (paraText.length < 15) return;
      var score = 0;
      terms.forEach(function (t) {
        var regex = new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
        score += (paraText.match(regex) || []).length;
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

  // ============ UI ============

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
