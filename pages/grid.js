import { useEffect, useState } from "react";
import { useRouter } from "next/router";

export default function Grid() {
  const router = useRouter();
  const { slug } = router.query;

  const [posts, setPosts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;

    async function load() {
      try {
        const res = await fetch(`/api/get-posts?slug=${slug}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Failed to load");
          return;
        }

        setPosts(data);
      } catch (e) {
        setError("Server error");
      }
    }

    load();
  }, [slug]);

  if (!slug) return <p>Missing widget slug</p>;
  if (error) return <p>{error}</p>;

  return (
    <div style={styles.wrapper}>
      <h3 style={styles.title}>Grid Planner</h3>

      <div style={styles.grid}>
        {posts
          .filter((p) => !p.hide)
          .map((post) => (
            <div key={post.id} style={styles.card}>
              {post.thumbnail && (
                <img
                  src={post.thumbnail}
                  alt=""
                  style={styles.media}
                />
              )}

              {!post.thumbnail && post.attachment?.[0] && (
                <img
                  src={post.attachment[0]}
                  alt=""
                  style={styles.media}
                />
              )}

              {!post.thumbnail && post.video && post.video.endsWith(".mp4") && (
                <video
                  src={post.video}
                  muted
                  loop
                  playsInline
                  style={styles.media}
                />
              )}

              <div style={styles.info}>
                <div>{post.name}</div>
                <small>{post.publishDate}</small>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    maxWidth: 700,
    margin: "0 auto",
    padding: 16,
    fontFamily: "sans-serif",
  },
  title: {
    textAlign: "center",
    marginBottom: 16,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 6,
  },
  card: {
    position: "relative",
    aspectRatio: "4 / 5",
    overflow: "hidden",
    background: "#eee",
  },
  media: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  info: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    padding: 6,
    fontSize: 12,
  },
};
