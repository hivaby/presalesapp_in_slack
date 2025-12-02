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
            // CQL (Confluence Query Language) search
            // Search in title and text body
            const cql = `siteSearch ~ "${query}" AND type = "page"`;
            const params = new URLSearchParams({
                cql: cql,
                limit: limit,
                expand: 'body.storage,version' // Get content body
            });

            const response = await fetch(`${this.baseUrl}/wiki/rest/api/content/search?${params}`, {
                method: 'GET',
                headers: {
                    'Authorization': this.authHeader,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`Confluence search failed: ${response.status}`);
                return [];
            }

            const data = await response.json();

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
            console.error('Confluence search error:', error);
            return [];
        }
    }

    /**
     * Search Jira issues
     */
    async searchJira(query, limit = 5) {
        try {
            // JQL (Jira Query Language) search
            // Search in summary and description
            const jql = `text ~ "${query}" ORDER BY created DESC`;

            const response = await fetch(`${this.baseUrl}/rest/api/3/search`, {
                method: 'POST',
                headers: {
                    'Authorization': this.authHeader,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    jql: jql,
                    maxResults: limit,
                    fields: ['summary', 'description', 'created', 'updated', 'assignee', 'status']
                })
            });

            if (!response.ok) {
                console.error(`Jira search failed: ${response.status}`);
                return [];
            }

            const data = await response.json();

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
            console.error('Jira search error:', error);
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
