const slug = generateSlug(); // e.g. alex-grid

saveToDB({
  slug,
  notion_token,
  database_id,
  email
});

redirect user to:
https://yourdomain.com/success?slug=alex-grid