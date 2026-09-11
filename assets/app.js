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

    /* 方言ごとの見本。その方言らしい書き方が一目で分かるものを選んである */
    var SAMPLES = {
      sql: "with recent as (select order_id, customer_id, total from orders where order_date >= date '2026-01-01') select c.name, count(*) as cnt, sum(r.total) as amount from recent r join customers c on c.id = r.customer_id group by c.name having count(*) > 3 order by amount desc fetch first 10 rows only",
      mysql: "select `u`.`name`, date_format(o.created_at, '%Y-%m') as ym, group_concat(o.code separator ', ') as codes, ifnull(sum(o.total), 0) as amount from `users` u left join `orders` o on o.user_id = u.id where u.status = 'active' group by `u`.`name`, ym order by amount desc limit 20",
      postgresql: "select c.name, date_trunc('month', o.created_at) as ym, coalesce(sum(o.total), 0)::numeric(12, 2) as amount from customers c left join orders o on o.customer_id = c.id where c.email ilike '%@example.com' and o.created_at >= now() - interval '90 days' group by c.name, ym order by amount desc limit 20",
      transactsql: "select top (20) [c].[Name], isnull(sum([o].[Total]), 0) as [Amount], convert(varchar(7), [o].[CreatedAt], 120) as [Ym] from [dbo].[Customers] as [c] left join [dbo].[Orders] as [o] on [o].[CustomerId] = [c].[Id] where [c].[Status] = N'active' and [o].[CreatedAt] >= dateadd(day, -90, getdate()) group by [c].[Name], convert(varchar(7), [o].[CreatedAt], 120) order by [Amount] desc",
      plsql: "select c.name, to_char(o.created_at, 'YYYY-MM') as ym, nvl(sum(o.total), 0) as amount from customers c left join orders o on o.customer_id = c.id where c.status = 'active' and o.created_at >= sysdate - 90 and rownum <= 20 group by c.name, to_char(o.created_at, 'YYYY-MM') order by amount desc",
      sqlite: "select c.first_name || ' ' || c.last_name as full_name, strftime('%Y-%m', o.created_at) as ym, ifnull(sum(o.total), 0) as amount from customers c left join orders o on o.customer_id = c.id where c.status = 'active' group by full_name, ym order by amount desc limit 20",
      access: 'SELECT [Customers]![Name] AS Nm, Nz(Sum([Orders]![Total]), 0) AS Amount, IIf([Orders]![Total] > 10000, "大口", "通常") AS Grp FROM [Customers] INNER JOIN [Orders] ON [Customers]![ID] = [Orders]![CustomerID] WHERE [Orders]![OrderDate] BETWEEN #2026-01-01# AND #2026-12-31# AND [Customers]![Name] LIKE "*商事*" GROUP BY [Customers]![Name] ORDER BY Amount DESC'
    };

    /* 入力が見本のままなら、方言を変えたときに差し替えてよい */
    function inputIsSample() {
      var current = input.value.trim();
      for (var key in SAMPLES) {
        if (SAMPLES[key] === current) { return true; }
      }
      return current === '';
    }

    function loadSample() {
      input.value = SAMPLES[dialect.value] || SAMPLES.sql;
      format();
      setStatus(dialectLabel() + ' の見本を読み込みました。', 'ok');
    }

    function dialectLabel() {
      return dialect.options[dialect.selectedIndex].text;
    }

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

    /** 現在の設定で整形した文字列を返す。解析できなければ例外 */
    function formatSql(source) {
      if (typeof sqlFormatter === 'undefined' || !sqlFormatter.format) {
        throw new Error('SQL フォーマッタを読み込めませんでした。assets/vendor/sql-formatter.min.js が配置されているか確認してください。');
      }
      var width = indent.get();
      var isAccess = dialect.value === 'access';
      var masked = isAccess ? maskAccess(source) : null;
      var result = sqlFormatter.format(isAccess ? masked.sql : source, {
        /* Access は角かっこ識別子を扱える SQL Server として解釈させる */
        language: isAccess ? 'transactsql' : dialect.value,
        useTabs: width === 'tab',
        tabWidth: width === 'tab' ? 4 : Number(width),
        keywordCase: keyword.get(),
        logicalOperatorNewline: logical.get()
      });
      if (isAccess) {
        result = unmaskAccess(result, masked.bag);
        /* ライブラリが知らない Access 固有の関数は Nz (…) と離れてしまうので詰める */
        result = result.replace(
          /\b(Nz|IIf|Switch|Choose|Format|DLookUp|DCount|DSum|DAvg|DMax|DMin|CDate|CStr|CInt|CLng|CDbl|CCur|Val)\s+\(/g,
          '$1(');
      }
      return result;
    }

    function showSqlError(err) {
      setOutput('❌ Invalid SQL: ' + ((err && err.message) ? err.message : String(err)), true);
      setStatus('SQL を解析できませんでした。方言の指定を確認してください。', 'error');
    }

    function requireInput() {
      if (input.value.trim()) { return true; }
      setOutput('', false);
      setStatus('Input が空です。SQL を貼り付けてください。');
      input.focus();
      return false;
    }

    function format() {
      if (!requireInput()) { return; }
      try {
        setOutput(formatSql(input.value), false);
        setStatus('整形しました（' + dialectLabel() + '）。', 'ok');
      } catch (err) {
        showSqlError(err);
      }
    }

    /* ── VBA の文字列連結 ⇄ SQL ─────────────── */

    /**
     * 整形済み SQL を VBA の文字列連結に変換する。
     *   sql = "SELECT" & vbCrLf
     *   sql = sql & "  id" & vbCrLf
     * 行継続（_）は 1 文で 24 回までという VBA の制限があるため、
     * 1 行 1 文の形にしている。
     */
    function toVba(sql) {
      var lines = sql.replace(/\r\n?/g, '\n').split('\n');
      while (lines.length && lines[lines.length - 1].trim() === '') { lines.pop(); }
      return lines.map(function (line, i) {
        var literal = '"' + line.replace(/\s+$/, '').replace(/"/g, '""') + '"';
        var head = (i === 0) ? 'sql = ' : 'sql = sql & ';
        var tail = (i === lines.length - 1) ? '' : ' & vbCrLf';
        return head + literal + tail;
      }).join('\n');
    }

    /** VBA の文字列連結らしい行が過半数なら true */
    function looksLikeVba(text) {
      var lines = text.split('\n').filter(function (l) { return l.trim() !== ''; });
      if (!lines.length) { return false; }
      var hits = lines.filter(function (l) {
        return (/^\s*[A-Za-z_][\w.]*\s*=\s*.*"/.test(l))          /* sql = ... "..." */
            || (/^\s*&?\s*"/.test(l) && /(_\s*$|&|vbCrLf)/.test(l)); /* 継続行 */
      }).length;
      return hits >= Math.ceil(lines.length / 2);
    }

    /**
     * VBA の文字列連結から SQL を取り出す。
     * 各行の "…" の中身を順につなぎ、リテラルの外に vbCrLf 等があれば改行する。
     */
    function fromVba(text) {
      var out = '';
      text.replace(/\r\n?/g, '\n').split('\n').forEach(function (line) {
        var literal = /"((?:[^"]|"")*)"/g;
        var parts = [];
        var m;
        while ((m = literal.exec(line)) !== null) { parts.push(m[1].replace(/""/g, '"')); }
        var outside = line.replace(/"(?:[^"]|"")*"/g, '');
        var newline = /\b(vbCrLf|vbNewLine|vbLf)\b|Chr\$?\(\s*10\s*\)/i.test(outside);
        if (!parts.length && !newline) { return; }   /* Dim や空行など、文字列のない行は無視 */
        out += parts.join('');
        if (newline) { out += '\n'; }
      });
      return out.trim();
    }

    function convertVba() {
      if (!requireInput()) { return; }
      var source = input.value;
      if (looksLikeVba(source)) {
        /* VBA → SQL：取り出した SQL を Input に戻して、そのまま整形する */
        input.value = fromVba(source);
        updateMeta();
        try {
          setOutput(formatSql(input.value), false);
          setStatus('VBA から SQL を取り出して整形しました。', 'ok');
        } catch (err) {
          setOutput(input.value, false);
          setStatus('VBA から SQL を取り出しました（整形はできませんでした）。', 'error');
        }
        return;
      }
      /* SQL → VBA：現在の設定で整形してから連結文にする */
      try {
        setOutput(toVba(formatSql(source)), false);
        setStatus('VBA の文字列連結に変換しました（変数名は sql）。', 'ok');
      } catch (err) {
        showSqlError(err);
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
      /* 自分で書いたクエリは消さない。見本のままのときだけ差し替える */
      if (inputIsSample()) { loadSample(); } else { reformat(); }
    });

    $('sqlFormat').addEventListener('click', format);
    $('sqlVba').addEventListener('click', convertVba);
    $('sqlOneLine').addEventListener('click', function () {
      if (!requireInput()) { return; }
      var result = toOneLine(input.value);
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

    $('sqlSample').addEventListener('click', loadSample);

    /* 初期表示：選ばれている方言の見本を整形済みの状態で見せる */
    loadSample();
    setStatus(HINT);
  })();

  /* ══════════ Excel（表 → JSON / Markdown） ══════════ */

  (function initTable() {
    var HINT = 'Excel でセルをコピーして貼り付けてください。タブ区切り・カンマ区切りのどちらでも読めます。';
    var input  = $('xlInput');
    var output = $('xlOutput');
    var setStatus = makeStatus($('xlStatus'), HINT);
    var updateMeta = makeCounter(input, output, $('xlInMeta'), $('xlOutMeta'));

    function setOutput(text, isError) {
      output.value = text;
      output.classList.toggle('is-error', !!isError);
      updateMeta();
    }

    /**
     * タブ／カンマ区切りテキストを 2 次元配列にする。
     * Excel はセル内に改行や区切り文字があると "…" で囲み、" は "" にして出すので、
     * その形（RFC 4180 相当）を読む。
     */
    function parseDelimited(text, delim) {
      var rows = [];
      var row = [];
      var field = '';
      var quoted = false;
      var i = 0;
      var n = text.length;

      function endField() {
        row.push(field.replace(/\r\n?/g, '\n'));
        field = '';
      }

      while (i < n) {
        var c = text.charAt(i);
        if (quoted) {
          if (c === '"') {
            if (text.charAt(i + 1) === '"') { field += '"'; i += 2; continue; }
            quoted = false; i++; continue;
          }
          field += c; i++; continue;
        }
        if (c === '"' && field === '') { quoted = true; i++; continue; }
        if (c === delim) { endField(); i++; continue; }
        if (c === '\r') { i++; continue; }
        if (c === '\n') { endField(); rows.push(row); row = []; i++; continue; }
        field += c; i++;
      }
      if (field !== '' || row.length) { endField(); rows.push(row); }

      /* 末尾の空行（Excel のコピーには必ず付いてくる）を落とす */
      while (rows.length && rows[rows.length - 1].every(function (v) { return v === ''; })) { rows.pop(); }
      return rows;
    }

    /** 見出し行からキーを作る。空欄は col1、重複は name_2 のように補う */
    function makeKeys(headerRow, width) {
      var keys = [];
      var seen = {};
      for (var i = 0; i < width; i++) {
        var key = (headerRow[i] || '').trim() || ('col' + (i + 1));
        var base = key;
        var k = 2;
        while (seen[key]) { key = base + '_' + (k++); }
        seen[key] = true;
        keys.push(key);
      }
      return keys;
    }

    /** セルの文字列を JSON の値に。数値・真偽値だけを変換し、それ以外は文字列のまま */
    function typedValue(v) {
      if (v === '') { return null; }
      if (/^-?\d{16,}$/.test(v)) { return v; }                  /* 桁が多すぎて精度が落ちる数は文字列で */
      if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(v)) { return Number(v); }   /* 001 のような先頭ゼロは文字列のまま */
      if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(v)) { return Number(v.replace(/,/g, '')); } /* 1,234,567 */
      if (/^(true|false)$/i.test(v)) { return v.toLowerCase() === 'true'; }
      return v;
    }

    function isNumeric(v) {
      return v !== '' && typeof typedValue(v) === 'number';
    }

    function toJson(rows, hasHeader, typed) {
      var width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
      var body = hasHeader ? rows.slice(1) : rows;
      var conv = typed ? typedValue : function (v) { return v; };
      if (!hasHeader) {
        return JSON.stringify(body.map(function (r) {
          var arr = [];
          for (var i = 0; i < width; i++) { arr.push(conv(r[i] || '')); }
          return arr;
        }), null, 2);
      }
      var keys = makeKeys(rows[0], width);
      return JSON.stringify(body.map(function (r) {
        var obj = {};
        keys.forEach(function (key, i) { obj[key] = conv(r[i] || ''); });
        return obj;
      }), null, 2);
    }

    /** 表示幅。全角を 2、半角を 1 として数え、Markdown の桁揃えに使う */
    function displayWidth(s) {
      var w = 0;
      for (var i = 0; i < s.length; i++) {
        var code = s.charCodeAt(i);
        if (code >= 0xD800 && code <= 0xDBFF) { w += 2; i++; continue; }   /* サロゲートペア（絵文字など） */
        w += (code >= 0x2E80 && !(code >= 0xFF61 && code <= 0xFF9F)) ? 2 : 1;  /* 半角カナは 1 */
      }
      return w;
    }

    function pad(s, width, right) {
      var fill = new Array(Math.max(0, width - displayWidth(s)) + 1).join(' ');
      return right ? fill + s : s + fill;
    }

    function toMarkdown(rows, hasHeader) {
      var width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
      var header = hasHeader ? makeKeys(rows[0], width) : makeKeys([], width);
      var body = hasHeader ? rows.slice(1) : rows;
      var esc = function (v) { return v.replace(/\|/g, '\\|').replace(/\n/g, '<br>'); };

      var cols = [];
      for (var c = 0; c < width; c++) {
        var cells = body.map(function (r) { return esc(r[c] || ''); });
        var nonEmpty = cells.filter(function (v) { return v !== ''; });
        cols.push({
          head: esc(header[c]),
          cells: cells,
          numeric: nonEmpty.length > 0 && nonEmpty.every(isNumeric),
          width: Math.max(3, displayWidth(esc(header[c])), Math.max.apply(null, cells.map(displayWidth).concat([0])))
        });
      }

      var line = function (pick) {
        return '| ' + cols.map(pick).join(' | ') + ' |';
      };
      var out = [
        line(function (col) { return pad(col.head, col.width, false); }),
        line(function (col) {
          var bar = new Array(col.width).join('-');
          return col.numeric ? bar + ':' : bar + '-';
        })
      ];
      body.forEach(function (r, ri) {
        out.push(line(function (col) { return pad(col.cells[ri], col.width, col.numeric); }));
      });
      return out.join('\n');
    }

    /** CSV（RFC 4180）。カンマ・引用符・改行を含むセルだけ "…" で囲む */
    function csvField(v) {
      return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    }

    function toCsv(rows) {
      var width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
      return rows.map(function (r) {
        var cells = [];
        for (var i = 0; i < width; i++) { cells.push(csvField(r[i] || '')); }
        return cells.join(',');
      }).join('\n');
    }

    /** Python のリテラルに。文字列は " で囲み、\ " 改行 タブ をエスケープ */
    function pyLiteral(v, typed) {
      var val = typed ? typedValue(v) : v;
      if (val === null)  { return 'None'; }
      if (val === true)  { return 'True'; }
      if (val === false) { return 'False'; }
      if (typeof val === 'number') { return String(val); }
      return '"' + val
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t') + '"';
    }

    /**
     * pandas の DataFrame を作るコード。見出しがあれば列名をキーにした dict、
     * なければ行のリスト。Notebook にそのまま貼れる形にする
     */
    function toPandas(rows, hasHeader, typed) {
      var width = Math.max.apply(null, rows.map(function (r) { return r.length; }));
      var body = hasHeader ? rows.slice(1) : rows;
      var lines = ['import pandas as pd', ''];
      if (!hasHeader) {
        lines.push('df = pd.DataFrame([');
        body.forEach(function (r) {
          var cells = [];
          for (var i = 0; i < width; i++) { cells.push(pyLiteral(r[i] || '', typed)); }
          lines.push('    [' + cells.join(', ') + '],');
        });
        lines.push('])');
        return lines.join('\n');
      }
      var keys = makeKeys(rows[0], width);
      lines.push('df = pd.DataFrame({');
      keys.forEach(function (key, i) {
        var values = body.map(function (r) { return pyLiteral(r[i] || '', typed); });
        lines.push('    ' + pyLiteral(key, false) + ': [' + values.join(', ') + '],');
      });
      lines.push('})');
      return lines.join('\n');
    }

    function convert() {
      var source = input.value;
      if (!source.trim()) {
        setOutput('', false);
        setStatus('Input が空です。Excel からセルをコピーして貼り付けてください。');
        input.focus();
        return;
      }
      var delim = source.indexOf('\t') >= 0 ? '\t' : ',';
      var rows = parseDelimited(source, delim);
      if (!rows.length) {
        setOutput('', false);
        setStatus('読み取れる行がありませんでした。');
        return;
      }
      var hasHeader = header.get() === 'yes';
      if (hasHeader && rows.length < 2) {
        setOutput('❌ 見出し行しかありません。データ行を含めて貼り付けるか、Header を「none」にしてください。', true);
        setStatus('データ行がありません。', 'error');
        return;
      }
      var typed = types.get() === 'typed';
      var kind = format.get();
      var result, label;
      if (kind === 'md')          { result = toMarkdown(rows, hasHeader);       label = 'Markdown 表'; }
      else if (kind === 'csv')    { result = toCsv(rows);                       label = 'CSV'; }
      else if (kind === 'pandas') { result = toPandas(rows, hasHeader, typed);  label = 'pandas の DataFrame'; }
      else                        { result = toJson(rows, hasHeader, typed);    label = 'JSON'; }
      setOutput(result, false);
      var dataRows = hasHeader ? rows.length - 1 : rows.length;
      setStatus(label + ' に変換しました（' + dataRows + ' 行 × ' + rows[0].length + ' 列、' + (delim === '\t' ? 'タブ' : 'カンマ') + '区切り）。', 'ok');
    }

    function reconvert() {
      if (output.value && !output.classList.contains('is-error')) { convert(); }
    }

    /* 型変換の選択肢は、型を持てる出力（JSON / pandas）のときだけ見せる */
    function hasTypes(kind) { return kind === 'json' || kind === 'pandas'; }

    var format = segGroup($('segXlFormat'), 'atelier-xl-format', 'json', function (v) {
      $('optXlTypes').hidden = !hasTypes(v);
      reconvert();
    });
    var header = segGroup($('segXlHeader'), 'atelier-xl-header', 'yes',   reconvert);
    var types  = segGroup($('segXlTypes'),  'atelier-xl-types',  'typed', reconvert);
    $('optXlTypes').hidden = !hasTypes(format.get());

    var SAMPLE = [
      'id\t氏名\t部署\t入社日\t勤続年数\t在籍\t備考',
      '001\t田中 太郎\t営業部\t2019-04-01\t7\tTRUE\t',
      '002\t佐藤 花子\t開発部\t2021-10-15\t4.5\tTRUE\t兼務: 総務',
      '003\t鈴木 一郎\t営業部\t2016-04-01\t10\tFALSE\t"2026-03-31 退職\n再雇用予定"'
    ].join('\n');

    $('xlConvert').addEventListener('click', convert);
    $('xlCopy').addEventListener('click', function () { copyText(output.value, setStatus); });
    $('xlSample').addEventListener('click', function () {
      input.value = SAMPLE;
      convert();
      setStatus('見本を読み込みました。先頭ゼロの id は文字列のまま、数値と TRUE/FALSE は型変換されます。', 'ok');
    });
    $('xlClear').addEventListener('click', function () {
      input.value = '';
      setOutput('', false);
      setStatus('Input / Output をクリアしました。');
      input.focus();
    });

    input.addEventListener('input', updateMeta);
    input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); convert(); }
    });

    /* 初期表示：見本を変換済みの状態で見せる */
    input.value = SAMPLE;
    convert();
    setStatus(HINT);
  })();

  /* 前回開いていたタブを復元する */
  var savedTab = store('atelier-tab');
  if (savedTab && $('tab-' + savedTab)) { $('tab-' + savedTab).click(); }
})();
