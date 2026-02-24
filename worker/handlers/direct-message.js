/**
 * Direct Message Handler for Cloudflare Workers
 * 
 * Handles DM messages sent to the MarkAny AI Assistant
 */

import { createSlackClient } from '../slack-client.js';
import { runMultiHopAI, formatResponse, detectProduct } from '../../ai/index.js';
import { setWorkersAI } from '../../ai/index.js';
import { createAnalytics } from '../analytics.js';

export async function handleDirectMessage(event, env) {
    const { channel, text, user } = event;

    // Inject Workers AI binding
    if (env.AI) setWorkersAI(env.AI);

    // Ignore empty messages or too long
    if (!text || text.trim() === '' || text.length > 10000) {
        return;
    }

    console.log(`[DM Handler] User ${user} asked: "${text}"`);

    const slackClient = createSlackClient(env.SLACK_BOT_TOKEN);

    try {
        // Handle feedback messages
        if (text.startsWith('피드백:') || text.startsWith('피드백 :') || text.toLowerCase().startsWith('feedback:')) {
            const feedbackText = text.replace(/^(피드백\s*:|feedback\s*:)\s*/i, '').trim();
            if (feedbackText.length > 0) {
                // Save feedback to D1
                try {
                    const analytics = createAnalytics(env);
                    if (env.DB) {
                        await env.DB.prepare(
                            `INSERT INTO user_feedback (user_id, feedback_text, timestamp) VALUES (?, ?, ?)`
                        ).bind(user, feedbackText, Date.now()).run().catch(() => {
                            // Table might not exist yet, create it
                            return env.DB.prepare(
                                `CREATE TABLE IF NOT EXISTS user_feedback (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, feedback_text TEXT, timestamp INTEGER)`
                            ).run().then(() =>
                                env.DB.prepare(
                                    `INSERT INTO user_feedback (user_id, feedback_text, timestamp) VALUES (?, ?, ?)`
                                ).bind(user, feedbackText, Date.now()).run()
                            );
                        });
                    }
                } catch (dbErr) {
                    console.error('[DM Handler] Feedback DB error:', dbErr.message);
                }
                await slackClient.postMessage(channel, '✅ 소중한 피드백 감사합니다! 서비스 개선에 반영하겠습니다. 🙏');
            } else {
                await slackClient.postMessage(channel, '📮 피드백 내용을 함께 적어주세요.\n예시: `피드백: DLP 메신저 제어 관련 답변이 부정확합니다`');
            }
            return;
        }

        // Handle help command
        if (text.toLowerCase().includes('help') || text === '도움말') {
            const helpMessage = `🤖 **MarkAny AI Assistant에 오신 것을 환영합니다!**

저는 MarkAny 제품과 기술에 대한 질문을 도와드리는 AI Assistant입니다.

🔒 **지원 제품:**
• DRM - 디지털 권리 관리
• DLP - 데이터 유출 방지  
• PrintSafer - 인쇄 보안
• ScreenSafer - 화면 캡처 방지
• AI Sentinel - AI 보안

💡 **질문 예시:**
• "DRM 라이선스 설정 방법은?"
• "PrintSafer 워터마크 적용하는 법"
• "DLP 정책 설정 가이드"
• "DRM이 지원하는 CAD 종류는?"

🛡️ **보안 정책:**
개인정보나 기밀정보는 처리하지 않으며, 모든 답변에는 출처를 제공합니다.

궁금한 것이 있으시면 언제든 질문해 주세요! 😊`;

            await slackClient.postMessage(channel, helpMessage);
            return;
        }

        // Send "thinking" message
        const thinkingMsg = await slackClient.postMessage(
            channel,
            '🔍 문서를 검색하고 내용을 분석하고 있습니다... 잠시만 기다려주세요.'
        );

        const analytics = createAnalytics(env);
        const startTime = Date.now();

        try {
            // Create RAG instance with Google Drive credentials
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

            // 대화 히스토리 가져오기
            let conversationHistory = '';
            try {
                const dmHistory = await slackClient.getHistory(channel, 6);
                if (dmHistory.messages) {
                    conversationHistory = dmHistory.messages
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
                console.warn('[DM Handler] Could not fetch DM history:', error.message);
            }

            // Multi-Hop AI 호출 (복합 질문 자동 감지 및 분해)
            const result = await runMultiHopAI(text, ragSearchFn, conversationHistory, env.GEMINI_API_KEY);

            // Format response with sources
            let formattedResponse = formatResponse(result.answer, result.sources);

            if (result.isMultiHop && result.hops?.length > 0) {
                formattedResponse += `\n\n🔗 *${result.hops.length}단계 분석을 통해 답변을 생성했습니다.*`;
            }

            // Update thinking message with actual response
            await slackClient.updateMessage(channel, thinkingMsg.ts, formattedResponse);

            // Log successful query with full answer
            const responseTime = Date.now() - startTime;
            await analytics.logQuery({
                userId: user,
                userName: 'User',
                question: text,
                answer: result.answer,
                responseTime,
                ragSources: result.sources,
                success: true
            });

            console.log(`[DM Handler] Responded to user ${user}`);

        } catch (aiError) {
            console.error('[DM Handler] AI processing error:', aiError);

            // Log failed query
            const responseTime = Date.now() - startTime;
            await analytics.logQuery({
                userId: user,
                question: text,
                responseTime,
                ragSources: [],
                success: false,
                errorType: aiError.message
            });

            // Update with error message
            await slackClient.updateMessage(
                channel,
                thinkingMsg.ts,
                `😔 죄송합니다. 일시적인 오류가 발생했습니다.

다시 시도해 주시거나 다른 방식으로 질문해 주세요.

**MarkAny 제품 관련 질문을 해주시면 더 정확한 답변을 드릴 수 있습니다.**`
            );
        }

    } catch (error) {
        console.error('[DM Handler] Handler error:', error);

        // Send error message
        await slackClient.postMessage(
            channel,
            `⚠️ 시스템 오류가 발생했습니다. IT팀에 문의해 주세요.\n\nError ID: ${Date.now()}`
        );
    }
}
