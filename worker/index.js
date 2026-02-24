/**
 * Cloudflare Workers Entry Point for MarkAny Slack AI Assistant
 * 
 * Handles Slack Events API requests with signature verification
 */

import { verifySlackRequest } from './slack-verify.js';
import { handleEvent } from './event-router.js';
import { handleAnalyticsRequest } from './api/analytics.js';
import { handleLogsRequest } from './api/logs.js';
import { handleDashboardRequest } from './dashboard-handler.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // Analytics API
        if (url.pathname === '/api/analytics') {
            return handleAnalyticsRequest(request, env);
        }

        // Logs API
        if (url.pathname === '/api/logs') {
            return handleLogsRequest(request, env);
        }


        // Logs API
        if (url.pathname === '/api/logs') {
            return handleLogsRequest(request, env);
        }

        // Dashboard
        if (url.pathname.startsWith('/dashboard')) {
            return handleDashboardRequest(request);
        }

        // Only accept POST requests for Slack events
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }

        // Get request body
        const rawBody = await request.text();
        let body;

        try {
            body = JSON.parse(rawBody);
        } catch (error) {
            return new Response('Invalid JSON', { status: 400 });
        }

        // URL Verification (Slack initial setup)
        if (body.type === 'url_verification') {
            console.log('[MarkAny Worker] URL verification challenge received');
            return new Response(JSON.stringify({ challenge: body.challenge }), {
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Verify Slack request signature
        const isValid = await verifySlackRequest(request, rawBody, env.SLACK_SIGNING_SECRET);
        if (!isValid) {
            console.error('[MarkAny Worker] Invalid Slack signature');
            return new Response('Invalid signature', { status: 401 });
        }

        // Handle event asynchronously (Slack requires 3-second response)
        // Use waitUntil to process event after responding to Slack
        ctx.waitUntil(handleEvent(body, env));

        // Immediately respond to Slack with 200 OK
        return new Response('OK', {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
};
