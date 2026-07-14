(() => {
  if (!document.body.classList.contains("article-page")) return;

  const posts = Array.isArray(window.__BLOG_POSTS__) ? window.__BLOG_POSTS__ : [];
  const related = window.__BLOG_RELATED_POSTS__;
  const safeText = (value) => (typeof value === "string" ? value.trim() : "");
  if (!related || typeof related !== "object") return;

  const file = String(window.location.pathname || "").replace(/\\/g, "/").split("/").pop();
  const current = posts.find((post) => safeText(post.href).split("/").pop() === file);
  const recommendations = current ? related[current.id] : null;
  const pagination = document.querySelector(".article-pagination");
  if (!current || !Array.isArray(recommendations) || recommendations.length === 0 || !pagination) return;

  const byId = new Map(posts.map((post) => [safeText(post.id), post]));
  const section = document.createElement("section");
  section.className = "article-recommendations";
  section.setAttribute("aria-labelledby", "related-reading-title");

  const heading = document.createElement("div");
  heading.className = "article-recommendations-heading";
  const kicker = document.createElement("p");
  kicker.className = "section-kicker";
  kicker.textContent = "Continue Exploring";
  const title = document.createElement("h2");
  title.id = "related-reading-title";
  title.textContent = "继续阅读";
  heading.append(kicker, title);

  const list = document.createElement("div");
  list.className = "article-recommendation-list";
  recommendations.forEach((entry) => {
    const post = byId.get(safeText(entry.id));
    if (!post) return;

    const link = document.createElement("a");
    link.className = "article-recommendation-card";
    link.href = safeText(post.href).split("/").pop();
    const meta = document.createElement("span");
    meta.className = "article-recommendation-meta";
    meta.textContent = safeText(entry.reason) || safeText(post.category);
    const postTitle = document.createElement("strong");
    postTitle.textContent = safeText(post.title);
    const excerpt = document.createElement("span");
    excerpt.className = "article-recommendation-excerpt";
    excerpt.textContent = safeText(post.excerpt);
    link.append(meta, postTitle, excerpt);
    list.appendChild(link);
  });

  if (list.children.length === 0) return;
  section.append(heading, list);
  pagination.insertAdjacentElement("beforebegin", section);
})();
