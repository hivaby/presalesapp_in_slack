// MarkAny Security Firewall Module
// Prompt Injection & Sensitive Data Protection

export class SecurityFirewall {
  constructor() {
    // 위험 패턴 정의
    this.injectionPatterns = [
      /ignore.*previous.*instructions?/i,
      /forget.*system.*prompt/i,
      /disregard.*rules?/i,
      /override.*security/i,
      /bypass.*filter/i,
      /act\s+as\s+(?!markany)/i, // "act as" 제외 MarkAny
      /pretend\s+you\s+are/i,
      /roleplay\s+as/i,
    ];

    this.personalInfoPatterns = [
      /\b\d{3}-\d{4}-\d{4}\b/, // 전화번호
      /\b\d{6}-\d{7}\b/, // 주민번호
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // 이메일
      /\b(?:password|pwd|passwd)\s*[:=]\s*\S+/i,
      /\b(?:api[_-]?key|token|secret)\s*[:=]\s*\S+/i,
    ];

    this.confidentialKeywords = [
      '기밀', '대외비', 'confidential', 'secret',
      '주민번호', '여권번호', 'passport',
      '계좌번호', 'account number',
      '신용카드', 'credit card',
    ];
  }

  // 프롬프트 인젝션 탐지
  detectInjection(text) {
    return this.injectionPatterns.some(pattern => pattern.test(text));
  }

  // 개인정보 패턴 탐지
  detectPersonalInfo(text) {
    return this.personalInfoPatterns.some(pattern => pattern.test(text));
  }

  // 기밀 키워드 탐지
  detectConfidential(text) {
    const lowerText = text.toLowerCase();
    return this.confidentialKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  // 종합 보안 검사
  analyze(text) {
    const risks = [];

    if (this.detectInjection(text)) {
      risks.push({
        type: 'INJECTION_ATTEMPT',
        severity: 'HIGH',
        message: 'Prompt injection attempt detected',
      });
    }

    if (this.detectPersonalInfo(text)) {
      risks.push({
        type: 'PERSONAL_INFO',
        severity: 'HIGH',
        message: 'Personal information pattern detected',
      });
    }

    if (this.detectConfidential(text)) {
      risks.push({
        type: 'CONFIDENTIAL_REQUEST',
        severity: 'MEDIUM',
        message: 'Confidential keyword detected',
      });
    }

    return {
      safe: risks.length === 0,
      risks: risks,
      category: risks.length > 0 ? risks[0].type : 'SAFE_QUERY',
    };
  }

  // 민감 정보 마스킹
  maskSensitiveData(text) {
    let masked = text;

    // 전화번호 마스킹
    masked = masked.replace(/\b\d{3}-\d{4}-\d{4}\b/g, '***-****-****');

    // 이메일 마스킹
    masked = masked.replace(
      /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
      (match, user, domain) => {
        const maskedUser = user.substring(0, 2) + '***';
        return `${maskedUser}@${domain}`;
      }
    );

    // 주민번호 마스킹
    masked = masked.replace(/\b\d{6}-\d{7}\b/g, '******-*******');

    // API 키/토큰 마스킹
    masked = masked.replace(
      /\b(?:api[_-]?key|token|secret)\s*[:=]\s*(\S+)/gi,
      (match, value) => match.replace(value, '***MASKED***')
    );

    return masked;
  }

  // 보안 차단 응답 생성
  getBlockedResponse(category) {
    const responses = {
      INJECTION_ATTEMPT: `⚠️ **보안 정책 위반**

시스템 규칙을 변경하거나 우회하려는 시도가 감지되었습니다.

**MarkAny AI Assistant는 다음을 지원합니다:**
• DRM, DLP, PrintSafer, ScreenSafer, AI Sentinel 제품 문의
• 기술 지원 및 세일즈 질문
• 문서 검색 및 지식 공유`,

      PERSONAL_INFO: `⚠️ **개인정보 보호 정책**

개인정보가 포함된 요청은 처리할 수 없습니다.

개인정보를 제외하고 다시 질문해 주세요.`,

      CONFIDENTIAL_REQUEST: `⚠️ **기밀정보 보호**

기밀 정보 요청은 처리할 수 없습니다.

일반적인 제품 및 기술 문의를 해주세요.`,

      UNSUPPORTED: `🤖 **MarkAny AI Assistant 지원 범위**

다음 영역을 전문으로 지원합니다:

🔒 **DRM** - Digital Rights Management
🛡️ **DLP** - Data Loss Prevention  
🖨️ **PrintSafer** - 인쇄 보안
📱 **ScreenSafer** - 화면 캡처 방지
🤖 **AI Sentinel** - AI 보안

이러한 제품에 대해 문의해 주세요!`,
    };

    return responses[category] || responses.UNSUPPORTED;
  }

  // 로깅 (감사 추적)
  logSecurityEvent(userId, text, category, blocked = true) {
    const event = {
      timestamp: new Date().toISOString(),
      userId: userId,
      category: category,
      blocked: blocked,
      textLength: text.length,
      // 실제 텍스트는 로깅하지 않음 (보안)
    };

    console.log('[SECURITY]', JSON.stringify(event));
    
    // TODO: 실제 환경에서는 보안 로그 시스템에 저장
    // - CloudWatch Logs
    // - Splunk
    // - ELK Stack
  }
}

export const securityFirewall = new SecurityFirewall();
