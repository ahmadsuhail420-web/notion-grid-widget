import { createClient } from "@supabase/supabase-js";

function getDbLimit(plan) {
  if (plan === "free") return 1;
  if (plan === "advanced") return 3;
  return Infinity; // pro
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { slug, databaseId, label } = req.body || {};
    if (!slug || !databaseId || !label) {
      return res.status(400).json({ error: "Missing slug, databaseId, or label" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1) Load customer + plan
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, plan")
      .eq("slug", slug)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    const plan = customer.plan || "free";
    const limit = getDbLimit(plan);

    // 2) Count existing databases for this customer
    const { count, error: countError } = await supabase
      .from("notion_databases")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customer.id);

    if (countError) {
      return res.status(500).json({ error: countError.message });
    }

    const existingCount = count || 0;

    // 3) Enforce plan limit
    if (existingCount >= limit) {
      const msg =
        plan === "free"
          ? "Free plan allows only 1 database."
          : plan === "advanced"
          ? "Advanced plan allows up to 3 databases."
          : "Database limit reached.";
      return res.status(403).json({ error: msg, plan, limit });
    }

    // 4) Insert
    // NOTE: assumes table is notion_databases with columns:
    // customer_id, database_id, label, is_primary
    // If first DB, set primary.
    const isPrimary = existingCount === 0;

    const { data: inserted, error: insertError } = await supabase
      .from("notion_databases")
      .insert({
        customer_id: customer.id,
        database_id: databaseId,
        label,
        is_primary: isPrimary,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    // Your frontend expects embed_url sometimes; keep it compatible if you already generate it elsewhere.
    // If your existing endpoint already returns embed_url, you can compute it here too:
    const embed_url = `${process.env.PUBLIC_BASE_URL || ""}/grid.html?slug=${encodeURIComponent(slug)}`;

    return res.status(200).json({
      ok: true,
      plan,
      database: inserted,
      embed_url,
    });
  } catch (e) {
    console.error("add-database error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}