import { useRouter } from "next/router";

export default function Setup() {
  const router = useRouter();

  function connect() {
    const slug = "customer123"; // generate or pass dynamically
    window.location.href = `/api/auth?slug=${slug}`;
  }

  return (
    <div style={{ padding: 40 }}>
      <h2>Connect your Notion</h2>
      <button onClick={connect}>Connect Notion</button>
    </div>
  );
}
