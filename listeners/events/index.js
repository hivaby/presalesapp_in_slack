import { appMentionCallback } from './app_mention.js';
import { messageCallback } from './message.js';
import { directMessageCallback } from './direct_message.js';

/**
 * @param {import("@slack/bolt").App} app
 */
export const register = (app) => {
  app.event('app_mention', appMentionCallback);
  app.event('message', messageCallback);
  
  // MarkAny AI Assistant DM 처리
  app.message(async ({ message, ...args }) => {
    // DM 채널 확인 (채널 ID가 'D'로 시작)
    if (message.channel?.startsWith('D')) {
      await directMessageCallback({ event: message, ...args });
    }
  });
};
