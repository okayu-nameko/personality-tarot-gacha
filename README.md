# 人格タロット式キャラクターガチャ

TRPGのキャラクター作成を助ける、占い風のランダムジェネレーターです。

大アルカナ22枚から重複なしで5枚を引き、カードの意味を次の5カテゴリへ読み替えます。

1. 見た目
2. 職業
3. 人格・生活・価値観
4. 人間関係
5. 傷・矛盾

同じカードでも、正位置・逆位置、置かれたカテゴリ、文章候補の抽選によって結果が変わります。占いとして人物や未来を断定するものではなく、PLが「この人物ならどう動くか」を考えるための発想ツールです。

## ローカルで使う方法

特別なソフトやインストールは不要です。

1. このフォルダを開きます。
2. `index.html` をダブルクリックします。
3. ブラウザで画面が開いたら「5枚のカードを引く」を押します。

うまく開かない場合は、`index.html` を右クリックし、「プログラムから開く」からChrome、Edge、Firefoxなどのブラウザを選んでください。

## 遊び方

- 裏向きのカードをクリックすると、カードと対応する人物像が表示されます。
- 気に入った結果は「固定」できます。
- 各カテゴリは個別に再抽選できます。固定中のカテゴリは個別再抽選できません。
- 「未固定だけ再抽選」は、固定した結果を残してほかを引き直します。
- 「全部再抽選」は、固定をすべて解除して5枚とも引き直します。
- 「結果全文をコピー」で、セッションメモなどへ貼り付けられます。

## GitHub Pagesで公開する方法

以下は、まだGitHub上にリポジトリを作っていない場合の手順です。公開作業をする時までは実行しなくても構いません。

### 1. GitHubに空のリポジトリを作る

1. [GitHub](https://github.com/)へログインします。
2. 画面右上の「+」から「New repository」を選びます。
3. `Repository name` に、たとえば `personality-tarot-gacha` と入力します。
4. 公開してよければ `Public` を選びます。
5. `Add a README file` などの初期化項目にはチェックを入れません。このフォルダには既にREADMEとGit履歴があるためです。
6. 「Create repository」を押します。

### 2. このフォルダをGitHubへ送る

リポジトリ作成後の画面に表示されるURLを使います。Windows TerminalまたはPowerShellでこのフォルダを開き、次を順番に実行してください。

```powershell
git remote add origin https://github.com/あなたのユーザー名/personality-tarot-gacha.git
git push -u origin main
```

`あなたのユーザー名` は自分のGitHubユーザー名へ置き換えます。GitHubからサインインを求められた場合は、画面の案内に従ってください。

既に `origin` を登録済みの場合、`git remote add origin ...` は再実行しません。更新内容を送る時は、通常は次だけで足ります。

```powershell
git push
```

### 3. GitHub Pagesを有効にする

1. GitHubで作成したリポジトリのページを開きます。
2. 上部の「Settings」を開きます。画面幅が狭い場合は、上部メニューの「…」内にあります。
3. 左側メニューの「Pages」を選びます。
4. `Build and deployment` の `Source` で「Deploy from a branch」を選びます。
5. `Branch` で `main` と `/ (root)` を選び、「Save」を押します。
6. 数分待って同じPages画面を開き直します。

公開URLは通常、次の形です。

```text
https://あなたのユーザー名.github.io/personality-tarot-gacha/
```

更新をGitHubへプッシュすると、GitHub Pages側も通常は数分で自動更新されます。

## データを追加・編集する場所

カード名、意味タグ、生成文章はすべて `data.js` にあります。

- `TAROT_CATEGORIES`: 5カテゴリの表示名と、表示する文章数
- `TAROT_CARDS`: 大アルカナ22枚の基本情報、正位置・逆位置の意味タグ、カテゴリ別の文章候補
- `CONTRADICTION_BY_TAG`: 人格の表向きな傾向を「傷・矛盾」へ軽く接続する補助文

各カードは次のような構造です。

```javascript
{
  number: 0,
  numeral: "0",
  nameJa: "愚者",
  nameEn: "The Fool",
  symbol: "∞",
  upright: makeReading(
    ["自由", "好奇心", "衝動", "未知", "楽観"],
    [/* 見た目の候補 */],
    [/* 職業の候補 */],
    [/* 人格・生活・価値観の候補 */],
    [/* 人間関係の候補 */],
    [/* 傷・矛盾の候補 */]
  ),
  reversed: makeReading(/* 逆位置も同じ並び */)
}
```

文章候補を追加する時は、既存の引用符 `"..."` と、項目間のカンマ `,` を消さないよう注意してください。文章は最後に `。` を付けると表示がそろいます。

## ファイル構成

```text
personality-tarot-gacha/
├─ index.html  # 画面の構造
├─ style.css   # 色、配置、カードのアニメーション、レスポンシブ対応
├─ data.js     # タロットと生成文章のデータ
├─ app.js      # 抽選、固定、再抽選、カード表示、コピー処理
└─ README.md   # この説明書
```

HTML / CSS / Vanilla JavaScriptだけで作られており、npm、外部フレームワーク、ビルド処理は使用していません。

## Gitで変更を記録する基本手順

ファイルを編集した後は、このフォルダで次を実行すると変更を記録できます。

```powershell
git status
git add .
git commit -m "変更内容を短く書く"
```

`git status` は現在の変更確認、`git add .` は記録対象の選択、`git commit` はその時点の状態を履歴へ保存する操作です。
