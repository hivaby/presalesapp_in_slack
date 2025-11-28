/**
 * App Mention Handler for Cloudflare Workers
 * 
 * Handles @app mentions in channels
 */

import { createSlackClient } from '../slack-client.js';
import { runAI, formatResponse, detectProduct } from '../../ai/index.js';

export async function handleAppMention(event, env) {
    const { channel, text, user, ts } = event;
    const threadTs = event.thread_ts || ts;

    console.log(`[Mention Handler] User ${user} mentioned in channel ${channel}`);

    const slackClient = createSlackClient(env.SLACK_BOT_TOKEN);

    try {
        // Set assistant status (if using Assistant API)
        try {
            await slackClient.setThreadStatus(
                channel,
                threadTs,
                'MarkAny 지식베이스 검색 중...'
            );
        } catch (e) {
            // Ignore if not using Assistant API
            console.log('[Mention Handler] Assistant API not available, continuing...');
        }

        // Remove bot mention from text
        const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();

        // Detect product
        const detectedProduct = detectProduct(cleanText);

        // Create RAG instance with Google Drive credentials
        const { MarkAnyRAG } = await import('../../ai/rag.js');
        const rag = new MarkAnyRAG(
            env.GOOGLE_SERVICE_ACCOUNT_JSON,
            env.GOOGLE_DRIVE_FOLDER_IDS
        );

        // Perform RAG search
        const ragResults = await rag.search(cleanText, slackClient);

        // Get channel context (recent messages)
        let channelContext = '';
        try {
            const history = await slackClient.getHistory(channel, 5);

            if (history.messages) {
                channelContext = history.messages
                    .filter(m => m.text && !m.bot_id)
                    .map(m => `<@${m.user}>: ${m.text.substring(0, 100)}`)
                    .join('\n');
            }
        } catch (error) {
            console.warn('[Mention Handler] Could not fetch channel context:', error);
        }

        // Generate AI response
        const aiResponse = await runAI(
            cleanText,
            ragResults.context,
            channelContext,
            env.GEMINI_API_KEY
        );

        // Format response with sources
        const sources = [...ragResults.documents, ...ragResults.slackMessages];
        let formattedResponse = formatResponse(aiResponse, sources);

        // Add product-specific information
        if (detectedProduct) {
            formattedResponse += `\n\n🎯 **${detectedProduct} 전문 지원**\n`;
            formattedResponse += `• 기술 문서: [${detectedProduct} 가이드](https://drive.google.com/markany-${detectedProduct.toLowerCase().replace(' ', '-')})\n`;
        }

        // Mention the user who asked
        formattedResponse = `<@${user}> ${formattedResponse}`;

        // Post response in thread
        await slackClient.postMessage(channel, formattedResponse, {
            thread_ts: threadTs
        });

        console.log(`[Mention Handler] Responded in channel ${channel}, product: ${detectedProduct || 'General'}, sources: ${sources.length}`);

    } catch (error) {
        console.error('[Mention Handler] Error:', error);

        // Send error message
        await slackClient.postMessage(
            channel,
            `⚠️ <@${user}> MarkAny AI Assistant에 일시적인 문제가 발생했습니다.\n\n잠시 후 다시 시도해주세요.`,
            { thread_ts: threadTs }
        );
    }
}
