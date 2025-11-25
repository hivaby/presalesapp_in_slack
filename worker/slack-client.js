/**
 * Slack Web API Client for Cloudflare Workers
 * 
 * Lightweight Slack API client using fetch API
 */

export class SlackClient {
    constructor(token) {
        this.token = token;
        this.baseUrl = 'https://slack.com/api';
    }

    async request(method, data = {}) {
        const url = `${this.baseUrl}/${method}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!result.ok) {
            console.error(`[Slack API] ${method} failed:`, result.error);
            throw new Error(`Slack API error: ${result.error}`);
        }

        return result;
    }

    // Chat methods
    async postMessage(channel, text, options = {}) {
        return this.request('chat.postMessage', {
            channel,
            text,
            ...options
        });
    }

    async updateMessage(channel, ts, text, options = {}) {
        return this.request('chat.update', {
            channel,
            ts,
            text,
            ...options
        });
    }

    async deleteMessage(channel, ts) {
        return this.request('chat.delete', {
            channel,
            ts
        });
    }

    // Conversations methods
    async getHistory(channel, limit = 10) {
        return this.request('conversations.history', {
            channel,
            limit
        });
    }

    async getChannels(limit = 100) {
        return this.request('conversations.list', {
            types: 'public_channel',
            limit,
            exclude_archived: true
        });
    }

    // Users methods
    async getUserInfo(user) {
        return this.request('users.info', {
            user
        });
    }

    // Assistant methods (for Assistant API)
    async setThreadStatus(channelId, threadTs, status) {
        return this.request('assistant.threads.setStatus', {
            channel_id: channelId,
            thread_ts: threadTs,
            status
        });
    }

    async setSuggestedPrompts(channelId, threadTs, title, prompts) {
        return this.request('assistant.threads.setSuggestedPrompts', {
            channel_id: channelId,
            thread_ts: threadTs,
            title,
            prompts
        });
    }
}

export function createSlackClient(token) {
    return new SlackClient(token);
}
