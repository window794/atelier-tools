# atelier / 道具棚 v1.0 — デプロイマニュアル

JSON フォーマッタの公開手順です。
JSON の整形はすべてブラウザ内の JavaScript で完結するため、**サーバーは不要**です。
静的ホスティング（GitHub Pages）が本命、GAS は「Google アカウントで限定公開したい」ときの控えです。

---

## 0. ファイル構成

```
atelier-tools/
├── index.html            … 画面（これを開けば動きます）
├── assets/
│   ├── style.css         … Lily DNA のトークンとコンポーネント
│   └── app.js            … 整形・ミニファイ・コピーの処理
├── README.md             … リポジトリの説明
├── DEPLOY.md             … このファイル
└── gas/                  … GAS で公開する場合だけ使う（1ファイル版）
    ├── Code.gs
    └── index.html
```

`index.html` をダブルクリックすれば、そのままローカルで使えます。

> **`gas/index.html` は v1.0 時点の 1 ファイル版スナップショット**です。
> CSS / JS を内側に抱えているので、`assets/` を直しても自動では反映されません。
> GAS 側も更新したい場合は、`index.html` の `<link>` と `<script>` を
> `<style>…</style>` と `<script>…</script>` に展開して貼り直してください。

---

## 1. GitHub Pages で公開する（推奨）

### 1-1. リポジトリに置く

このフォルダごと push します。既存リポジトリのサブディレクトリでも構いません。

```bash
git init
git add .
git commit -m "atelier-tools v1.0"
git branch -M main
git remote add origin https://github.com/<ユーザー名>/atelier-tools.git
git push -u origin main
```

### 1-2. Pages を有効にする

1. GitHub のリポジトリ → **Settings** → 左メニューの **Pages**
2. **Source** を **Deploy from a branch** にする
3. **Branch** を `main` / `/ (root)` にして **Save**
4. 1〜2 分待つと `https://<ユーザー名>.github.io/atelier-tools/` で公開されます

サブディレクトリに置いた場合は `.../atelier-tools/` のようになります。
`assets/` は相対パス参照なので、どの階層に置いても動きます。

### 1-3. 更新する

```bash
git add .
git commit -m "整形結果のコピー挙動を調整"
git push
```

push から反映まで 1 分ほどかかります。すぐ変わらなくても慌てず、
ブラウザのスーパーリロード（Ctrl + Shift + R）で確認してください。

> **非公開にしたい場合** … GitHub Pages は Public リポジトリだと誰でも閲覧できます。
> URL を知られたくないだけなら十分ですが、確実に隠したいならローカルの
> `index.html` を使うか、後述の GAS（アクセス範囲＝自分のみ）にしてください。

---

## 2. 動作確認チェックリスト

| 確認項目 | 期待する動作 |
|----------|--------------|
| 初期表示 | サンプル JSON が整形された状態で表示される |
| Format | 崩れた JSON がインデント付きで整形される |
| インデント 2 / 4 | 切り替えると出力のインデント幅がその場で変わる |
| Minify | 空白・改行が消えて 1 行になる |
| Copy | 「Output をコピーしました。」と出て、整形済み JSON が貼り付けできる |
| Clear | Input / Output が空になる |
| 不正な JSON | `❌ Invalid JSON: …` とエラー位置が表示される |
| light / dark | ピルスイッチでテーマが切り替わり、リロードしても保持される |
| スマホ表示 | 幅 768px 以下で Input / Output が上下に並ぶ |

CSS / JS を分けたので、**表示が真っ白なら `assets/` のパス切れ**を疑ってください
（ブラウザの開発者ツール → Network で 404 を確認）。

---

## 3. 仕様メモ・既知の制限

- **データはどこにも送られません。** 整形は `JSON.parse` / `JSON.stringify` による
  ブラウザ内処理のみで、通信は Google Fonts の読み込みだけです。
- **キーの順序** … `{"2":…, "1":…, "a":…}` のように数字だけのキーがある場合、
  JavaScript の仕様で数値キーが先に昇順で並び替えられます。
- **巨大な整数** … 約 9007 兆（`Number.MAX_SAFE_INTEGER`）を超える数値は
  丸められて精度が落ちます。
- **コピー** … `navigator.clipboard` が使えない環境では `execCommand('copy')` に
  自動フォールバックします。それも失敗した場合は Output を選択して手動コピーを。
- **設定の保存** … テーマとインデント幅を localStorage に保存します。
  保存できない環境では既定値（light / インデント 2）で動きます。

---

## 4. Phase 2（SQL フォーマッタ）の入れどころ

- タブ UI は実装済みです。`index.html` の `#panel-sql` の中身を差し替えます。
- ボタン・カード・バッジ・ピルは JSON タブと同じクラスを使い回せます。
- `assets/app.js` の `convert()` と同じ形で SQL 用の関数を足し、
  タブの選択状態で呼び分けるのがいちばん素直です。

---

## 付録. Google Apps Script で公開する場合

Google アカウントでログインした人だけに見せたいとき用です。

1. https://script.google.com/home → **［新しいプロジェクト］**
2. プロジェクト名を **atelier** に変更
3. `コード.gs` の中身を消し、`gas/Code.gs` を貼って保存
4. **［ファイル］の ＋** → **［HTML］** → ファイル名を **`index`**（`.html` 不要）にし、
   `gas/index.html` を貼って保存
5. 右上 **［デプロイ］** → **［新しいデプロイ］** → 種類 **［ウェブアプリ］**

   | 項目 | 設定値 |
   |------|--------|
   | 次のユーザーとして実行 | 自分 |
   | アクセスできるユーザー | 自分のみ（個人利用の場合） |

6. 初回のみ承認画面が出ます。「確認されていません」の警告は自作スクリプトでは正常なので、
   **［詳細］** → **［atelier（安全ではないページ）に移動］** → **［許可］**
7. 表示された `https://script.google.com/macros/s/.../exec` が URL です

**更新するときは ［デプロイを管理］ → 鉛筆アイコン → バージョンを［新バージョン］→［デプロイ］。**
［新しいデプロイ］を選ぶと URL が変わってしまうので注意してください。
