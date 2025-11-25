import { 
  feedbackHelpful, 
  feedbackNotHelpful, 
  retryRequest, 
  feedbackImprovementModal 
} from './feedback.js';

/**
 * MarkAny Slack AI Assistant - 액션 핸들러 등록
 * @param {import("@slack/bolt").App} app
 */
export const register = (app) => {
  // MarkAny Assistant 피드백 액션들
  app.action('feedback_helpful', feedbackHelpful);
  app.action('feedback_not_helpful', feedbackNotHelpful);
  app.action('retry_request', retryRequest);
  
  // 개선사항 모달 제출
  app.view('feedback_improvement_modal', feedbackImprovementModal);
};