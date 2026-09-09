# atelier-tools

> 道具棚 — 静かに使える、個人用のウェブ道具置き場。

JSON と SQL を整形するだけの、広告もトラッキングもないツールです。
処理はすべてブラウザ内で完結し、入力したテキストはどこにも送信されません。

**🔗 https://window794.github.io/atelier-tools/**

---

## できること

### JSON タブ

| 機能 | 説明 |
|------|------|
| **Format** | インデント付きで整形する（幅は 2 / 4 から選択） |
| **Minify** | 余分な空白と改行を削って 1 行にする |
| **Copy** | 整形結果をクリップボードにコピーする |
| **Clear** | 入力と出力をリセットする |

### SQL タブ

| 機能 | 説明 |
|------|------|
| **Format** | 句ごとに改行してインデントする |
| **One line** | 1 行に戻す（文字列リテラル内の空白はそのまま） |
| **Sample** | 選んでいる方言らしい書き方の見本を読み込む |
| **Dialect** | Standard / MySQL / PostgreSQL / SQL Server / Oracle / SQLite / Access |
| **Indent** | Tab / スペース 2 / スペース 4 |
| **Keyword** | 予約語を UPPER / lower / そのまま |
| **And・Or** | AND・OR を改行の前に置くか後に置くか |

- 不正な入力は `❌ Invalid JSON: …` / `❌ Invalid SQL: …` とエラー箇所を表示します
- `Ctrl + Enter`（Mac は `⌘ + Enter`）でも整形できます
- ライト / ダークの切り替え、インデント幅の設定はブラウザに保存されます
- 画面幅 768px 以下では入力欄と出力欄が上下に並びます

## 使い方

上のリンクを開いて、左の Input に JSON を貼り付けて **Format** を押すだけです。
インストールもアカウント登録も要りません。

ローカルで使いたい場合は、リポジトリを clone して `index.html` を
ブラウザで開けばそのまま動きます（ビルド不要）。

```bash
git clone https://github.com/window794/atelier-tools.git
```

## 構成

```
atelier-tools/
├── index.html          # 画面
├── assets/
│   ├── style.css       # 配色・タイポグラフィ・レイアウト
│   ├── app.js          # JSON / SQL の整形処理
│   └── vendor/         # sql-formatter（MIT・同梱）
├── DEPLOY.md           # 公開・更新手順
└── gas/                # Google Apps Script で公開する場合の 1 ファイル版
```

ビルド不要、パッケージマネージャ不要です。JSON の整形は標準の
`JSON.parse` / `JSON.stringify`、SQL の整形は同梱の
[sql-formatter](https://github.com/sql-formatter-org/sql-formatter)（MIT）を使っています。
CDN からは読まず、リポジトリに同梱しているので、オフラインでも動きます。

### ローカルで確認する

`index.html` を直接開くだけで動きますが、公開時と同じ状態で見たいときは
簡易サーバー経由が確実です。

```bash
python -m http.server 8000
```

## プライバシー

- 入力されたテキストはブラウザの外に出ません。サーバー処理は一切ありません。
- 保存するのはテーマとインデント幅の設定のみで、`localStorage` に置いています。
- 外部通信は Google Fonts の読み込みだけです。

## 既知の制限

- **キーの順序** — `{"2":…, "1":…}` のように数字だけのキーがある場合、
  JavaScript の仕様で数値キーが先に昇順で並びます。
- **巨大な整数** — `Number.MAX_SAFE_INTEGER`（約 9007 兆）を超える数値は
  丸められて精度が落ちます。
- **SQL のカンマ前置き** — 「カンマ前」「桁ぞろえ」スタイルには未対応です。
- **SQL の One line** — 行コメント（`--`）は取り除かれます。1 行にすると
  後続のクエリまで巻き込んでしまうためです。
- **Access** — `[表]![列]` と `#日付#` を一時的に伏せ字にしてから SQL Server
  として整形し、あとで元に戻しています。`TRANSFORM` / `PIVOT` を使ったクロス集計
  クエリのような Access 固有の構文までは面倒を見きれません。

## デザイン

配色は「春の朝の、上品で知的な透明感」をコンセプトにした自作のデザインルール準拠。
ベースはクリーミーオフホワイト `#FAF6F0`、アクセントは霞水色 `#B8D4E0`、
書体は Cormorant Garamond と ZEN Old Mincho を使っています。
ダークモードは「夜明け前」の `#1C2128` に切り替わります。

---

個人用のツールとして作っていますが、同じものが必要な方はご自由にどうぞ。
