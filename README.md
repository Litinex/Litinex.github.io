# 个人博客

这是一个无需安装依赖、直接打开 `index.html` 就能预览的静态个人博客模板。

现在它已经补齐了适合 `GitHub Pages` 免费发布和搜索引擎收录的基础文件：

- 页面标题、描述和 canonical
- 结构化数据 `JSON-LD`
- `robots.txt`
- `sitemap.xml`
- `.nojekyll`
- `favicon.svg`

## 当前结构

- `index.html`：博客首页
- `about.html`：关于页
- `styles.css`：全站样式
- `favicon.svg`：站点图标
- `robots.txt`：搜索引擎抓取规则
- `sitemap.xml`：站点地图
- `posts/`：文章页面目录

## 发布到 GitHub Pages

最简单的免费方案，是把仓库命名为 `你的GitHub用户名.github.io`，这样站点地址就是：

`https://你的GitHub用户名.github.io/`

### 步骤

1. 注册或登录 GitHub
2. 新建一个公开仓库，名字设为 `你的GitHub用户名.github.io`
3. 把当前目录全部文件上传到仓库根目录
4. 打开仓库的 `Settings` -> `Pages`
5. 在 `Build and deployment` 里选择 `Deploy from a branch`
6. 分支选 `main`，目录选 `/ (root)`，保存
7. 等几十秒到几分钟，GitHub 会给你一个公开网址

## 发布前必须改的占位内容

当前这些文件里用了占位地址：

`https://Litinex.github.io`

你发布前要把它统一替换成你自己的真实 GitHub Pages 地址。

需要替换的文件：

- `index.html`
- `about.html`
- `posts/first-post.html`
- `posts/notes-template.html`
- `posts/life-fragments.html`
- `robots.txt`
- `sitemap.xml`

如果以后你买了自己的域名，也把这些地址再替换成你的域名。

## 让搜索引擎收录

站点上线后，可以免费提交到搜索引擎：

1. 打开 Google Search Console
2. 添加站点，使用你的 `https://你的GitHub用户名.github.io/`
3. 按提示验证所有权
4. 提交 sitemap：
   `https://你的GitHub用户名.github.io/sitemap.xml`
5. 再到 Bing Webmaster Tools 做同样的事

提示：

- 提交之后不会立刻搜到，通常要几天到几周
- 刚开始更容易通过搜索你的博客名搜到，而不是搜很泛的词
- 想提高被搜到的概率，要持续发内容，并让博客名足够独特

## 你后续最常改的地方

1. 首页顶部博客名和介绍
2. `index.html` 里的文章卡片
3. `posts/` 目录下的具体文章内容
4. `styles.css` 中的颜色、字体、间距和按钮样式
