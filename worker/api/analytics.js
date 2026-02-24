/**
 * Analytics API Endpoint
 * 
 * Provides dashboard data from D1 database
 */

export async function handleAnalyticsRequest(request, env) {
    const url = new URL(request.url);
    const range = url.searchParams.get('range') || 'week';

    const timeFilter = getTimeFilter(range);

    try {
        // Get metrics and chart data from D1
        const metrics = await getMetrics(env.DB, timeFilter);
        const charts = await getChartData(env.DB, timeFilter);

        return new Response(JSON.stringify({
            metrics,
            charts
        }), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (error) {
        console.error('[Analytics API] Error:', error);
        return new Response(JSON.stringify({
            error: 'Failed to fetch analytics data'
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

async function getMetrics(db, timeFilter) {
    if (!db) {
        return {
            totalQueries: 0,
            avgResponseTime: 0,
            successRate: 0,
            activeUsers: 0
        };
    }

    const result = await db.prepare(`
    SELECT 
      COUNT(*) as totalQueries,
      AVG(response_time) as avgResponseTime,
      CAST(SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS REAL) * 100.0 / COUNT(*) as successRate,
      COUNT(DISTINCT user_hash) as activeUsers
    FROM query_logs
    WHERE timestamp >= ?
  `).bind(timeFilter).first();

    return result || {
        totalQueries: 0,
        avgResponseTime: 0,
        successRate: 0,
        activeUsers: 0
    };
}

async function getChartData(db, timeFilter) {
    if (!db) {
        return {
            queries: [],
            responseTime: [],
            keywords: [],
            success: { success: 0, error: 0 }
        };
    }

    // Queries over time
    const queriesOverTime = await db.prepare(`
    SELECT 
      DATE(timestamp / 1000, 'unixepoch') as date,
      COUNT(*) as count
    FROM query_logs
    WHERE timestamp >= ?
    GROUP BY date
    ORDER BY date
  `).bind(timeFilter).all();

    // Response time distribution
    const responseTimeDistribution = await db.prepare(`
    SELECT 
      CASE 
        WHEN response_time < 1000 THEN '< 1s'
        WHEN response_time < 3000 THEN '1-3s'
        WHEN response_time < 5000 THEN '3-5s'
        ELSE '> 5s'
      END as bucket,
      COUNT(*) as count
    FROM query_logs
    WHERE timestamp >= ?
    GROUP BY bucket
    ORDER BY 
      CASE bucket
        WHEN '< 1s' THEN 1
        WHEN '1-3s' THEN 2
        WHEN '3-5s' THEN 3
        ELSE 4
      END
  `).bind(timeFilter).all();

    // Top keywords
    const topKeywords = await db.prepare(`
    SELECT keyword, count
    FROM popular_keywords
    ORDER BY count DESC
    LIMIT 10
  `).all();

    // Success vs Error
    const successVsError = await db.prepare(`
    SELECT 
      SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success,
      SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as error
    FROM query_logs
    WHERE timestamp >= ?
  `).bind(timeFilter).first();

    return {
        queries: queriesOverTime.results || [],
        responseTime: responseTimeDistribution.results || [],
        keywords: topKeywords.results || [],
        success: successVsError || { success: 0, error: 0 }
    };
}
