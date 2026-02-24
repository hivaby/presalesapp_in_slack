/**
 * App Mention Handler for Cloudflare Workers
 * 
 * Handles @app mentions in channels
 */

import { createSlackClient } from '../slack-client.js';
import { runMultiHopAI, formatResponse, detectProduct } from '../../ai/index.js';
import { setWorkersAI } from '../../ai/index.js';
import { createAnalytics } from '../analytics.js';

export async function handleAppMention(event, env) {
    const { channel, text, user, ts } = event;
    const threadTs = event.thread_ts || ts;

    // Inject Workers AI binding
    if (env.AI) setWorkersAI(env.AI);

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

        if (!cleanText || cleanText.length > 10000) {
            return;
        }

        const analytics = createAnalytics(env);
        const startTime = Date.now();

        try {
            // Create RAG instance with Google Drive + Atlassian credentials
            const { MarkAnyRAG } = await import('../../ai/rag.js');
            const rag = new MarkAnyRAG(
                env.GOOGLE_SERVICE_ACCOUNT_JSON || null,
                env.GOOGLE_DRIVE_FOLDER_IDS || null,
                {
                    domain: env.ATLASSIAN_DOMAIN || null,
                    email: env.ATLASSIAN_EMAIL || null,
                    apiToken: env.ATLASSIAN_API_TOKEN || null
                }
            );

            // RAG 검색 함수 래퍼 (multi-hop에서 hop별로 호출됨)
            const ragSearchFn = (query) => rag.search(query, slackClient);

            // 채널 대화 히스토리 가져오기
            let conversationHistory = '';
            try {
                const history = await slackClient.getHistory(channel, 6);
                if (history.messages) {
                    conversationHistory = history.messages
                        .reverse()
                        .filter(m => m.text && m.text !== text)
                        .slice(0, 4)
                        .map(m => {
                            const role = m.bot_id ? 'MarkAny Assistant' : 'User';
                            return `${role}: ${m.text.substring(0, 150)}`;
                        })
                        .join('\n');
                }
            } catch (error) {
                console.warn('[Mention Handler] Could not fetch channel history:', error.message);
            }

            // Multi-Hop AI 호출 (복합 질문 자동 감지 및 분해)
            const result = await runMultiHopAI(cleanText, ragSearchFn, conversationHistory, env.GEMINI_API_KEY);

            // Format response with sources
            let formattedResponse = formatResponse(result.answer, result.sources);

            if (result.isMultiHop && result.hops?.length > 0) {
                formattedResponse += `\n\n🔗 *${result.hops.length}단계 분석을 통해 답변을 생성했습니다.*`;
            }

            // Mention the user who asked
            formattedResponse = `<@${user}> ${formattedResponse}`;

            // Post response in thread
            await slackClient.postMessage(channel, formattedResponse, {
                thread_ts: threadTs
            });

            // Log successful query
            const responseTime = Date.now() - startTime;
            await analytics.logQuery({
                userId: user,
                userName: 'User',
                question: cleanText,
                answer: result.answer,
                responseTime,
                ragSources: result.sources,
                success: true
            });

            console.log(`[Mention Handler] Responded in channel ${channel}, sources: ${result.sources?.length || 0}`);

        } catch (aiError) {
            console.error('[Mention Handler] AI processing error:', aiError);

            const responseTime = Date.now() - startTime;
            await analytics.logQuery({
                userId: user,
                question: cleanText,
                responseTime,
                ragSources: [],
                success: false,
                errorType: aiError.message
            });

            await slackClient.postMessage(
                channel,
                `⚠️ <@${user}> 죄송합니다. 일시적인 오류가 발생했습니다.\n\n잠시 후 다시 시도해주세요.`,
                { thread_ts: threadTs }
            );
        }

    } catch (error) {
        console.error('[Mention Handler] Handler error:', error);

        await slackClient.postMessage(
            channel,
            `⚠️ <@${user}> MarkAny AI Assistant에 일시적인 문제가 발생했습니다.\n\n잠시 후 다시 시도해주세요.`,
            { thread_ts: threadTs }
        );
    }
}
