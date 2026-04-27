module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(500).json({
      error: "Missing Supabase configuration",
      details: "SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required"
    });
  }

  res.status(200).json({
    supabaseUrl,
    supabaseAnonKey
  });
};
