import { appMentionCallback } from './app_mention.js';
import { messageCallback } from './message.js';

/**
 * @param {import("@slack/bolt").App} app
 */
export const register = (app) => {
  app.event('app_mention', appMentionCallback);
  // DM 메시지는 message.js의 messageCallback에서 처리
  // (is_im 체크로 DM만 필터링)
  app.event('message', messageCallback);
};
