import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { slug, databaseId, newLabel } = req.body || {};

    if (!slug || !databaseId || !newLabel) {
      return res.status(400).json({ error: "Missing slug, databaseId, or newLabel" });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find customer
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("slug", slug)
      .single();

    if (customerError || !customer) {
      return res.status(404).json({ error: "Customer not found" });
    }

    // Update label (scoped to customer)
    const { data: updated, error: updateError } = await supabase
      .from("notion_databases")
      .update({ label: newLabel })
      .eq("id", databaseId)
      .eq("customer_id", customer.id)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: updateError.message });
    }

    return res.json({ ok: true, database: updated });
  } catch (e) {
    console.error("update-database-label error:", e);
    return res.status(500).json({ error: "Server error" });
  }
}