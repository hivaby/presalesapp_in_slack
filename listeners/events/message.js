import { runAI, formatResponse, detectProduct } from '../../ai/index.js';
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

      // "생각 중..." 상태 표시
      const thinkingMessage = await say({
        text: "🤔 MarkAny 지식베이스를 검색하고 있습니다...",
        channel: channel
      });

      try {
        // 제품 감지
        const detectedProduct = detectProduct(text);

        // RAG 검색 수행
        const ragResults = await markanyRAG.search(text, client);
        
        // 사용자별 대화 히스토리 (간단한 구현)
        let conversationHistory = '';
        try {
          const dmHistory = await client.conversations.history({
            channel: channel,
            limit: 6 // 최근 3번의 대화 (사용자 + 봇)
          });
          
          conversationHistory = dmHistory.messages
            .reverse()
            .filter(m => m.text && m.text !== text) // 현재 메시지 제외
            .slice(0, 4) // 최근 2번의 대화만
            .map(m => {
              const role = m.bot_id ? 'MarkAny Assistant' : 'User';
              return `${role}: ${m.text.substring(0, 150)}`;
            })
            .join('\n');
        } catch (error) {
          logger.warn('Could not fetch DM history:', error);
        }

        // MarkAny AI 호출
        const aiResponse = await runAI(text, ragResults.context, conversationHistory);
        
        // 출처 정보 포함하여 포맷팅
        const sources = [...ragResults.documents, ...ragResults.slackMessages];
        let formattedResponse = formatResponse(aiResponse, sources);

        // 제품별 맞춤 정보 추가
        if (detectedProduct) {
          formattedResponse += `\n\n🎯 **${detectedProduct} 전문 지원**\n`;
          
          const productInfo = {
            'DRM': {
              channel: '<#C1111111111>',
              docs: 'https://drive.google.com/markany-drm',
              experts: '<@U1111111111> <@U2222222222>'
            },
            'DLP': {
              channel: '<#C2222222222>',
              docs: 'https://drive.google.com/markany-dlp',
              experts: '<@U3333333333> <@U4444444444>'
            },
            'PrintSafer': {
              channel: '<#C3333333333>',
              docs: 'https://drive.google.com/markany-printsafer',
              experts: '<@U5555555555> <@U6666666666>'
            },
            'ScreenSafer': {
              channel: '<#C4444444444>',
              docs: 'https://drive.google.com/markany-screensafer',
              experts: '<@U7777777777> <@U8888888888>'
            },
            'AI Sentinel': {
              channel: '<#C5555555555>',
              docs: 'https://drive.google.com/markany-ai-sentinel',
              experts: '<@U9999999999> <@U0000000000>'
            }
          };

          const info = productInfo[detectedProduct];
          if (info) {
            formattedResponse += `• 전문 채널: ${info.channel}\n`;
            formattedResponse += `• 기술 문서: [${detectedProduct} 가이드](${info.docs})\n`;
            formattedResponse += `• 전문가: ${info.experts}`;
          }
        }

        // 개인화된 추천 추가
        if (sources.length === 0) {
          formattedResponse += `\n\n💡 **추가 도움말**\n`;
          formattedResponse += `• 전체 제품 가이드: [MarkAny 제품 포털](https://drive.google.com/markany-products)\n`;
          formattedResponse += `• 기술 지원: <#C1234567890>\n`;
          formattedResponse += `• 세일즈 문의: <#C0987654321>\n`;
          formattedResponse += `• 긴급 지원: <@U1234567890>`;
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
                  text: {
                    type: "plain_text",
                    text: "👍 도움됨"
                  },
                  action_id: "feedback_helpful",
                  value: "helpful"
                },
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "👎 개선 필요"
                  },
                  action_id: "feedback_not_helpful",
                  value: "not_helpful"
                }
              ]
            }
          ]
        });

        // 사용 통계 로깅
        logger.info(`MarkAny DM - Product: ${detectedProduct || 'General'}, Sources: ${sources.length}, User: ${user}`);

      } catch (error) {
        logger.error('MarkAny DM processing error:', error);
        
        // 에러 시 "생각 중..." 메시지 업데이트
        await client.chat.update({
          channel: channel,
          ts: thinkingMessage.ts,
          text: "⚠️ **일시적 오류 발생**\n\n죄송합니다. 일시적인 오류가 발생했습니다.\n\n• 잠시 후 다시 시도해주세요\n• 지속적인 문제 시 IT팀(<#C1234567890>)에 문의해주세요\n• 긴급한 경우 <@U1234567890>에게 직접 연락해주세요",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "⚠️ **일시적 오류 발생**\n\n죄송합니다. 일시적인 오류가 발생했습니다.\n\n• 잠시 후 다시 시도해주세요\n• 지속적인 문제 시 IT팀(<#C1234567890>)에 문의해주세요\n• 긴급한 경우 <@U1234567890>에게 직접 연락해주세요"
              }
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "🔄 다시 시도"
                  },
                  action_id: "retry_request",
                  value: text
                }
              ]
            }
          ]
        });
      }
    }

  } catch (error) {
    logger.error('MarkAny message event error:', error);
  }
};