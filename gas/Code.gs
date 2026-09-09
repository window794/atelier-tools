/**
 * atelier / 道具棚 v1.0 — Google Apps Script Web App エントリポイント
 *
 * JSON の整形はすべてブラウザ側の JavaScript で完結する。
 * このスクリプトは index.html を配信するだけで、
 * 入力されたテキストをサーバーが受け取ることも保存することもない。
 */

/** Web App の GET リクエストを受けて画面を返す */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('atelier｜道具棚')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}
