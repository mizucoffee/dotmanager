# dotManager
dotCampus管理システム(非公式)

## 機能
- dotCampusのスケジュールを ~~Googleカレンダー~~ Google Taskに同期

## 免責
### 堅苦しい免責
このプロジェクトは非公式です。スクレイピングをしています。     
このプロジェクトを利用する等の行為に関連して生じたあらゆる損害等についても、作者は一切の責任を負いません。

### 豆腐免責
全部自己責任で使ってね。

## 注意
### 堅苦しいわけではないけどちょっと堅い注意
このプロジェクトは一般の方を対象としていません。     
最低限の導入方法は下に記載していますが

- Google Tasks API用のキーの取得
- サーバーの用意
- nodeの環境構築

を自力でする必要があります。導入方法に関して作者は一切の助言をしません。     
システム的にはサービスに落とし込む事は可能ですが、他人のパスワードを扱うことになる等、様々な問題が発生するため対応しません。

### メレンゲ注意
分かる人が使ってね。

## 通知について
dotManagerではAndroidへの通知のみ対応しています。
通知には[WirePusher](http://wirepusher.com/)を採用しています。

## iOS Reminders連携について
ベースはGoogle Tasksです。これは管理に使用している為マストです。     
追加でiOS Remindersに対応しています。IFTTTを用いて連携しています。     
value1にタイトル、value2に期限時刻データが入っています。

## 導入

1. [Google Tasks API Node.js Quickstart](https://developers.google.com/tasks/quickstart/nodejs)を開く
2. ENABLE THE TASKS CALENDAR API > DOWNLOAD CLIENT CONFIGURATION
3. credentials.jsonをindex.jsと同じ階層に配置
4. configフォルダ内のdefault.sample.jsonをdefault.jsonにコピー
5. default.jsonを適当な内容に修正
6. `$ npm i # or $ yarn`
7. `$ node index.js`

※この導入ではフォアグラウンドで実行されます。各自screenやpm2、Docker等でバックグラウンドに切り替えると運用しやすいかと思います。     
※dotCampusのURLは、トップページのURLのPortalの直前までです。https://example.com/aaa/bbb/Portal/...であれば、https://example.com/aaa/bbb/になります。

## アップデートについて
作者が不便だと思った時に機能が増えます。
Issuesに投げてもらえれば検討はしますが実装するかはわかりません。
