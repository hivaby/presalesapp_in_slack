/**
 * Detailed Logs API Endpoint
 * 
 * Provides paginated query logs with filtering
 */

export async function handleLogsRequest(request, env) {
    const url = new URL(request.url);
    const range = url.searchParams.get('range') || 'week';
    const category = url.searchParams.get('category') || 'all';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    const timeFilter = getTimeFilter(range);
    const offset = (page - 1) * limit;

    try {
        // Build query with filters
        let query = `
      SELECT 
        id,
        user_name,
        question_text,
        answer_text,
        category,
        response_time,
        sources_count,
        success,
        timestamp,
        created_at
      FROM query_logs_v2
      WHERE timestamp >= ?
    `;

        const params = [timeFilter];

        if (category !== 'all') {
            query += ' AND category = ?';
            params.push(category);
        }

        query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const logs = await env.DB.prepare(query).bind(...params).all();

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM query_logs_v2 WHERE timestamp >= ?';
        const countParams = [timeFilter];

        if (category !== 'all') {
            countQuery += ' AND category = ?';
            countParams.push(category);
        }

        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
        const total = countResult?.total || 0;

        return new Response(JSON.stringify({
            logs: logs.results || [],
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            }
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('[Logs API] Error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to fetch logs',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

function getTimeFilter(range) {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    switch (range) {
        case 'today':
            return now - day;
        case 'week':
            return now - (7 * day);
        case 'month':
            return now - (30 * day);
        default:
            return now - (7 * day);
    }
}
