import { runAI, formatResponse, getProductSpecificPrompt } from '../../ai/index.js';
import { markanyRAG } from '../../ai/rag.js';

/**
 * MarkAny AI Assistant - Direct Message Handler
 * DM으로 받은 질문에 대해 RAG 기반 응답 제공
 */
export const directMessageCallback = async ({ event, client, logger, say }) => {
  try {
    const { channel, text, user, team } = event;
    
    // 봇 자신의 메시지는 무시
    if (event.bot_id) return;
    
    // DM 채널인지 확인 (채널 ID가 'D'로 시작)
    if (!channel.startsWith('D')) return;

    console.log(`[MarkAny DM] User ${user} asked: "${text}"`);

    // 특별 명령어 처리
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

      await say({ text: helpMessage });
      return;
    }

    // 제품별 도움말 요청 처리
    const productHelpMatch = text.match(/(DRM|DLP|PrintSafer|ScreenSafer|AI Sentinel)\s*(도움말|help)/i);
    if (productHelpMatch) {
      const productName = productHelpMatch[1];
      const productPrompt = getProductSpecificPrompt(productName); // Changed to getProductSpecificPrompt
      const helpText = `**${productName}** 관련 도움말:\n\n${productPrompt}`;
      await say({ text: helpText });
      return;
    }

    // "thinking..." 상태 표시
    const thinkingMessage = await say({ 
      text: "🤔 MarkAny 지식베이스를 검색하고 있습니다..." 
    });

    try {
      // RAG 검색 수행
      const ragResults = await markanyRAG.search(text, client);
      
      // AI 응답 생성
      const aiResponse = await runAI(text, ragResults.context);
      
      // 출처 정보 포함하여 포맷팅
      const sources = [...ragResults.documents, ...ragResults.slackMessages];
      const formattedResponse = formatResponse(aiResponse, sources);

      // thinking 메시지 업데이트
      await client.chat.update({
        channel: channel,
        ts: thinkingMessage.ts,
        text: formattedResponse
      });

      console.log(`[MarkAny DM] Responded to user ${user}`);

    } catch (aiError) {
      console.error('[MarkAny DM] AI processing error:', aiError);
      
      // 에러 시 thinking 메시지 업데이트
      await client.chat.update({
        channel: channel,
        ts: thinkingMessage.ts,
        text: `😔 죄송합니다. 일시적인 오류가 발생했습니다.\n\n다시 시도해 주시거나 다른 방식으로 질문해 주세요.\n\n**MarkAny 제품 관련 질문을 해주시면 더 정확한 답변을 드릴 수 있습니다.**`
      });
    }

  } catch (error) {
    logger.error('[MarkAny DM] Handler error:', error);
    await say({ 
      text: `⚠️ 시스템 오류가 발생했습니다. IT팀에 문의해 주세요.\n\nError ID: ${Date.now()}` 
    });
  }
};