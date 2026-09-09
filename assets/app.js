/**
 * atelier / 道具棚 — JSON / SQL フォーマッタ
 *
 * 整形はすべてブラウザ内で完結する。入力テキストはどこにも送信しない。
 * SQL の整形は同梱の sql-formatter（assets/vendor/、MIT）を使う。
 * <script defer> で読み込む前提（DOM 構築後、vendor の後に実行される）。
 */
(function () {
  'use strict';

  var root = document.documentElement;
  function $(id) { return document.getElementById(id); }

  /* localStorage は保存できない環境で例外になるため必ず包む */
  function store(key, value) {
    try {
      if (value === undefined) { return localStorage.getItem(key); }
      localStorage.setItem(key, value);
    } catch (e) { /* 保存できない環境では既定値のまま動かす */ }
    return null;
  }

  /* ══════════ 共通パーツ ══════════ */

  /** ステータス行。4 秒後にヒント文へ戻る */
  function makeStatus(el, hint) {
    var timer = null;
    el.textContent = hint;
    return function (message, kind) {
      el.textContent = message;
      el.className = 'status' + (kind ? ' is-' + kind : '');
      if (timer) { clearTimeout(timer); }
      timer = setTimeout(function () {
        el.textContent = hint;
        el.className = 'status';
      }, 4000);
    };
  }

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

  function copyText(text, setStatus) {
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

  /** ピル型のセグメント選択。値は localStorage に保存する */
  function segGroup(el, storeKey, fallbackValue, onChange) {
    var buttons = el.querySelectorAll('.seg-btn');
    var value = store(storeKey);
    var known = false;
    Array.prototype.forEach.call(buttons, function (b) {
      if (b.getAttribute('data-value') === value) { known = true; }
    });
    if (!known) { value = fallbackValue; }

    function apply(next, notify) {
      value = next;
      Array.prototype.forEach.call(buttons, function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-value') === next ? 'true' : 'false');
      });
      store(storeKey, next);
      if (notify && onChange) { onChange(next); }
    }

    Array.prototype.forEach.call(buttons, function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-value'), true); });
    });
    apply(value, false);

    return { get: function () { return value; } };
  }

  /** 入力の文字数・出力の行数表示 */
  function makeCounter(inputEl, outputEl, inMeta, outMeta) {
    return function () {
      inMeta.textContent = inputEl.value.length + ' chars';
      var lines = outputEl.value ? outputEl.value.split('\n').length : 0;
      outMeta.textContent = lines + (lines === 1 ? ' line' : ' lines');
    };
  }

  /* ══════════ テーマ ══════════ */

  var labelLight  = $('labelLight');
  var labelDark   = $('labelDark');
  var themeToggle = $('themeToggle');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    labelLight.classList.toggle('active', theme === 'light');
    labelDark.classList.toggle('active', theme === 'dark');
  }

  var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(store('atelier-theme') || (prefersDark ? 'dark' : 'light'));

  themeToggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    store('atelier-theme', next);
  });
  themeToggle.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); themeToggle.click(); }
  });

  /* ══════════ タブ ══════════ */

  var tabs = document.querySelectorAll('.tab');
  Array.prototype.forEach.call(tabs, function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (t) {
        var selected = (t === tab);
        t.setAttribute('aria-selected', selected ? 'true' : 'false');
        $('panel-' + t.getAttribute('data-tab')).hidden = !selected;
      });
      store('atelier-tab', tab.getAttribute('data-tab'));
    });
  });

  /* ══════════ JSON ══════════ */

  (function initJson() {
    var HINT = 'Ctrl + Enter でも整形できます。テキストはブラウザ内だけで処理され、送信されません。';
    var input  = $('jsonInput');
    var output = $('jsonOutput');
    var setStatus = makeStatus($('jsonStatus'), HINT);
    var updateMeta = makeCounter(input, output, $('jsonInMeta'), $('jsonOutMeta'));

    function setOutput(text, isError) {
      output.value = text;
      output.classList.toggle('is-error', !!isError);
      updateMeta();
    }

    function lineColumn(text, position) {
      var head = text.slice(0, position);
      return head.split('\n').length + ' 行目 ' + (position - head.lastIndexOf('\n')) + ' 文字目';
    }

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
        var width = Number(indent.get());
        setOutput(minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, width), false);
        setStatus(minify ? 'Minify しました。' : '整形しました（インデント ' + width + '）。', 'ok');
      } catch (err) {
        var message = (err && err.message) ? err.message : String(err);
        var found = /position\s+(\d+)/i.exec(message);
        /* ブラウザが行番号を出さない場合だけ自前で補う */
        var where = (found && !/line\s+\d+/i.test(message))
          ? '\n位置: ' + lineColumn(source, Number(found[1])) : '';
        setOutput('❌ Invalid JSON: ' + message + where, true);
        setStatus('JSON を解析できませんでした。入力を確認してください。', 'error');
      }
    }

    var indent = segGroup($('segJsonIndent'), 'atelier-json-indent', '2', function () {
      /* すでに整形済みなら新しい幅で入れ直す */
      if (output.value && !output.classList.contains('is-error')) { convert(false); }
    });

    $('jsonFormat').addEventListener('click', function () { convert(false); });
    $('jsonMinify').addEventListener('click', function () { convert(true); });
    $('jsonCopy').addEventListener('click', function () { copyText(output.value, setStatus); });
    $('jsonClear').addEventListener('click', function () {
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
    input.value = '{"tool":"JSON Formatter","version":"1.0","indent":[2,4],"privacy":{"server":false,"storage":"browser only"},"tags":["blåsippa","atelier","json"]}';
    convert(false);
    setStatus(HINT);
  })();

  /* ══════════ SQL ══════════ */

  (function initSql() {
    var HINT = 'Ctrl + Enter でも整形できます。方言を選ぶと解釈が変わります。';
    var input  = $('sqlInput');
    var output = $('sqlOutput');
    var dialect = $('sqlDialect');
    var setStatus = makeStatus($('sqlStatus'), HINT);
    var updateMeta = makeCounter(input, output, $('sqlInMeta'), $('sqlOutMeta'));

    function setOutput(text, isError) {
      output.value = text;
      output.classList.toggle('is-error', !!isError);
      updateMeta();
    }

    /**
     * SQL を 1 行に戻す。
     * 文字列リテラル・引用識別子の中身はそのまま残し、外側の空白だけを詰める。
     * 行コメント（--）は 1 行にすると後続を巻き込むため取り除く。
     */
    function toOneLine(sql) {
      var out = '';
      var strippedComment = false;
      var i = 0;
      var n = sql.length;

      /* 区切りの空白。すでに空白で終わっていれば足さない
         （文字列リテラル内の空白を潰さないため、一括置換では行わない） */
      function pushSpace() {
        if (out.length && out.charAt(out.length - 1) !== ' ') { out += ' '; }
      }

      while (i < n) {
        var c = sql.charAt(i);

        /* 文字列リテラル・引用識別子 */
        if (c === "'" || c === '"' || c === '`') {
          var quote = c;
          out += c;
          i++;
          while (i < n) {
            var ch = sql.charAt(i);
            if (ch === '\\' && quote !== '`') {          /* MySQL 系のバックスラッシュ */
              out += ch + sql.charAt(i + 1);
              i += 2;
              continue;
            }
            if (ch === quote) {
              if (sql.charAt(i + 1) === quote) {          /* '' による自身のエスケープ */
                out += quote + quote;
                i += 2;
                continue;
              }
              out += quote;
              i++;
              break;
            }
            out += ch;
            i++;
          }
          continue;
        }

        /* SQL Server の [識別子] */
        if (c === '[') {
          while (i < n) {
            out += sql.charAt(i);
            if (sql.charAt(i) === ']') { i++; break; }
            i++;
          }
          continue;
        }

        /* 行コメントは落とす */
        if (c === '-' && sql.charAt(i + 1) === '-') {
          while (i < n && sql.charAt(i) !== '\n') { i++; }
          strippedComment = true;
          pushSpace();
          continue;
        }

        /* ブロックコメントは残し、中の改行だけ詰める */
        if (c === '/' && sql.charAt(i + 1) === '*') {
          var end = sql.indexOf('*/', i + 2);
          var block = (end < 0) ? sql.slice(i) : sql.slice(i, end + 2);
          out += block.replace(/\s+/g, ' ');
          i = (end < 0) ? n : end + 2;
          continue;
        }

        /* 連続する空白はひとつに */
        if (/\s/.test(c)) {
          while (i < n && /\s/.test(sql.charAt(i))) { i++; }
          pushSpace();
          continue;
        }

        out += c;
        i++;
      }

      return {
        text: out.replace(/ ([,;)])/g, '$1').replace(/\( /g, '(').trim(),
        strippedComment: strippedComment
      };
    }

    /**
     * Access 方言の下ごしらえ。
     * sql-formatter は [表]![列] と #日付# を解釈できず構文エラーになるので、
     * その部分だけ伏せ字に置き換えて整形し、あとで元に戻す。
     */
    function maskAccess(sql) {
      var bag = [];
      function keep(match) {
        bag.push(match);
        return '__acs' + (bag.length - 1) + '__';
      }
      var masked = sql
        .replace(/(\[[^\]\n]*\]|[A-Za-z_]\w*)\s*!\s*(\[[^\]\n]*\]|[A-Za-z_]\w*)/g, keep)
        .replace(/#[^#\n]*#/g, keep);
      return { sql: masked, bag: bag };
    }

    function unmaskAccess(text, bag) {
      return text.replace(/__acs(\d+)__/g, function (whole, index) {
        return bag[Number(index)];
      });
    }

    function format() {
      var source = input.value;
      if (!source.trim()) {
        setOutput('', false);
        setStatus('Input が空です。SQL を貼り付けてください。');
        input.focus();
        return;
      }
      if (typeof sqlFormatter === 'undefined' || !sqlFormatter.format) {
        setOutput('❌ SQL フォーマッタを読み込めませんでした。\nassets/vendor/sql-formatter.min.js が配置されているか確認してください。', true);
        setStatus('ライブラリを読み込めませんでした。', 'error');
        return;
      }
      var width = indent.get();
      var isAccess = dialect.value === 'access';
      var masked = isAccess ? maskAccess(source) : null;
      try {
        var result = sqlFormatter.format(isAccess ? masked.sql : source, {
          /* Access は角かっこ識別子を扱える SQL Server として解釈させる */
          language: isAccess ? 'transactsql' : dialect.value,
          useTabs: width === 'tab',
          tabWidth: width === 'tab' ? 4 : Number(width),
          keywordCase: keyword.get(),
          logicalOperatorNewline: logical.get()
        });
        setOutput(isAccess ? unmaskAccess(result, masked.bag) : result, false);
        setStatus('整形しました（' + dialect.options[dialect.selectedIndex].text + '）。', 'ok');
      } catch (err) {
        setOutput('❌ Invalid SQL: ' + ((err && err.message) ? err.message : String(err)), true);
        setStatus('SQL を解析できませんでした。方言の指定を確認してください。', 'error');
      }
    }

    function reformat() {
      /* すでに整形済みなら新しい設定で入れ直す */
      if (output.value && !output.classList.contains('is-error')) { format(); }
    }

    var indent  = segGroup($('segSqlIndent'),  'atelier-sql-indent',  '2',      reformat);
    var keyword = segGroup($('segSqlKeyword'), 'atelier-sql-keyword', 'upper',  reformat);
    var logical = segGroup($('segSqlLogical'), 'atelier-sql-logical', 'before', reformat);

    var savedDialect = store('atelier-sql-dialect');
    if (savedDialect) {
      Array.prototype.forEach.call(dialect.options, function (o) {
        if (o.value === savedDialect) { dialect.value = savedDialect; }
      });
    }
    dialect.addEventListener('change', function () {
      store('atelier-sql-dialect', dialect.value);
      reformat();
    });

    $('sqlFormat').addEventListener('click', format);
    $('sqlOneLine').addEventListener('click', function () {
      var source = input.value;
      if (!source.trim()) {
        setOutput('', false);
        setStatus('Input が空です。SQL を貼り付けてください。');
        input.focus();
        return;
      }
      var result = toOneLine(source);
      setOutput(result.text, false);
      setStatus(result.strippedComment ? '1 行に戻しました（行コメント -- は削除）。' : '1 行に戻しました。', 'ok');
    });
    $('sqlCopy').addEventListener('click', function () { copyText(output.value, setStatus); });
    $('sqlClear').addEventListener('click', function () {
      input.value = '';
      setOutput('', false);
      setStatus('Input / Output をクリアしました。');
      input.focus();
    });

    input.addEventListener('input', updateMeta);
    input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); format(); }
    });

    /* 初期表示：サンプルを整形済みの状態で見せる */
    input.value = "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.status = 'active' and o.created_at >= '2026-01-01' group by u.id, u.name having count(o.id) > 3 order by orders desc";
    format();
    setStatus(HINT);
  })();

  /* 前回開いていたタブを復元する */
  var savedTab = store('atelier-tab');
  if (savedTab === 'sql') { $('tab-sql').click(); }
})();
