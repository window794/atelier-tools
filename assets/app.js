/**
 * atelier / 道具棚 — JSON フォーマッタ
 *
 * 整形はすべてこのファイル内で完結する。入力テキストはどこにも送信しない。
 * <script defer> で読み込む前提（DOM 構築後に実行される）。
 */
(function () {
  'use strict';

  var root     = document.documentElement;
  var input    = document.getElementById('input');
  var output   = document.getElementById('output');
  var statusEl = document.getElementById('status');
  var inMeta   = document.getElementById('inMeta');
  var outMeta  = document.getElementById('outMeta');
  var DEFAULT_HINT = 'Ctrl + Enter でも整形できます。テキストはブラウザ内だけで処理され、送信されません。';

  /* localStorage は保存できない環境で例外になるため必ず包む */
  function store(key, value) {
    try {
      if (value === undefined) { return localStorage.getItem(key); }
      localStorage.setItem(key, value);
    } catch (e) { /* 保存できない環境では既定値のまま動かす */ }
    return null;
  }

  /* ── テーマ ─────────────────────────────────── */
  var labelLight  = document.getElementById('labelLight');
  var labelDark   = document.getElementById('labelDark');
  var themeToggle = document.getElementById('themeToggle');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    labelLight.classList.toggle('active', theme === 'light');
    labelDark.classList.toggle('active', theme === 'dark');
  }

  var savedTheme  = store('lily-theme');
  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(savedTheme || (prefersDark ? 'dark' : 'light'));

  themeToggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    store('lily-theme', next);
  });
  themeToggle.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); themeToggle.click(); }
  });

  /* ── タブ ───────────────────────────────────── */
  var tabs = document.querySelectorAll('.tab');
  Array.prototype.forEach.call(tabs, function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (t) {
        var selected = (t === tab);
        t.setAttribute('aria-selected', selected ? 'true' : 'false');
        document.getElementById('panel-' + t.getAttribute('data-tab')).hidden = !selected;
      });
    });
  });

  /* ── インデント幅 ───────────────────────────── */
  var indent  = store('lily-json-indent') === '4' ? 4 : 2;
  var segBtns = document.querySelectorAll('.seg-btn');

  function applyIndent(width) {
    indent = width;
    Array.prototype.forEach.call(segBtns, function (b) {
      b.setAttribute('aria-pressed', Number(b.getAttribute('data-indent')) === width ? 'true' : 'false');
    });
    store('lily-json-indent', String(width));
  }
  applyIndent(indent);

  Array.prototype.forEach.call(segBtns, function (b) {
    b.addEventListener('click', function () {
      applyIndent(Number(b.getAttribute('data-indent')));
      /* すでに整形済みなら新しい幅で入れ直す */
      if (output.value && !output.classList.contains('is-error')) { convert(false); }
    });
  });

  /* ── 表示ヘルパ ─────────────────────────────── */
  var statusTimer = null;
  function setStatus(message, kind) {
    statusEl.textContent = message;
    statusEl.className = 'status' + (kind ? ' is-' + kind : '');
    if (statusTimer) { clearTimeout(statusTimer); }
    statusTimer = setTimeout(function () {
      statusEl.textContent = DEFAULT_HINT;
      statusEl.className = 'status';
    }, 4000);
  }

  function updateMeta() {
    inMeta.textContent = input.value.length + ' chars';
    var lines = output.value ? output.value.split('\n').length : 0;
    outMeta.textContent = lines + (lines === 1 ? ' line' : ' lines');
  }

  function setOutput(text, isError) {
    output.value = text;
    output.classList.toggle('is-error', !!isError);
    updateMeta();
  }

  function lineColumn(text, position) {
    var head = text.slice(0, position);
    var line = head.split('\n').length;
    var column = position - head.lastIndexOf('\n');
    return line + ' 行目 ' + column + ' 文字目';
  }

  function showError(err, source) {
    var message = (err && err.message) ? err.message : String(err);
    var found = /position\s+(\d+)/i.exec(message);
    var where = '';
    /* ブラウザが行番号を出さない場合だけ自前で補う */
    if (found && !/line\s+\d+/i.test(message)) {
      where = '\n位置: ' + lineColumn(source, Number(found[1]));
    }
    setOutput('❌ Invalid JSON: ' + message + where, true);
    setStatus('JSON を解析できませんでした。入力を確認してください。', 'error');
  }

  /* ── 整形 / ミニファイ ──────────────────────── */
  function convert(minify) {
    var source = input.value;
    if (!source.trim()) {
      setOutput('', false);
      setStatus('Input が空です。JSON を貼り付けてください。');
      input.focus();
      return;
    }
    try {
      var parsed = JSON.parse(source);
      setOutput(minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, indent), false);
      setStatus(minify ? 'Minify しました。' : '整形しました（インデント ' + indent + '）。', 'ok');
    } catch (err) {
      showError(err, source);
    }
  }

  /* ── コピー ─────────────────────────────────── */
  function legacyCopy(text) {
    var scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.position = 'fixed';
    scratch.style.top = '0';
    scratch.style.opacity = '0';
    document.body.appendChild(scratch);
    scratch.select();
    var copied = false;
    try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
    document.body.removeChild(scratch);
    return copied;
  }

  function copyOutput() {
    var text = output.value;
    if (!text) { setStatus('コピーする内容がありません。'); return; }
    var done = function () { setStatus('Output をコピーしました。', 'ok'); };
    var fallback = function () {
      if (legacyCopy(text)) { done(); }
      else { setStatus('コピーできませんでした。Output を選択して手動でコピーしてください。', 'error'); }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
  }

  /* ── 操作 ───────────────────────────────────── */
  document.getElementById('btnFormat').addEventListener('click', function () { convert(false); });
  document.getElementById('btnMinify').addEventListener('click', function () { convert(true); });
  document.getElementById('btnCopy').addEventListener('click', copyOutput);
  document.getElementById('btnClear').addEventListener('click', function () {
    input.value = '';
    setOutput('', false);
    setStatus('Input / Output をクリアしました。');
    input.focus();
  });

  input.addEventListener('input', updateMeta);
  input.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); convert(false); }
  });

  /* 初期表示：サンプルを整形済みの状態で見せる */
  input.value = '{"tool":"JSON Formatter","version":"1.0","indent":[2,4],"privacy":{"server":false,"storage":"browser only"},"tags":["lily","atelier","json"]}';
  convert(false);
  if (statusTimer) { clearTimeout(statusTimer); }
  statusEl.textContent = DEFAULT_HINT;
  statusEl.className = 'status';
})();
