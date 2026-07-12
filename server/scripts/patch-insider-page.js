const fs = require("fs");
let s = fs.readFileSync("client/components/insider-hub/InsiderArticlesPage.tsx", "utf8");
if (s.includes("RelatedArticlesSection")) { console.log("skip page"); process.exit(0); }
s = s.replace(
  "  fetchInsiderHubBundle,\n  type InsiderArticle,\n} from '@/lib/insider-api';",
  "  fetchInsiderHubBundle,\n  fetchInsiderRelated,\n  type InsiderArticle,\n} from '@/lib/insider-api';"
);
s = s.replace(
  "function FeaturedInsiderArticle({ article }: { article: InsiderArticle }): React.ReactElement {",
  `function RelatedArticlesSection({ articles }: { articles: InsiderArticle[] }): React.ReactElement | null {
  if (!articles.length) return null;
  return (
    <section className="insider-section" data-testid="insider-related">
      <h2 className="insider-section-title">Related Articles</h2>
      <div className="insider-article-grid">
        {articles.map((article) => (
          <a key={article.id} href={articleRoute(article.id)} className="insider-article-card">
            <span className="insider-article-category">{article.category}</span>
            <h3 className="insider-article-title">{article.title}</h3>
            <p className="insider-article-preview">{article.preview}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

function FeaturedInsiderArticle({ article }: { article: InsiderArticle }): React.ReactElement {`
);
s = s.replace(
  "  const [tags, setTags] = useState<InsiderTag[]>([]);",
  "  const [tags, setTags] = useState<InsiderTag[]>([]);\n  const [related, setRelated] = useState<InsiderArticle[]>([]);"
);
s = s.replace(
  "  }, [load]);\n\n  const filteredArticles = useMemo(() => {",
  `  }, [load]);

  useEffect(() => {
    if (!featured?.id) {
      setRelated([]);
      return;
    }
    fetchInsiderRelated(featured.id).then(setRelated).catch(() => setRelated([]));
  }, [featured?.id]);

  const filteredArticles = useMemo(() => {`
);
s = s.replace(
  `            {featured ? (
              <section className="insider-section">
                <FeaturedInsiderArticle article={featured} />
              </section>
            ) : null}`,
  `            {featured ? (
              <section className="insider-section">
                <FeaturedInsiderArticle article={featured} />
              </section>
            ) : null}

            <RelatedArticlesSection articles={related} />`
);
fs.writeFileSync("client/components/insider-hub/InsiderArticlesPage.tsx", s, "utf8");
console.log("page patched");