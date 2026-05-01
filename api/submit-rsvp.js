const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { id, guest_name, guest_count, status } = req.body;

    if (!id || !guest_name || status === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // ── FIX: Validate guest_count is a sane positive integer ──
    const parsedCount = parseInt(guest_count) || 1;
    if (parsedCount < 1 || parsedCount > 50) {
        return res.status(400).json({ error: 'guest_count must be between 1 and 50' });
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    const sb = createClient(supabaseUrl, supabaseServiceKey);

    try {
        // 1. Fetch current rsvps
        const { data, error: fetchError } = await sb
            .from('customer_invitations')
            .select('rsvps')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        const rsvps = data.rsvps || [];
        rsvps.push({
            guest_name,
            guest_count: parsedCount,
            status,
            submitted_at: new Date().toISOString()
        });

        // 2. Update with new rsvps array
        const { error: updateError } = await sb
            .from('customer_invitations')
            .update({ rsvps })
            .eq('id', id);

        if (updateError) throw updateError;

        return res.status(200).json({ success: true, message: 'RSVP submitted successfully' });
    } catch (error) {
        console.error('RSVP API Error:', error);
        return res.status(500).json({ error: error.message || 'Internal Server Error' });
    }
};
