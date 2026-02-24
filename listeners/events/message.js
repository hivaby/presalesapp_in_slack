import { runMultiHopAI, formatResponse, detectProduct } from '../../ai/index.js';
import { markanyRAG } from '../../ai/rag.js';

/**
 * MarkAny Assistant DM 메시지 처리
 * 사용자가 봇에게 직접 메시지를 보낼 때 응답
 */
export const messageCallback = async ({ event, client, logger, say }) => {
  try {
    // 봇 자신의 메시지는 무시
    if (event.bot_id || event.subtype) {
      return;
    }

    // DM 채널인지 확인
    const channelInfo = await client.conversations.info({
      channel: event.channel
    });

    if (channelInfo.channel.is_im) {
      const { text, user, channel } = event;

      // 입력 길이 제한 (A-5)
      if (!text || text.length > 2000) {
        await say({ text: '⚠️ 메시지가 너무 깁니다. 2000자 이내로 질문해주세요.', channel });
        return;
      }

      // "생각 중..." 상태 표시
      const thinkingMessage = await say({
        text: "🤔 MarkAny 지식베이스를 검색하고 있습니다...",
        channel: channel
      });

      try {
        // 제품 감지
        const detectedProduct = detectProduct(text);

        // RAG 검색 함수 래퍼 (multi-hop에서 hop별로 호출됨)
        const ragSearchFn = (query) => markanyRAG.search(query, client);

        // 대화 히스토리 가져오기
        let conversationHistory = '';
        try {
          const dmHistory = await client.conversations.history({
            channel: channel,
            limit: 6
          });
          
          conversationHistory = dmHistory.messages
            .reverse()
            .filter(m => m.text && m.text !== text)
            .slice(0, 4)
            .map(m => {
              const role = m.bot_id ? 'MarkAny Assistant' : 'User';
              return `${role}: ${m.text.substring(0, 150)}`;
            })
            .join('\n');
        } catch (error) {
          logger.warn('Could not fetch DM history:', error.message);
        }

        // Multi-Hop AI 호출 (복합 질문 자동 감지 및 분해)
        const result = await runMultiHopAI(text, ragSearchFn, conversationHistory);

        // 출처 정보 포함하여 포맷팅
        let formattedResponse = formatResponse(result.answer, result.sources);
        
        if (result.isMultiHop && result.hops?.length > 0) {
          formattedResponse += `\n\n🔗 *${result.hops.length}단계 분석을 통해 답변을 생성했습니다.*`;
        }

        // "생각 중..." 메시지 업데이트
        await client.chat.update({
          channel: channel,
          ts: thinkingMessage.ts,
          text: formattedResponse,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: formattedResponse
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `💡 *MarkAny AI Assistant* | ${detectedProduct ? `${detectedProduct} 전문 지원` : '종합 지원'} | 추가 질문이 있으시면 언제든 말씀해주세요!`
                }
              ]
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "👍 도움됨" },
                  action_id: "feedback_helpful",
                  value: "helpful"
                },
                {
                  type: "button",
                  text: { type: "plain_text", text: "👎 개선 필요" },
                  action_id: "feedback_not_helpful",
                  value: "not_helpful"
                }
              ]
            }
          ]
        });

        logger.info(`MarkAny DM - Product: ${detectedProduct || 'General'}, Sources: ${result.sources?.length || 0}, User: ${user}`);

      } catch (error) {
        logger.error('MarkAny DM processing error:', error.message);
        
        await client.chat.update({
          channel: channel,
          ts: thinkingMessage.ts,
          text: "⚠️ **일시적 오류 발생**\n\n죄송합니다. 일시적인 오류가 발생했습니다.\n잠시 후 다시 시도해주세요."
        });
      }
    }

  } catch (error) {
    logger.error('MarkAny message event error:', error.message);
  }
};
