import { createClient } from "@supabase/supabase-js";

/**
 * Plan rules (as per your spec):
 * free: 1 database (no switcher)
 * advanced: max 2 databases
 * pro: unlimited (or very high)
 */
function getDbLimit(plan) {
  if (plan === "free") return 1;
  if (plan === "advanced") return 2; // FIX: you had 3; spec says 2
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

    // -------------------------
    // 1) Resolve widget by slug
    // -------------------------
    const { data: widget, error: widgetError } = await supabase
      .from("widgets")
      .select("id, customer_id, slug")
      .eq("slug", slug)
      .single();

    if (widgetError || !widget) {
      return res.status(404).json({ error: "Widget not found" });
    }

    // -------------------------
    // 2) Load customer + plan (via widget.customer_id)
    // -------------------------
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, plan, status")
      .eq("id", widget.customer_id)
      .single();

    if (customerError || !customer || customer.status !== "active") {
      return res.status(404).json({ error: "Customer not found" });
    }

    const plan = customer.plan || "free";
    const limit = getDbLimit(plan);

    // -------------------------
    // 3) Count existing databases for THIS WIDGET (Pro multi-widget safe)
    // -------------------------
    const { count, error: countError } = await supabase
      .from("notion_databases")
      .select("id", { count: "exact", head: true })
      .eq("widget_id", widget.id);

    if (countError) {
      return res.status(500).json({ error: countError.message });
    }

    const existingCount = count || 0;

    // -------------------------
    // 4) Enforce plan limit
    // -------------------------
    if (existingCount >= limit) {
      const msg =
        plan === "free"
          ? "Free plan allows only 1 database."
          : plan === "advanced"
          ? "Advanced plan allows up to 2 databases."
          : "Database limit reached.";
      return res.status(403).json({ error: msg, plan, limit });
    }

    // -------------------------
    // 5) Prevent duplicates per widget
    // -------------------------
    const { data: existing, error: existingError } = await supabase
      .from("notion_databases")
      .select("id")
      .eq("widget_id", widget.id)
      .eq("database_id", databaseId)
      .maybeSingle();

    if (existingError) {
      return res.status(500).json({ error: existingError.message });
    }
    if (existing) {
      return res.status(409).json({ error: "Database already added to this widget." });
    }

    // -------------------------
    // 6) Insert (first DB becomes primary)
    // IMPORTANT: requires notion_databases.widget_id column
    // -------------------------
    const isPrimary = existingCount === 0;

    const { data: inserted, error: insertError } = await supabase
      .from("notion_databases")
      .insert({
        widget_id: widget.id,
        customer_id: customer.id, // optional: keep for legacy queries/reporting
        database_id: databaseId,
        label,
        is_primary: isPrimary,
      })
      .select("id, label, database_id, is_primary, created_at")
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    const embed_url = `${process.env.PUBLIC_BASE_URL || ""}/grid.html?slug=${encodeURIComponent(widget.slug)}`;

    return res.status(200).json({
      ok: true,
      plan,
      limit,
      database: inserted,
      embed_url,
    });
  } catch (e) {
    console.error("add-database error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}