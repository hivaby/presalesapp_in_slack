// MarkAny Security Firewall - 통합 보안 모듈

class SecurityFirewall {
  constructor() {
    this.injectionPatterns = [
      /ignore.*previous.*instructions?/i,
      /forget.*system.*prompt/i,
      /disregard.*rules?/i,
      /override.*security/i,
      /bypass.*filter/i,
      /act\s+as\s+(?!markany)/i,
      /pretend\s+you\s+are/i,
      /roleplay\s+as/i,
    ];

    this.personalInfoPatterns = [
      /\b\d{3}-\d{4}-\d{4}\b/,
      /\b\d{6}-\d{7}\b/,
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
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

  // 요청 분석
  async analyzeRequest(text) {
    const risks = [];

    if (this.detectInjection(text)) {
      risks.push({ type: 'INJECTION_ATTEMPT', severity: 'HIGH' });
    }

    if (this.detectPersonalInfo(text)) {
      risks.push({ type: 'PERSONAL_INFO', severity: 'HIGH' });
    }

    if (this.detectConfidential(text)) {
      risks.push({ type: 'CONFIDENTIAL_REQUEST', severity: 'MEDIUM' });
    }

    return {
      safe: risks.length === 0,
      risks: risks,
      classification: risks.length > 0 ? risks[0].type : 'SAFE_QUERY',
    };
  }

  detectInjection(text) {
    return this.injectionPatterns.some(pattern => pattern.test(text));
  }

  detectPersonalInfo(text) {
    return this.personalInfoPatterns.some(pattern => pattern.test(text));
  }

  detectConfidential(text) {
    const lowerText = text.toLowerCase();
    return this.confidentialKeywords.some(keyword => 
      lowerText.includes(keyword.toLowerCase())
    );
  }

  // 차단 메시지 생성
  generateBlockedMessage(analysis) {
    const messages = {
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
    };

    return messages[analysis.classification] || messages.CONFIDENTIAL_REQUEST;
  }

  // 응답 필터링
  filterResponse(response) {
    let filtered = response;

    // 전화번호 마스킹
    filtered = filtered.replace(/\b\d{3}-\d{4}-\d{4}\b/g, '***-****-****');

    // 이메일 마스킹
    filtered = filtered.replace(
      /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Z|a-z]{2,})\b/g,
      (match, user, domain) => {
        const maskedUser = user.substring(0, 2) + '***';
        return `${maskedUser}@${domain}`;
      }
    );

    // 주민번호 마스킹
    filtered = filtered.replace(/\b\d{6}-\d{7}\b/g, '******-*******');

    return filtered;
  }

  // 보안 이벤트 로깅
  logSecurityEvent(text, analysis, userId = 'unknown') {
    if (!analysis.safe) {
      console.log('[SECURITY_ALERT]', {
        timestamp: new Date().toISOString(),
        userId: userId,
        classification: analysis.classification,
        severity: analysis.risks[0]?.severity,
        textLength: text.length,
      });
    }
  }
}

export const securityFirewall = new SecurityFirewall();
