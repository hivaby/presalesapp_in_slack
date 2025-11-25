/**
 * MarkAny Assistant - 피드백 액션 처리
 * 사용자 피드백 수집 및 개선사항 추적
 */

export const feedbackHelpful = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { user, channel, message } = body;
    
    // 피드백 로깅
    logger.info(`MarkAny Feedback - Helpful: User ${user.id}, Channel: ${channel.id}`);
    
    // 사용자에게 감사 메시지
    await client.chat.postEphemeral({
      channel: channel.id,
      user: user.id,
      text: "👍 피드백 감사합니다! MarkAny AI Assistant가 도움이 되어 기쁩니다."
    });
    
    // TODO: 피드백 데이터베이스 저장
    // await saveFeedback({
    //   userId: user.id,
    //   channelId: channel.id,
    //   messageTs: message.ts,
    //   feedback: 'helpful',
    //   timestamp: new Date()
    // });
    
  } catch (error) {
    logger.error('Feedback helpful error:', error);
  }
};

export const feedbackNotHelpful = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { user, channel, message } = body;
    
    // 피드백 로깅
    logger.info(`MarkAny Feedback - Not Helpful: User ${user.id}, Channel: ${channel.id}`);
    
    // 개선사항 수집을 위한 모달 열기
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'feedback_improvement_modal',
        title: {
          type: 'plain_text',
          text: 'MarkAny AI 개선 제안'
        },
        submit: {
          type: 'plain_text',
          text: '제출'
        },
        close: {
          type: 'plain_text',
          text: '취소'
        },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '더 나은 MarkAny AI Assistant를 위해 개선사항을 알려주세요:'
            }
          },
          {
            type: 'input',
            block_id: 'improvement_category',
            element: {
              type: 'static_select',
              action_id: 'category_select',
              placeholder: {
                type: 'plain_text',
                text: '개선 영역을 선택해주세요'
              },
              options: [
                {
                  text: {
                    type: 'plain_text',
                    text: '답변 정확도'
                  },
                  value: 'accuracy'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '응답 속도'
                  },
                  value: 'speed'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '출처/참고자료'
                  },
                  value: 'sources'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '제품 전문성'
                  },
                  value: 'expertise'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '사용자 경험'
                  },
                  value: 'ux'
                },
                {
                  text: {
                    type: 'plain_text',
                    text: '기타'
                  },
                  value: 'other'
                }
              ]
            },
            label: {
              type: 'plain_text',
              text: '개선 영역'
            }
          },
          {
            type: 'input',
            block_id: 'improvement_details',
            element: {
              type: 'plain_text_input',
              action_id: 'details_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: '구체적인 개선사항이나 문제점을 설명해주세요...'
              }
            },
            label: {
              type: 'plain_text',
              text: '상세 내용'
            }
          },
          {
            type: 'input',
            block_id: 'expected_answer',
            element: {
              type: 'plain_text_input',
              action_id: 'expected_input',
              multiline: true,
              placeholder: {
                type: 'plain_text',
                text: '어떤 답변을 기대하셨나요? (선택사항)'
              }
            },
            label: {
              type: 'plain_text',
              text: '기대했던 답변'
            },
            optional: true
          }
        ],
        private_metadata: JSON.stringify({
          originalMessageTs: message.ts,
          channelId: channel.id
        })
      }
    });
    
  } catch (error) {
    logger.error('Feedback not helpful error:', error);
  }
};

export const retryRequest = async ({ ack, body, client, logger }) => {
  await ack();
  
  try {
    const { user, channel, actions } = body;
    const originalQuery = actions[0].value;
    
    // 재시도 로깅
    logger.info(`MarkAny Retry: User ${user.id}, Query: ${originalQuery}`);
    
    // 재시도 메시지 표시
    await client.chat.postEphemeral({
      channel: channel.id,
      user: user.id,
      text: "🔄 요청을 다시 처리하고 있습니다..."
    });
    
    // TODO: 원래 요청을 다시 처리
    // 이 부분은 메시지 처리 로직을 재사용해야 함
    
  } catch (error) {
    logger.error('Retry request error:', error);
  }
};

export const feedbackImprovementModal = async ({ ack, body, client, logger, view }) => {
  await ack();
  
  try {
    const { user } = body;
    const values = view.state.values;
    const privateMetadata = JSON.parse(view.private_metadata);
    
    const category = values.improvement_category.category_select.selected_option.value;
    const details = values.improvement_details.details_input.value;
    const expectedAnswer = values.expected_answer?.expected_input?.value || '';
    
    // 개선사항 로깅
    logger.info(`MarkAny Improvement Feedback:`, {
      userId: user.id,
      category,
      details,
      expectedAnswer,
      originalMessageTs: privateMetadata.originalMessageTs,
      channelId: privateMetadata.channelId
    });
    
    // TODO: 개선사항 데이터베이스 저장
    // await saveImprovementFeedback({
    //   userId: user.id,
    //   category,
    //   details,
    //   expectedAnswer,
    //   originalMessageTs: privateMetadata.originalMessageTs,
    //   channelId: privateMetadata.channelId,
    //   timestamp: new Date()
    // });
    
    // 감사 메시지
    await client.chat.postEphemeral({
      channel: privateMetadata.channelId,
      user: user.id,
      text: `🙏 소중한 피드백 감사합니다!\n\n**개선 영역:** ${getCategoryName(category)}\n**내용:** ${details}\n\nMarkAny AI Assistant 개선에 반영하겠습니다.`
    });
    
    // 개발팀에 알림 (선택사항)
    if (category === 'accuracy' || category === 'expertise') {
      await client.chat.postMessage({
        channel: 'C1234567890', // 개발팀 채널
        text: `🔧 **MarkAny AI 개선 제안**\n\n**사용자:** <@${user.id}>\n**카테고리:** ${getCategoryName(category)}\n**내용:** ${details}\n\n원본 메시지: https://slack.com/archives/${privateMetadata.channelId}/p${privateMetadata.originalMessageTs.replace('.', '')}`
      });
    }
    
  } catch (error) {
    logger.error('Feedback improvement modal error:', error);
  }
};

function getCategoryName(category) {
  const categoryNames = {
    'accuracy': '답변 정확도',
    'speed': '응답 속도',
    'sources': '출처/참고자료',
    'expertise': '제품 전문성',
    'ux': '사용자 경험',
    'other': '기타'
  };
  
  return categoryNames[category] || category;
}