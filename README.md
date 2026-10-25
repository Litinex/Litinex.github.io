# 个人博客

纯静态个人博客，部署在 GitHub Pages（自定义域名 `yezizhuang.top`）。页面可以直接打开预览；生成站点地图、相关推荐、公共片段和资源版本号需要 Node.js。

## 当前结构

- `index.html` / `archive.html` / `about.html` / `404.html`：根目录页面
- `posts/`：文章页面，每篇一个 HTML
- `posts-data.js`：所有文章的元数据（标题、日期、分类、标签、系列等），首页、归档、推荐和站点地图都从这里读取
- `partials/`：公共片段，构建时自动填进各个页面
  - `site-header.html`：根目录页面的页头导航
  - `article-header.html`：文章页的页头导航
  - `article-assets.html`：文章页统一引用的样式和脚本
- `scripts/build-site-assets.js`：构建脚本（见下）
- `scripts/test-*.js`：浏览器测试（需要 Playwright）
- `styles.css`：全站样式；其余 `*.js` 是各页面的功能脚本

## 日常流程

新增或修改任何内容后，在项目根目录运行：

```
node scripts/build-site-assets.js
```

它会依次：

1. 校验 `posts-data.js`（id、日期、文件是否存在、代码块 id 是否重复等）
2. 生成 `sitemap.xml` 和 `related-posts-data.js`
3. 把 `partials/` 里的片段填进所有页面里 `<!-- partial:名字 -->` 和 `<!-- /partial:名字 -->` 之间（这两行注释之间的内容会被覆盖，不要手改）
4. 把所有本地 `.css` / `.js` 引用的 `?v=` 改成文件内容哈希——文件改了版本号自动变，不需要再手动维护

脚本可以重复运行，内容没变时不会改动任何文件。

### 新增一篇文章

1. 复制 `posts/` 里任意一篇文章作为模板（保留里面的 `partial` 注释）
2. 修改正文、`<head>` 里的标题/描述/canonical，以及 `<body>` 上的 `data-post-id`
3. 在 `posts-data.js` 里加一条记录
4. 运行构建脚本

### 修改导航或公共脚本

只改 `partials/` 里对应的文件，然后运行构建脚本，所有页面会一起更新。

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

## 让搜索引擎收录

站点上线后，可以免费提交到搜索引擎：

1. 打开 Google Search Console
2. 添加站点 `https://yezizhuang.top/`
3. 按提示验证所有权
4. 提交 sitemap：
   `https://yezizhuang.top/sitemap.xml`
5. 再到 Bing Webmaster Tools 做同样的事

提示：

- 提交之后不会立刻搜到，通常要几天到几周
- 刚开始更容易通过搜索你的博客名搜到，而不是搜很泛的词
- 想提高被搜到的概率，要持续发内容，并让博客名足够独特
