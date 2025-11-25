import { runAI, formatResponse } from '../../ai/index.js';
import { markanyRAG } from '../../ai/rag.js';

/**
 * MarkAny AI Assistant - Suggested Prompt Actions Handler
 * 제안된 프롬프트 버튼 클릭 시 처리
 */

// DRM 가이드 액션
export const drmGuideAction = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { channel, message, user } = body;
    const query = "DRM 솔루션의 주요 기능과 설정 방법을 알려주세요";
    
    await processMarkAnyQuery(query, channel, message, user, client, logger);
  } catch (error) {
    logger.error('[MarkAny Action] DRM guide error:', error);
  }
};

// DLP 정책 액션
export const dlpPolicyAction = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { channel, message, user } = body;
    const query = "DLP 데이터 유출 방지 정책 설정 방법은?";
    
    await processMarkAnyQuery(query, channel, message, user, client, logger);
  } catch (error) {
    logger.error('[MarkAny Action] DLP policy error:', error);
  }
};

// PrintSafer 도움말 액션
export const printSaferHelpAction = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { channel, message, user } = body;
    const query = "PrintSafer 인쇄 보안 설정과 워터마크 적용 방법";
    
    await processMarkAnyQuery(query, channel, message, user, client, logger);
  } catch (error) {
    logger.error('[MarkAny Action] PrintSafer help error:', error);
  }
};

// ScreenSafer 도움말 액션
export const screenSaferHelpAction = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { channel, message, user } = body;
    const query = "ScreenSafer 화면 캡처 방지 기능 사용법";
    
    await processMarkAnyQuery(query, channel, message, user, client, logger);
  } catch (error) {
    logger.error('[MarkAny Action] ScreenSafer help error:', error);
  }
};

// AI Sentinel 도움말 액션
export const aiSentinelHelpAction = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { channel, message, user } = body;
    const query = "AI Sentinel AI 보안 솔루션에 대해 알려주세요";
    
    await processMarkAnyQuery(query, channel, message, user, client, logger);
  } catch (error) {
    logger.error('[MarkAny Action] AI Sentinel help error:', error);
  }
};

// 채널 요약 액션
export const summarizeChannelAction = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { channel, message, user } = body;
    const query = "Assistant, please summarize the activity in this channel!";
    
    await processMarkAnyQuery(query, channel, message, user, client, logger);
  } catch (error) {
    logger.error('[MarkAny Action] Channel summary error:', error);
  }
};

/**
 * MarkAny 쿼리 처리 공통 함수
 */
async function processMarkAnyQuery(query, channel, message, user, client, logger) {
  try {
    // 로딩 메시지 표시
    const loadingResponse = await client.chat.postMessage({
      channel: channel.id,
      thread_ts: message.thread_ts || message.ts,
      text: "🤔 MarkAny 지식베이스를 검색하고 있습니다..."
    });

    // RAG 검색 수행
    const ragResults = await markanyRAG.search(query, client);
    
    // AI 응답 생성
    const aiResponse = await runAI(query, ragResults.context);
    
    // 출처 정보 포함하여 포맷팅
    const sources = [...ragResults.documents, ...ragResults.slackMessages];
    const formattedResponse = formatResponse(aiResponse, sources);

    // 로딩 메시지를 실제 응답으로 업데이트
    await client.chat.update({
      channel: channel.id,
      ts: loadingResponse.ts,
      text: formattedResponse
    });

    logger.info(`[MarkAny Action] Processed query: "${query}" for user ${user.id}`);

  } catch (error) {
    logger.error('[MarkAny Action] Query processing error:', error);
    
    // 에러 메시지 표시
    await client.chat.postMessage({
      channel: channel.id,
      thread_ts: message.thread_ts || message.ts,
      text: `😔 죄송합니다. 일시적인 오류가 발생했습니다.\n\n다시 시도해 주시거나 다른 방식으로 질문해 주세요.\n\n**MarkAny 제품 관련 질문을 해주시면 더 정확한 답변을 드릴 수 있습니다.**`
    });
  }
}