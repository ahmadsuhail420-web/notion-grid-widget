import { createClient } from "@supabase/supabase-js";

function getPlanLimit(plan) {
  if (plan === "free") return 1;
  if (plan === "advanced") return 3;
  return Infinity; // pro
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { slug, databaseId, label } = req.body;

    if (!slug || !databaseId) {
      return res.status(400).json({ error: "Missing slug or databaseId" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1️⃣ Find customer by slug
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, plan")
      .eq("slug", slug)
      .single();

    if (customerError || !customer) {
      return res.status(400).json({ error: "Customer not found" });
    }

    // 2️⃣ Find notion connection
    const { data: conn, error: connError } = await supabase
      .from("notion_connections")
      .select("id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (connError || !conn) {
      return res.status(400).json({ error: "Notion connection not found" });
    }

    // 3️⃣ Load existing databases
    const { data: existingDbs, error: existingErr } = await supabase
      .from("notion_databases")
      .select("id, database_id")
      .eq("connection_id", conn.id);

    if (existingErr) {
      return res.status(500).json({ error: existingErr.message });
    }

    const plan = customer.plan || "free";
    const limit = getPlanLimit(plan);

    if ((existingDbs?.length || 0) >= limit) {
      return res.status(403).json({
        error:
          plan === "free"
            ? "Free plan allows only 1 database."
            : plan === "advanced"
            ? "Advanced plan allows up to 3 databases."
            : "Database limit reached.",
      });
    }

    // Prevent duplicates
    const already = (existingDbs || []).some(
      (d) => d.database_id === databaseId
    );

    if (already) {
      return res.status(409).json({
        error: "This database is already connected.",
      });
    }

    // First DB becomes primary
    const shouldBePrimary = !existingDbs || existingDbs.length === 0;

    const { data: inserted, error: insertError } = await supabase
      .from("notion_databases")
      .insert({
        customer_id: customer.id,
        connection_id: conn.id,
        database_id: databaseId,
        label: label?.trim() || "Database",
        is_primary: shouldBePrimary,
      })
      .select("id, database_id, label, is_primary")
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    const embed_url = `${process.env.APP_URL}/grid.html?slug=${slug}`;

    return res.json({
      ok: true,
      plan,
      embed_url,
      database: inserted,
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}