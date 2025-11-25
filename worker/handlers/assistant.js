/**
 * Assistant Thread Handler for Cloudflare Workers
 * 
 * Handles Assistant panel events (thread started, context changed)
 */

import { createSlackClient } from '../slack-client.js';

export async function handleAssistantThread(event, env, eventType) {
    const { assistant_thread } = event;
    const { context } = assistant_thread;

    console.log(`[Assistant Handler] Thread ${eventType}: ${JSON.stringify(context)}`);

    const slackClient = createSlackClient(env.SLACK_BOT_TOKEN);

    try {
        if (eventType === 'started') {
            // Send welcome message
            const channelId = context.channel_id;
            const threadTs = assistant_thread.thread_ts;

            // Post welcome message
            await slackClient.postMessage(
                channelId || 'DM',
                '🤖 **MarkAny AI Assistant**에 오신 것을 환영합니다! 👋\n\nMarkAny 제품과 기술에 대한 질문을 도와드리겠습니다.'
            );

            // Set suggested prompts based on context
            let prompts = [];

            if (!context.channel_id) {
                // DM context - general product questions
                prompts = [
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
                ];
            } else {
                // Channel context - channel-specific prompts
                prompts = [
                    {
                        title: '💡 MarkAny 제품 문의',
                        message: 'MarkAny 제품 전반에 대한 질문이나 기술 지원이 필요합니다'
                    },
                    {
                        title: '📊 채널 활동 요약',
                        message: 'Assistant, please summarize the activity in this channel!'
                    }
                ];
            }

            // Set suggested prompts
            try {
                await slackClient.setSuggestedPrompts(
                    channelId,
                    threadTs,
                    context.channel_id ? '이 채널에서 할 수 있는 작업:' : 'MarkAny 제품에 대해 질문해보세요:',
                    prompts
                );
            } catch (e) {
                console.error('[Assistant Handler] Failed to set suggested prompts:', e);
            }
        }

    } catch (error) {
        console.error('[Assistant Handler] Error:', error);
    }
}
