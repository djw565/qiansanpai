/**
 * 密码门 — 访问控制
 * 改密码：修改下面 PASSWORD 的值，重新部署即可
 */
(function () {
  'use strict';

  // ====== 在这里改密码！======
  var PASSWORD = 'qiansanpai2025';
  // =========================

  // 密码的简单哈希（防止明文直接暴露，但 F12 可破解——防君子不防小人）
  var HASH = simpleHash(PASSWORD);

  var SESSION_KEY = '_qsp_auth';
  var AUTH_DURATION = 24 * 60 * 60 * 1000; // 24小时

  // 先隐藏页面内容
  var hideStyle = document.createElement('style');
  hideStyle.id = '_auth_hide';
  hideStyle.textContent = 'body > *:not(#auth-gate) { display: none !important; }';
  document.head.appendChild(hideStyle);

  // 已登录则跳过
  if (sessionStorage.getItem(SESSION_KEY) === HASH || getCookie('_qsp_auth') === HASH) {
    sessionStorage.setItem(SESSION_KEY, HASH);
    hideStyle.remove();
    return;
  }

  // 显示密码门
  showGate();

  function showGate() {
    var overlay = document.createElement('div');
    overlay.id = 'auth-gate';
    overlay.innerHTML = `
      <div style="text-align:center;max-width:360px;padding:2rem;font-family:sans-serif;">
        <div style="font-size:3rem;margin-bottom:1rem;">🔐</div>
        <h2 style="margin-bottom:0.5rem;color:#2c2c2c;">前三排 · 学习小组</h2>
        <p style="color:#999;font-size:0.85rem;margin-bottom:1.5rem;">社群专属内容，请输入访问密码</p>
        <input id="auth-input" type="password" placeholder="请输入密码" autofocus
          style="width:100%;padding:0.7rem;border:2px solid #e8e0d5;border-radius:8px;font-size:1rem;text-align:center;outline:none;box-sizing:border-box;">
        <p id="auth-error" style="color:#c44d4d;font-size:0.8rem;margin-top:0.5rem;display:none;">密码错误</p>
      </div>
    `;

    // 样式
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:#fdfaf6;z-index:99999;display:flex;align-items:center;justify-content:center;';

    document.body.appendChild(overlay);

    var input = document.getElementById('auth-input');
    var errorEl = document.getElementById('auth-error');

    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') checkPassword(input.value);
    });

    // 清除错误提示
    input.addEventListener('input', function () {
      errorEl.style.display = 'none';
    });
  }

  function checkPassword(input) {
    if (simpleHash(input) === HASH) {
      sessionStorage.setItem(SESSION_KEY, HASH);
      // 设置 cookie，24小时有效
      setCookie('_qsp_auth', HASH, 1);
      // 移除密码门 + 恢复页面
      var gate = document.getElementById('auth-gate');
      if (gate) gate.remove();
      var hs = document.getElementById('_auth_hide');
      if (hs) hs.remove();
    } else {
      var errorEl = document.getElementById('auth-error');
      if (errorEl) errorEl.style.display = 'block';
      var inputEl = document.getElementById('auth-input');
      if (inputEl) { inputEl.value = ''; inputEl.focus(); }
    }
  }

  function simpleHash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) {
      h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return 'h' + Math.abs(h).toString(36);
  }

  function setCookie(name, value, days) {
    var d = new Date();
    d.setTime(d.getTime() + days * 86400000);
    document.cookie = name + '=' + value + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : null;
  }

  // 暴露给外面的 clearHistory 调用
  window._authHash = HASH;
})();
