import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { token } = req.query;

  if (!token) {
    return res.json({ valid: false });
  }

  const { data, error } = await supabase
    .from("customers")
    .select("id, setup_used")
    .eq("setup_token", token)
    .single();

  if (error || !data || data.setup_used) {
    return res.json({ valid: false });
  }

  res.json({ valid: true });
}