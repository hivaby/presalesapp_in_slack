/**
 * Event Router for Slack Events
 * 
 * Routes different Slack event types to appropriate handlers
 */

import { handleDirectMessage } from './handlers/direct-message.js';
import { handleAppMention } from './handlers/app-mention.js';
import { handleAssistantThread } from './handlers/assistant.js';

export async function handleEvent(body, env) {
    try {
        const { event, type } = body;

        // Ignore retry events to prevent duplicate processing
        if (body.event?.type === 'message' && body.event?.subtype === 'message_changed') {
            console.log('[Event Router] Ignoring message_changed event');
            return;
        }

        // Ignore bot messages
        if (event?.bot_id) {
            console.log('[Event Router] Ignoring bot message');
            return;
        }

        console.log(`[Event Router] Processing event type: ${event?.type || type}`);

        // Route to appropriate handler
        switch (event?.type) {
            case 'message':
                // Direct message (DM channel starts with 'D')
                if (event.channel?.startsWith('D')) {
                    await handleDirectMessage(event, env);
                }
                break;

            case 'app_mention':
                // @app mention in channel
                await handleAppMention(event, env);
                break;

            case 'assistant_thread_started':
                // Assistant panel opened
                await handleAssistantThread(event, env, 'started');
                break;

            case 'assistant_thread_context_changed':
                // Assistant context changed
                await handleAssistantThread(event, env, 'context_changed');
                break;

            default:
                console.log(`[Event Router] Unhandled event type: ${event?.type}`);
        }

    } catch (error) {
        console.error('[Event Router] Error processing event:', error);
        // Don't throw - we already responded to Slack with 200
    }
}
