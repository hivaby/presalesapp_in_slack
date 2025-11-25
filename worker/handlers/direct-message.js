/**
 * Direct Message Handler for Cloudflare Workers
 * 
 * Handles DM messages sent to the MarkAny AI Assistant
 */

import { createSlackClient } from '../slack-client.js';
import { runAI, formatResponse } from '../../ai/index.js';
import { markanyRAG } from '../../ai/rag.js';

export async function handleDirectMessage(event, env) {
    const { channel, text, user } = event;

    // Ignore empty messages
    if (!text || text.trim() === '') {
        return;
    }

    console.log(`[DM Handler] User ${user} asked: "${text}"`);

    const slackClient = createSlackClient(env.SLACK_BOT_TOKEN);

    try {
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

🛡️ **보안 정책:**
개인정보나 기밀정보는 처리하지 않으며, 모든 답변에는 출처를 제공합니다.

궁금한 것이 있으시면 언제든 질문해 주세요! 😊`;

            await slackClient.postMessage(channel, helpMessage);
            return;
        }

        // Send "thinking" message
        const thinkingMsg = await slackClient.postMessage(
            channel,
            '🤔 MarkAny 지식베이스를 검색하고 있습니다...'
        );

        try {
            // Perform RAG search
            const ragResults = await markanyRAG.search(text, slackClient);

            // Generate AI response with Gemini API key from env
            const aiResponse = await runAI(text, ragResults.context, '', env.GEMINI_API_KEY);

            // Format response with sources
            const sources = [...ragResults.documents, ...ragResults.slackMessages];
            const formattedResponse = formatResponse(aiResponse, sources);

            // Update thinking message with actual response
            await slackClient.updateMessage(channel, thinkingMsg.ts, formattedResponse);

            console.log(`[DM Handler] Responded to user ${user}`);

        } catch (aiError) {
            console.error('[DM Handler] AI processing error:', aiError);

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
