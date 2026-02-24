/**
 * Analytics logging system for Presalesapp
 * 
 * Collects and stores query metrics for dashboard visualization
 */

export class Analytics {
    constructor(env) {
        this.env = env;
    }

    /**
     * Log a query event
     * @param {Object} data - Query data
     * @param {string} data.userId - Slack user ID
     * @param {string} data.userName - User display name
     * @param {string} data.question - User question
     * @param {string} data.answer - AI answer
     * @param {number} data.responseTime - Response time in ms
     * @param {Array} data.ragSources - RAG sources used
     * @param {boolean} data.success - Whether query succeeded
     * @param {string} data.errorType - Error type if failed
     */
    async logQuery(data) {
        const {
            userId,
            userName = 'Anonymous',
            question,
            answer = '',
            responseTime,
            ragSources = [],
            success = true,
            errorType = null
        } = data;

        try {
            // Anonymize user ID
            const userHash = await this.hashUserId(userId);

            // Extract keywords from question
            const keywords = this.extractKeywords(question);

            // Categorize question by product
            const category = this.categorizeQuestion(question);

            // Log to D1 database (v2 table)
            if (this.env.DB) {
                await this.env.DB.prepare(`
          INSERT INTO query_logs_v2
          (user_hash, user_name, question_text, answer_text, keywords, category, 
           response_time, sources_count, success, error_type, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
                    userHash,
                    userName,
                    question,
                    answer,
                    keywords,
                    category,
                    responseTime,
                    ragSources.length,
                    success ? 1 : 0,
                    errorType,
                    Date.now()
                ).run();

                // Update popular keywords
                await this.updatePopularKeywords(keywords);
            }

            // Log to Analytics Engine
            if (this.env.ANALYTICS) {
                await this.env.ANALYTICS.writeDataPoint({
                    blobs: [userHash, keywords],
                    doubles: [responseTime, ragSources.length],
                    indexes: [success ? 'success' : 'error']
                });
            }
        } catch (error) {
            console.error('[Analytics] Failed to log query:', error);
            // Don't throw - analytics failure shouldn't break the main flow
        }
    }

    /**
   * Hash user ID for anonymization using Web Crypto API
   */
    async hashUserId(userId) {
        const encoder = new TextEncoder();
        const data = encoder.encode(userId);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex.substring(0, 16);
    }

    /**
     * Categorize question by product/topic
     */
    categorizeQuestion(question) {
        const text = question.toLowerCase();

        if (text.includes('drm') || text.includes('디알엠') || text.includes('권리')) return 'DRM';
        if (text.includes('dlp') || text.includes('디엘피') || text.includes('유출')) return 'DLP';
        if (text.includes('printsafer') || text.includes('프린트') || text.includes('인쇄')) return 'PrintSafer';
        if (text.includes('screensafer') || text.includes('화면') || text.includes('캡처')) return 'ScreenSafer';
        if (text.includes('ai sentinel') || text.includes('센티넬') || text.includes('에이아이')) return 'AI Sentinel';

        return 'General';
    }

    /**
     * Extract keywords from question
     */
    extractKeywords(question) {
        // Remove special characters and convert to lowercase
        const cleaned = question
            .toLowerCase()
            .replace(/[^\w\s가-힣]/g, ' ')
            .trim();

        // Split into words and filter
        const words = cleaned
            .split(/\s+/)
            .filter(word => word.length > 1)
            .slice(0, 5); // Keep top 5 words

        return words.join(' ');
    }

    /**
     * Update popular keywords table
     */
    async updatePopularKeywords(keywords) {
        if (!this.env.DB || !keywords) return;

        const words = keywords.split(' ');

        for (const word of words) {
            if (word.length < 2) continue;

            try {
                await this.env.DB.prepare(`
          INSERT INTO popular_keywords (keyword, count, last_used)
          VALUES (?, 1, ?)
          ON CONFLICT(keyword) DO UPDATE SET
            count = count + 1,
            last_used = ?
        `).bind(word, Date.now(), Date.now()).run();
            } catch (error) {
                console.error(`[Analytics] Failed to update keyword ${word}:`, error);
            }
        }
    }

    /**
     * Get daily statistics
     */
    async getDailyStats(date = new Date().toISOString().split('T')[0]) {
        if (!this.env.DB) return null;

        try {
            const stats = await this.env.DB.prepare(`
        SELECT 
          COUNT(*) as total_queries,
          SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_queries,
          AVG(response_time) as avg_response_time,
          COUNT(DISTINCT user_hash) as unique_users
        FROM query_logs
        WHERE DATE(timestamp / 1000, 'unixepoch') = ?
      `).bind(date).first();

            return stats;
        } catch (error) {
            console.error('[Analytics] Failed to get daily stats:', error);
            return null;
        }
    }
}

/**
 * Create Analytics instance
 */
export function createAnalytics(env) {
    return new Analytics(env);
}
