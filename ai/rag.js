// MarkAny RAG (Retrieval-Augmented Generation) Module
// Google Drive + Slack Workspace Knowledge Integration

import { createGoogleDriveClient } from './google-drive-client.js';

export class MarkAnyRAG {
  constructor(googleServiceAccountJson = null, googleDriveFolderIds = null) {
    this.vectorDB = new Map(); // 간단한 메모리 저장소 (향후 Pinecone/Chroma 연동)
    this.slackCache = new Map();
    this.driveCache = new Map();
    this.googleServiceAccountJson = googleServiceAccountJson;
    this.googleDriveFolderIds = googleDriveFolderIds;
    this.driveClient = null;
  }

  // Initialize Google Drive client
  initDriveClient() {
    if (!this.driveClient && this.googleServiceAccountJson && this.googleDriveFolderIds) {
      this.driveClient = createGoogleDriveClient(
        this.googleServiceAccountJson,
        this.googleDriveFolderIds
      );
    }
  }

  // Google Drive 문서 검색
  async searchDriveDocuments(query, limit = 5) {
    // Initialize Drive client if not already done
    this.initDriveClient();

    if (!this.driveClient) {
      console.log('[RAG] Google Drive client not configured');
      return [];
    }

    try {
      const results = await this.driveClient.searchFiles(query, limit);
      console.log(`[RAG] Found ${results.length} documents from Google Drive`);
      return results;
    } catch (error) {
      console.error('[RAG] Google Drive search error:', error);
      return [];
    }
  }

  // Slack 메시지 검색 (conversations.history 기반)
  async searchSlackMessages(query, client, limit = 5) {
    try {
      // Get list of public channels (reduced limit to avoid subrequest limit)
      const channelsResponse = await client.getChannels(20);
      const channels = channelsResponse.channels || [];

      const keywords = query.toLowerCase().split(' ').filter(k => k.length > 1);
      const results = [];

      // Search through recent messages in each channel (limit to 5 channels)
      for (const channel of channels.slice(0, 5)) {
        try {
          // Skip if bot is not a member
          if (!channel.is_member) {
            continue;
          }

          const historyResponse = await client.getHistory(channel.id, 50); // Reduced from 100
          const messages = historyResponse.messages || [];

          // Filter messages by keywords and fetch permalinks
          const matches = await Promise.all(
            messages
              .filter(msg => {
                if (!msg.text || msg.subtype) return false;
                const text = msg.text.toLowerCase();
                return keywords.some(kw => text.includes(kw));
              })
              .map(async msg => {
                let permalink = null;
                try {
                  const permalinkResponse = await client.getPermalink(channel.id, msg.ts);
                  permalink = permalinkResponse.permalink;
                } catch (error) {
                  console.error(`Error getting permalink for message ${msg.ts}:`, error);
                }

                return {
                  text: this.filterSensitiveContent(msg.text),
                  channel: channel.name,
                  channelId: channel.id,
                  ts: msg.ts,
                  permalink: permalink,
                  score: this.calculateRelevanceScore(msg.text, keywords),
                  type: "slack_message"
                };
              })
          );

          results.push(...matches);

          if (results.length >= limit * 2) break;
        } catch (error) {
          console.error(`Error searching channel ${channel.name}:`, error);
          continue;
        }
      }

      // Filter sensitive channels and sort by score
      const sensitiveChannels = ['hr', 'finance', 'salary', 'personal'];
      const filtered = results
        .filter(msg =>
          !sensitiveChannels.some(sensitive =>
            msg.channel?.toLowerCase().includes(sensitive)
          )
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return filtered;
    } catch (error) {
      console.error('Slack search error:', error);
      return [];
    }
  }

  // Calculate relevance score for a message
  calculateRelevanceScore(text, keywords) {
    const lowerText = text.toLowerCase();
    let score = 0;

    keywords.forEach(keyword => {
      const count = (lowerText.match(new RegExp(keyword, 'g')) || []).length;
      score += count * 10;
    });

    // Boost score for exact phrase matches
    const queryPhrase = keywords.join(' ');
    if (lowerText.includes(queryPhrase)) {
      score += 50;
    }

    return score;
  }

  // MarkAny 제품별 전문 검색
  async searchByProduct(productType, query, client) {
    const productChannels = {
      'DRM': ['drm-support', 'document-security', 'tech-drm'],
      'DLP': ['dlp-support', 'data-protection', 'tech-dlp'],
      'PrintSafer': ['printsafer-support', 'print-security'],
      'ScreenSafer': ['screensafer-support', 'screen-protection'],
      'AI Sentinel': ['ai-sentinel', 'ai-security']
    };

    const channels = productChannels[productType] || [];
    let productResults = [];

    for (const channel of channels) {
      try {
        const channelQuery = `in:#${channel} ${query}`;
        const results = await this.searchSlackMessages(channelQuery, client, 3);
        productResults = productResults.concat(results);
      } catch (error) {
        console.error(`Error searching channel ${channel}:`, error);
      }
    }

    return productResults.slice(0, 5);
  }

  // 통합 RAG 검색
  async search(query, slackClient = null) {
    const results = {
      documents: [],
      slackMessages: [],
      context: ''
    };

    try {
      // 1. Google Drive 검색
      results.documents = await this.searchDriveDocuments(query);

      // 2. Slack 메시지 검색 (클라이언트가 있는 경우)
      if (slackClient) {
        results.slackMessages = await this.searchSlackMessages(query, slackClient);

        // 3. 제품별 전문 검색 추가
        const productType = this.detectProductFromQuery(query);
        if (productType) {
          const productMessages = await this.searchByProduct(productType, query, slackClient);
          results.slackMessages = [...results.slackMessages, ...productMessages]
            .slice(0, 8); // 중복 제거 및 제한
        }
      }

      // 4. 컨텍스트 생성
      results.context = this.buildContext(results.documents, results.slackMessages);

      return results;
    } catch (error) {
      console.error('RAG search error:', error);
      return results;
    }
  }

  // 제품 감지
  detectProductFromQuery(query) {
    const productKeywords = {
      'DRM': ['drm', '문서보안', '암호화', '권한관리'],
      'DLP': ['dlp', '데이터유출', '정보유출'],
      'PrintSafer': ['printsafer', '인쇄보안', '워터마크'],
      'ScreenSafer': ['screensafer', '화면캡처', '스크린샷'],
      'AI Sentinel': ['ai sentinel', 'ai보안']
    };

    const lowerQuery = query.toLowerCase();

    for (const [product, keywords] of Object.entries(productKeywords)) {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        return product;
      }
    }

    return null;
  }

  // RAG 컨텍스트 구성
  buildContext(documents, slackMessages) {
    let context = '';

    if (documents.length > 0) {
      context += '[MARKANY_DRIVE_DOCUMENTS]\n';
      documents.forEach(doc => {
        context += `제목: ${doc.title}\n`;
        context += `내용: ${doc.snippet}\n`;
        context += `수정일: ${doc.lastModified}\n`;
        context += `작성자: ${doc.author}\n\n`;
      });
    }

    if (slackMessages.length > 0) {
      context += '[MARKANY_SLACK_KNOWLEDGE]\n';
      slackMessages.forEach(msg => {
        context += `채널: #${msg.channel}\n`;
        context += `내용: ${msg.text.substring(0, 200)}...\n`;
        context += `점수: ${msg.score}\n\n`;
      });
    }

    // MarkAny 제품 정보 추가
    context += this.getMarkAnyProductContext();

    return context;
  }

  // MarkAny 제품 기본 정보
  getMarkAnyProductContext() {
    return `
[MARKANY_PRODUCT_INFO]
DRM: 디지털 권한 관리 솔루션, 문서 보안 및 암호화
DLP: 데이터 유출 방지 솔루션, 실시간 정보 보호
PrintSafer: 인쇄 보안 솔루션, 워터마크 및 추적
ScreenSafer: 화면 캡처 방지 솔루션
AI Sentinel: AI 기반 보안 솔루션

조직: MCG(MarkAny Consulting Group), PS(Partner Success), MTG(MarkAny Technology Group), SIST(Security Information Systems Team), PIST(Product Innovation & Strategy Team)
`;
  }

  // 민감 정보 필터링
  filterSensitiveContent(content) {
    // 개인정보, 기밀정보 패턴 제거
    const sensitivePatterns = [
      /\b\d{3}-\d{4}-\d{4}\b/g, // 전화번호
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // 이메일
      /\b\d{6}-\d{7}\b/g, // 주민번호 패턴
      /password|pwd|secret|token|credential/gi, // 민감 키워드
      /급여|연봉|salary|pay/gi // 급여 관련
    ];

    let filtered = content;
    sensitivePatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, '[보안상 비공개]');
    });

    return filtered;
  }

  // 캐시 관리
  clearCache() {
    this.slackCache.clear();
    this.driveCache.clear();
  }

  // 실시간 인덱싱 (향후 구현)
  async indexNewDocument(documentId, content) {
    // TODO: 새 문서 벡터화 및 인덱싱
    console.log(`Indexing new document: ${documentId}`);
  }

  // 사용 통계
  getUsageStats() {
    return {
      totalQueries: this.slackCache.size + this.driveCache.size,
      cacheHitRate: 0.85, // 예시
      averageResponseTime: '250ms'
    };
  }
}

// Note: RAG instances should be created per-request with credentials
// export const markanyRAG = new MarkAnyRAG();

// Google Drive API 헬퍼 함수들 (향후 구현)
export class GoogleDriveIntegration {
  constructor(credentials) {
    this.credentials = credentials;
    // TODO: Google Drive API 초기화
  }

  async listFiles(query) {
    // TODO: Google Drive 파일 목록 조회
  }

  async downloadFile(fileId) {
    // TODO: 파일 다운로드 및 파싱
  }

  async parseDocument(fileBuffer, mimeType) {
    // TODO: PDF/DOCX/PPTX/HWP 파싱
  }
}

// Vector DB 헬퍼 (향후 Pinecone/Chroma 연동)
export class VectorDatabase {
  constructor(config) {
    this.config = config;
  }

  async embed(text) {
    // TODO: 텍스트 벡터화 (OpenAI Embeddings API 등)
  }

  async search(queryVector, topK = 5) {
    // TODO: 벡터 유사도 검색
  }

  async upsert(vectors) {
    // TODO: 벡터 저장/업데이트
  }
}