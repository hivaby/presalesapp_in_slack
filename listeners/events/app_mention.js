import { runAI, formatResponse, detectProduct } from '../../ai/index.js';
import { markanyRAG } from '../../ai/rag.js';
import { feedbackBlock } from '../views/feedback_block.js';

/**
 * MarkAny Assistant - @app 멘션 처리
 * 채널에서 @assistant 멘션 시 응답
 */
export const appMentionCallback = async ({ event, client, logger, say }) => {
  try {
    const { channel, text, team, user } = event;
    const thread_ts = event.thread_ts || event.ts;

    // "생각 중..." 상태 표시
    await client.assistant.threads.setStatus({
      channel_id: channel,
      thread_ts: thread_ts,
      status: 'MarkAny 지식베이스 검색 중...',
      loading_messages: [
        '🔍 MarkAny 문서를 검색하고 있습니다...',
        '📚 Slack 히스토리를 분석하고 있습니다...',
        '🤖 AI가 최적의 답변을 준비하고 있습니다...',
        '🛡️ 보안 검증을 수행하고 있습니다...',
        '✨ 답변을 정리하고 있습니다...',
      ],
    });

    // 멘션 텍스트에서 봇 ID 제거
    const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();
    
    // 제품 감지
    const detectedProduct = detectProduct(cleanText);

    // MarkAny RAG 검색 수행
    const ragResults = await markanyRAG.search(cleanText, client);
    
    // 채널 컨텍스트 가져오기 (최근 몇 개 메시지)
    let channelContext = '';
    try {
      const channelHistory = await client.conversations.history({
        channel: channel,
        limit: 5,
        inclusive: false
      });
      
      channelContext = channelHistory.messages
        .filter(m => m.text && !m.bot_id)
        .map(m => `<@${m.user}>: ${m.text.substring(0, 100)}`)
        .join('\n');
    } catch (error) {
      logger.warn('Could not fetch channel context:', error);
    }

    // MarkAny AI 호출 (RAG 컨텍스트 포함)
    const aiResponse = await runAI(cleanText, ragResults.context, channelContext);
    
    // 출처 정보 포함하여 포맷팅
    const sources = [...ragResults.documents, ...ragResults.slackMessages];
    let formattedResponse = formatResponse(aiResponse, sources);

    // 제품별 추가 정보 제공
    if (detectedProduct) {
      formattedResponse += `\n\n🎯 **${detectedProduct} 전문 지원**\n`;
      
      const productChannels = {
        'DRM': '<#C1111111111>',
        'DLP': '<#C2222222222>',
        'PrintSafer': '<#C3333333333>',
        'ScreenSafer': '<#C4444444444>',
        'AI Sentinel': '<#C5555555555>'
      };
      
      const productChannel = productChannels[detectedProduct];
      if (productChannel) {
        formattedResponse += `• 전문 채널: ${productChannel}\n`;
      }
      
      formattedResponse += `• 기술 문서: [${detectedProduct} 가이드](https://drive.google.com/markany-${detectedProduct.toLowerCase().replace(' ', '-')})\n`;
      formattedResponse += `• 지원팀: <@U1234567890> <@U0987654321>`;
    }

    // 멘션한 사용자에게 직접 응답
    formattedResponse = `<@${user}> ${formattedResponse}`;

    // MarkAny Assistant 응답 스트리밍
    const streamer = client.chatStream({
      channel: channel,
      thread_ts: thread_ts,
      recipient_team_id: team,
      recipient_user_id: user,
    });

    await streamer.append({
      markdown_text: formattedResponse,
    });

    await streamer.stop({ blocks: [feedbackBlock] });

    // 사용 통계 로깅
    logger.info(`MarkAny Mention - Channel: ${channel}, Product: ${detectedProduct || 'General'}, Sources: ${sources.length}, User: ${user}`);

  } catch (e) {
    logger.error('MarkAny app mention error:', e);
    
    const errorResponse = `⚠️ <@${event.user}> MarkAny AI Assistant에 일시적인 문제가 발생했습니다.\n\n잠시 후 다시 시도하거나 IT팀(<#C1234567890>)에 문의해주세요.`;
    
    await say({ 
      text: errorResponse,
      thread_ts: event.thread_ts || event.ts
    });
  }
};