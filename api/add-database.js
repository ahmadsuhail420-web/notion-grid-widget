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

    if (!token || !databaseId) {
      return res.status(400).json({ error: "Missing token or databaseId" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // 1) Find customer by setup token (include plan for limits)
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, slug, plan")
      .eq("slug", slug)
      .single();

    if (customerError || !customer) {
      return res.status(400).json({ error: "Invalid setup token" });
    }

    // 2) Find notion connection
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

    // 3) Load existing databases for this connection
    const { data: existingDbs, error: existingErr } = await supabase
      .from("notion_databases")
      .select("id, database_id, is_primary")
      .eq("connection_id", conn.id)
      .order("created_at", { ascending: true });

    if (existingErr) {
      return res.status(500).json({ error: existingErr.message });
    }

    const plan = customer.plan || "free";
    const limit = getPlanLimit(plan);

    // ✅ Plan limit enforcement
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

    // ✅ Duplicate prevention (same Notion database already added)
    const already = (existingDbs || []).some((d) => d.database_id === databaseId);
    if (already) {
      return res.status(409).json({ error: "This database is already connected." });
    }

    // 4) Decide primary (if first DB, make primary)
    const shouldBePrimary = !existingDbs || existingDbs.length === 0;

    // 5) If it will be primary, first unset all primaries (guarantee single primary)
    if (shouldBePrimary) {
      const { error: unsetErr } = await supabase
        .from("notion_databases")
        .update({ is_primary: false })
        .eq("connection_id", conn.id);

      if (unsetErr) {
        return res.status(500).json({ error: unsetErr.message });
      }
    }

    // 6) Insert DB row
    const cleanLabel = (label || "").trim() || "Database";

    const { data: inserted, error: insertError } = await supabase
      .from("notion_databases")
      .insert({
        customer_id: customer.id,
        connection_id: conn.id,
        database_id: databaseId,
        label: cleanLabel,
        is_primary: shouldBePrimary,
      })
      .select("id, database_id, label, is_primary")
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    // 7) Embed URL stays the same (widget uses slug)
    const embed_url = `${process.env.APP_URL}/grid.html?slug=${encodeURIComponent(
      customer.slug
    )}`;

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