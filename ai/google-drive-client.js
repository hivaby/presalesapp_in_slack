// Google Drive API Client for Cloudflare Workers
// Uses Web Crypto API for JWT signing (RS256)

/**
 * Google Drive API Client
 * Handles OAuth2 JWT authentication and file search
 */
export class GoogleDriveClient {
    constructor(serviceAccountJson, folderIds) {
        this.serviceAccount = typeof serviceAccountJson === 'string'
            ? JSON.parse(serviceAccountJson)
            : serviceAccountJson;
        this.folderIds = Array.isArray(folderIds) ? folderIds : folderIds.split(',');
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Generate JWT token for Google OAuth2
     */
    async generateJWT() {
        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const now = Math.floor(Date.now() / 1000);
        const payload = {
            iss: this.serviceAccount.client_email,
            scope: 'https://www.googleapis.com/auth/drive.readonly',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        const encodedHeader = this.base64urlEncode(JSON.stringify(header));
        const encodedPayload = this.base64urlEncode(JSON.stringify(payload));
        const unsignedToken = `${encodedHeader}.${encodedPayload}`;

        // Import private key
        const privateKey = await this.importPrivateKey(this.serviceAccount.private_key);

        // Sign the token
        const signature = await crypto.subtle.sign(
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            privateKey,
            new TextEncoder().encode(unsignedToken)
        );

        const encodedSignature = this.base64urlEncode(signature);
        return `${unsignedToken}.${encodedSignature}`;
    }

    /**
     * Import RSA private key from PEM format
     */
    async importPrivateKey(pemKey) {
        // Remove PEM header/footer and whitespace
        const pemContents = pemKey
            .replace('-----BEGIN PRIVATE KEY-----', '')
            .replace('-----END PRIVATE KEY-----', '')
            .replace(/\s/g, '');

        // Decode base64
        const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

        // Import key
        return await crypto.subtle.importKey(
            'pkcs8',
            binaryDer,
            { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
            false,
            ['sign']
        );
    }

    /**
     * Base64URL encode
     */
    base64urlEncode(data) {
        let base64;
        if (data instanceof ArrayBuffer) {
            base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
        } else {
            base64 = btoa(data);
        }
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * Get access token (with caching)
     */
    async getAccessToken() {
        // Return cached token if still valid
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        // Generate new JWT
        const jwt = await this.generateJWT();

        // Exchange JWT for access token
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to get access token: ${error}`);
        }

        const data = await response.json();
        this.accessToken = data.access_token;
        this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // 1 min buffer

        return this.accessToken;
    }

    /**
     * Search files in Google Drive
     */
    async searchFiles(query, limit = 10) {
        const accessToken = await this.getAccessToken();
        const results = [];

        // Search in each folder
        for (const folderId of this.folderIds) {
            try {
                const files = await this.searchInFolder(folderId, query, accessToken);
                results.push(...files);
            } catch (error) {
                console.error(`Error searching folder ${folderId}:`, error);
            }
        }

        // Sort by relevance and limit
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }

    /**
     * Search files in a specific folder (recursive)
     */
    async searchInFolder(folderId, query, accessToken) {
        const keywords = query.toLowerCase().split(' ').filter(k => k.length > 1);

        // Build search query for Google Drive API
        const q = `'${folderId}' in parents and trashed=false and (${keywords.map(kw => `name contains '${kw}'`).join(' or ')
            })`;

        const url = new URL('https://www.googleapis.com/drive/v3/files');
        url.searchParams.set('q', q);
        url.searchParams.set('fields', 'files(id,name,mimeType,modifiedTime,webViewLink,owners)');
        url.searchParams.set('pageSize', '20');
        url.searchParams.set('orderBy', 'modifiedTime desc');

        const response = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google Drive API error: ${error}`);
        }

        const data = await response.json();
        const files = data.files || [];

        // Convert to RAG format
        return files.map(file => ({
            title: file.name,
            url: file.webViewLink,
            snippet: `파일 타입: ${this.getMimeTypeLabel(file.mimeType)}`,
            score: this.calculateRelevanceScore(file.name, keywords),
            type: 'drive_document',
            lastModified: file.modifiedTime?.split('T')[0] || 'Unknown',
            author: file.owners?.[0]?.displayName || 'Unknown'
        }));
    }

    /**
     * Calculate relevance score based on keyword matches
     */
    calculateRelevanceScore(fileName, keywords) {
        const lowerName = fileName.toLowerCase();
        let score = 0;

        keywords.forEach(keyword => {
            if (lowerName.includes(keyword)) {
                score += 10;
                // Boost if keyword is at the start
                if (lowerName.startsWith(keyword)) {
                    score += 5;
                }
            }
        });

        return score;
    }

    /**
     * Get human-readable label for MIME type
     */
    getMimeTypeLabel(mimeType) {
        const labels = {
            'application/pdf': 'PDF',
            'application/vnd.google-apps.document': 'Google 문서',
            'application/vnd.google-apps.spreadsheet': 'Google 스프레드시트',
            'application/vnd.google-apps.presentation': 'Google 프레젠테이션',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word 문서',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel 스프레드시트',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint 프레젠테이션',
            'text/plain': '텍스트 파일'
        };

        return labels[mimeType] || '문서';
    }
}

/**
 * Create Google Drive client instance
 */
export function createGoogleDriveClient(serviceAccountJson, folderIds) {
    return new GoogleDriveClient(serviceAccountJson, folderIds);
}
