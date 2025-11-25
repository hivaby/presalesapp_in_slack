import { runAI, formatResponse, detectProduct } from '../../ai/index.js';
import { markanyRAG } from '../../ai/rag.js';
import { feedbackBlock } from '../views/feedback_block.js';

/**
 * MarkAny Slack Assistant - 메시지 처리
 * 채널 요약, RAG 기반 질의응답, 제품별 전문 지원
 */
export const message = async ({ client, context, logger, message, getThreadContext, say, setTitle, setStatus }) => {
  if (!('text' in message) || !('thread_ts' in message) || !message.text || !message.thread_ts) {
    return;
  }

  const { channel, thread_ts } = message;
  const { userId, teamId } = context;

  try {
    // 제목 설정 및 로딩 상태
    await setTitle(message.text);
    await setStatus({
      status: 'MarkAny 지식베이스 검색 중...',
      loading_messages: [
        '🔍 MarkAny 문서를 검색하고 있습니다...',
        '📚 Slack 히스토리를 분석하고 있습니다...',
        '🤖 AI가 최적의 답변을 준비하고 있습니다...',
        '🛡️ 보안 검증을 수행하고 있습니다...',
        '✨ 답변을 정리하고 있습니다...',
      ],
    });

    /** Scenario 1: MarkAny 채널 요약 */
    if (message.text === 'Assistant, please summarize the activity in this channel!' || 
        message.text.includes('채널 요약') || message.text.includes('channel summary') ||
        message.text.includes('채널 활동') || message.text.includes('요약해줘')) {
      
      const threadContext = await getThreadContext();
      let channelHistory;

      try {
        channelHistory = await client.conversations.history({
          channel: threadContext.channel_id,
          limit: 50,
        });
      } catch (e) {
        if (e.data.error === 'not_in_channel') {
          await client.conversations.join({ channel: threadContext.channel_id });
          channelHistory = await client.conversations.history({
            channel: threadContext.channel_id,
            limit: 50,
          });
        } else {
          logger.error(e);
        }
      }

      let llmPrompt = `MarkAny Slack 채널 <#${threadContext.channel_id}>의 최근 활동을 요약해주세요. 주요 논의사항, 결정사항, 액션 아이템을 포함해주세요:`;
      
      const recentMessages = channelHistory.messages.reverse().slice(0, 20); // 최근 20개 메시지만
      for (const m of recentMessages) {
        if (m.user && m.text && !m.bot_id) {
          llmPrompt += `\n<@${m.user}>: ${m.text.substring(0, 150)}`;
        }
      }

      // MarkAny AI 호출 (대화 히스토리 포함)
      const result = await runAI(llmPrompt, '', `채널 요약 요청: ${message.text}`);

      const streamer = client.chatStream({
        channel,
        recipient_team_id: teamId,
        recipient_user_id: userId,
        thread_ts,
      });

      await streamer.append({ markdown_text: result });
      await streamer.stop({ blocks: [feedbackBlock] });

      return;
    }

    /** Scenario 2: MarkAny RAG 기반 대화 */
    // 제품 감지
    const detectedProduct = detectProduct(message.text);
    
    // RAG 검색 수행 (제품별 최적화)
    const ragResults = await markanyRAG.search(message.text, client);
    
    // 스레드 히스토리 가져오기 (최근 10개 메시지만)
    const thread = await client.conversations.replies({
      channel,
      ts: thread_ts,
      oldest: thread_ts,
      limit: 10
    });

    const threadHistory = thread.messages
      .filter(m => m.text && m.text.trim()) // 빈 메시지 제외
      .map((m) => {
        const role = m.bot_id ? 'MarkAny Assistant' : 'User';
        return `${role}: ${m.text.substring(0, 200)}`; // 메시지 길이 제한
      });

    // 대화 컨텍스트 구성
    const conversationContext = threadHistory.slice(-5).join('\n'); // 최근 5개 대화만
    
    // MarkAny AI 호출 (RAG 컨텍스트 + 대화 히스토리 포함)
    const answer = await runAI(message.text, ragResults.context, conversationContext);
    
    // 출처 정보 포함하여 포맷팅
    const sources = [...ragResults.documents, ...ragResults.slackMessages];
    const formattedAnswer = formatResponse(answer, sources);
    
    // 제품별 추가 정보 제공
    let finalAnswer = formattedAnswer;
    if (detectedProduct && sources.length === 0) {
      finalAnswer += `\n\n💡 **${detectedProduct} 관련 추가 도움이 필요하시면:**\n• 제품 문서: [MarkAny ${detectedProduct} 가이드](https://drive.google.com)\n• 기술 지원: <#C1234567890>\n• 세일즈 문의: <#C0987654321>`;
    }

    const streamer = client.chatStream({
      channel,
      recipient_team_id: teamId,
      recipient_user_id: userId,
      thread_ts,
    });

    await streamer.append({ markdown_text: finalAnswer });
    await streamer.stop({ blocks: [feedbackBlock] });
    
    // 사용 통계 로깅 (선택사항)
    logger.info(`MarkAny Assistant - Product: ${detectedProduct || 'General'}, Sources: ${sources.length}, User: ${userId}`);

  } catch (e) {
    logger.error('MarkAny Assistant error:', e);
    
    const errorMessage = `⚠️ **MarkAny AI Assistant 오류**\n\n일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.\n\n지속적인 문제 발생 시 IT팀(<#C1234567890>)에 문의해주세요.`;
    
    const streamer = client.chatStream({
      channel,
      recipient_team_id: teamId,
      recipient_user_id: userId,
      thread_ts,
    });

    await streamer.append({ markdown_text: errorMessage });
    await streamer.stop();
  }
};