/**
 * Atlassian API Client for Cloudflare Workers
 * Handles Jira and Confluence search and content retrieval
 */
export class AtlassianClient {
    constructor(domain, email, apiToken) {
        this.domain = domain;
        this.email = email;
        this.apiToken = apiToken;
        this.baseUrl = `https://${domain}`;
        this.authHeader = `Basic ${btoa(`${email}:${apiToken}`)}`;
    }

    /**
     * Search Confluence pages
     */
    async searchConfluence(query, limit = 5) {
        try {
            console.log(`[Atlassian] Searching Confluence for: "${query}"`);

            // CQL (Confluence Query Language) search
            // Search in title and text body
            const cql = `siteSearch ~ "${query}" AND type = "page"`;
            const params = new URLSearchParams({
                cql: cql,
                limit: limit,
                expand: 'body.storage,version' // Get content body
            });

            const url = `${this.baseUrl}/wiki/rest/api/content/search?${params}`;
            console.log(`[Atlassian] Confluence URL: ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Atlassian] ❌ Confluence search failed: ${response.status}`);
                console.error(`[Atlassian] Error response:`, errorText);
                return [];
            }

            const data = await response.json();
            console.log(`[Atlassian] ✅ Confluence returned ${data.results?.length || 0} results`);

            return data.results.map(page => ({
                id: page.id,
                title: page.title,
                url: `${this.baseUrl}/wiki${page._links.webui}`,
                // Extract text from storage format (simple regex cleanup)
                content: this.cleanConfluenceContent(page.body?.storage?.value || ''),
                snippet: '', // Will be filled from content
                type: 'confluence',
                lastModified: page.version?.when?.split('T')[0] || 'Unknown',
                author: 'Unknown' // Confluence API structure varies for author
            }));

        } catch (error) {
            console.error('[Atlassian] ❌ Confluence search error:', error.message);
            console.error('[Atlassian] Error stack:', error.stack);
            return [];
        }
    }

    /**
     * Search Jira issues
     */
    async searchJira(query, limit = 5) {
        try {
            console.log(`[Atlassian] Searching Jira for: "${query}"`);

            // JQL (Jira Query Language) search
            // Search in summary and description
            const jql = `text ~ "${query}" ORDER BY created DESC`;

            const url = `${this.baseUrl}/rest/api/3/search/jql`;
            console.log(`[Atlassian] Jira URL: ${url}`);

            // New API uses GET with query params
            const params = new URLSearchParams({
                jql: jql,
                maxResults: limit,
                fields: 'summary,description,created,updated,assignee,status'
            });

            const response = await fetch(`${url}?${params}`, {
                method: 'GET',
                headers: {
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[Atlassian] ❌ Jira search failed: ${response.status}`);
                console.error(`[Atlassian] Error response:`, errorText);
                return [];
            }

            const data = await response.json();
            console.log(`[Atlassian] ✅ Jira returned ${data.issues?.length || 0} issues`);

            return data.issues.map(issue => ({
                id: issue.id,
                key: issue.key,
                title: `[${issue.key}] ${issue.fields.summary}`,
                url: `${this.baseUrl}/browse/${issue.key}`,
                content: this.cleanJiraContent(issue.fields.description),
                snippet: '',
                type: 'jira',
                status: issue.fields.status?.name,
                lastModified: issue.fields.updated?.split('T')[0] || 'Unknown',
                author: issue.fields.assignee?.displayName || 'Unassigned'
            }));

        } catch (error) {
            console.error('[Atlassian] ❌ Jira search error:', error.message);
            console.error('[Atlassian] Error stack:', error.stack);
            return [];
        }
    }

    /**
     * Clean Confluence storage format (HTML-like) to plain text
     */
    cleanConfluenceContent(html) {
        if (!html) return '';
        // Remove tags
        let text = html.replace(/<[^>]*>/g, ' ');
        // Decode entities
        text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        // Normalize whitespace
        return text.replace(/\s+/g, ' ').trim().substring(0, 5000); // Limit length
    }

    /**
     * Clean Jira description (ADF or text) to plain text
     */
    cleanJiraContent(description) {
        if (!description) return '';

        // If it's a string, just return it
        if (typeof description === 'string') return description;

        // If it's ADF (Atlassian Document Format) object, we need to extract text
        // This is a simplified extraction
        if (typeof description === 'object' && description.content) {
            return this.extractTextFromADF(description).substring(0, 5000);
        }

        return '';
    }

    extractTextFromADF(node) {
        if (node.type === 'text') return node.text;
        if (node.content) {
            return node.content.map(child => this.extractTextFromADF(child)).join(' ');
        }
        return '';
    }
}

export function createAtlassianClient(domain, email, apiToken) {
    return new AtlassianClient(domain, email, apiToken);
}
