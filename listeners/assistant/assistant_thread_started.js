/**
 * MarkAny AI Assistant - Thread Started Handler
 * The `assistant_thread_started` event is sent when a user opens the Assistant container.
 * This can happen via DM with the app or as a side-container within a channel.
 *
 * @param {Object} params
 * @param {import("@slack/types").AssistantThreadStartedEvent} params.event - The assistant thread started event.
 * @param {import("@slack/logger").Logger} params.logger - Logger instance.
 * @param {import("@slack/bolt").SayFn} params.say - Function to send messages.
 * @param {Function} params.setSuggestedPrompts - Function to set suggested prompts.
 * @param {Function} params.saveThreadContext - Function to save thread context.
 *
 * @see {@link https://docs.slack.dev/reference/events/assistant_thread_started}
 */
export const assistantThreadStarted = async ({ event, logger, say, setSuggestedPrompts, saveThreadContext }) => {
  const { context } = event.assistant_thread;

  try {
    // MarkAny AI Assistant 환영 메시지
    await say('🤖 **MarkAny AI Assistant**에 오신 것을 환영합니다! 👋\n\nMarkAny 제품과 기술에 대한 질문을 도와드리겠습니다.');

    await saveThreadContext();

    /**
     * DM 컨텍스트 - 일반적인 MarkAny 제품 질문
     */
    if (!context.channel_id) {
      await setSuggestedPrompts({
        title: 'MarkAny 제품에 대해 질문해보세요:',
        prompts: [
          {
            title: '🔒 DRM 솔루션 가이드',
            message: 'DRM 솔루션의 주요 기능과 설정 방법을 알려주세요'
          },
          {
            title: '🛡️ DLP 정책 설정',
            message: 'DLP 데이터 유출 방지 정책 설정 방법은?'
          },
          {
            title: '🖨️ PrintSafer 사용법',
            message: 'PrintSafer 인쇄 보안 설정과 워터마크 적용 방법'
          },
          {
            title: '📱 ScreenSafer 기능',
            message: 'ScreenSafer 화면 캡처 방지 기능 사용법'
          }
        ],
      });
    }

    /**
     * 채널 컨텍스트 - 채널별 특화 프롬프트
     */
    if (context.channel_id) {
      const channelPrompts = [
        {
          title: '📊 채널 활동 요약',
          message: 'Assistant, please summarize the activity in this channel!'
        }
      ];

      // 채널명에 따른 제품별 특화 프롬프트 추가
      const channelName = context.channel_id.toLowerCase();
      
      if (channelName.includes('drm')) {
        channelPrompts.push({
          title: '🔒 DRM 기술 지원',
          message: 'DRM 관련 기술적 이슈나 설정 문제를 도와주세요'
        });
      } else if (channelName.includes('dlp')) {
        channelPrompts.push({
          title: '🛡️ DLP 정책 문의',
          message: 'DLP 정책 설정이나 모니터링 관련 질문이 있습니다'
        });
      } else if (channelName.includes('print')) {
        channelPrompts.push({
          title: '🖨️ PrintSafer 지원',
          message: 'PrintSafer 인쇄 보안 관련 문제를 해결해주세요'
        });
      } else if (channelName.includes('screen')) {
        channelPrompts.push({
          title: '📱 ScreenSafer 지원',
          message: 'ScreenSafer 화면 보안 관련 도움이 필요합니다'
        });
      } else if (channelName.includes('ai') || channelName.includes('sentinel')) {
        channelPrompts.push({
          title: '🤖 AI Sentinel 지원',
          message: 'AI Sentinel AI 보안 솔루션에 대해 문의합니다'
        });
      } else {
        // 일반 채널용 프롬프트
        channelPrompts.push({
          title: '💡 MarkAny 제품 문의',
          message: 'MarkAny 제품 전반에 대한 질문이나 기술 지원이 필요합니다'
        });
      }

      await setSuggestedPrompts({
        title: '이 채널에서 할 수 있는 작업:',
        prompts: channelPrompts
      });
    }
  } catch (e) {
    logger.error('[MarkAny Assistant] Thread start error:', e);
  }
};