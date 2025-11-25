// MarkAny Google Drive RAG Integration
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

export class GoogleDriveRAG {
  constructor() {
    this.drive = null;
    this.auth = null;
    this.initialized = false;
  }

  // Google Drive API 초기화
  async initialize() {
    if (this.initialized) return;

    try {
      // Service Account 또는 OAuth2 인증
      // 환경변수에서 credentials 로드
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
      } else if (process.env.GOOGLE_CREDENTIALS_PATH) {
        this.auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
          scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
      } else {
        console.warn('Google Drive credentials not configured. RAG will use mock data.');
        return;
      }

      this.drive = google.drive({ version: 'v3', auth: this.auth });
      this.initialized = true;
      console.log('✅ Google Drive RAG initialized');
    } catch (error) {
      console.error('Google Drive initialization error:', error);
    }
  }

  // 파일 검색
  async searchFiles(query, limit = 10) {
    await this.initialize();

    if (!this.drive) {
      return this.getMockResults(query);
    }

    try {
      const response = await this.drive.files.list({
        q: `fullText contains '${query}' and trashed=false`,
        fields: 'files(id, name, mimeType, webViewLink, modifiedTime, owners)',
        pageSize: limit,
        orderBy: 'modifiedTime desc',
      });

      return response.data.files.map(file => ({
        id: file.id,
        title: file.name,
        url: file.webViewLink,
        mimeType: file.mimeType,
        modifiedTime: file.modifiedTime,
        type: 'drive_document',
        score: 0.85,
      }));
    } catch (error) {
      console.error('Drive search error:', error);
      return [];
    }
  }

  // 파일 내용 추출
  async extractFileContent(fileId, mimeType) {
    await this.initialize();

    if (!this.drive) return '';

    try {
      // Google Docs/Sheets/Slides는 export로 텍스트 추출
      if (mimeType.includes('google-apps')) {
        const response = await this.drive.files.export({
          fileId: fileId,
          mimeType: 'text/plain',
        });
        return response.data;
      }

      // 일반 파일은 직접 다운로드
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      return response.data;
    } catch (error) {
      console.error('File content extraction error:', error);
      return '';
    }
  }

  // Mock 데이터 (테스트용)
  getMockResults(query) {
    const mockDocs = [
      {
        id: 'mock1',
        title: 'MarkAny DRM 제품 가이드 v2.0',
        url: 'https://drive.google.com/file/d/mock1',
        snippet: 'MarkAny DRM은 디지털 콘텐츠 보호를 위한 엔터프라이즈급 솔루션입니다. 문서, 이미지, 동영상 등 다양한 포맷을 지원하며...',
        mimeType: 'application/pdf',
        type: 'drive_document',
        score: 0.95,
      },
      {
        id: 'mock2',
        title: 'DLP 솔루션 기술 명세서',
        url: 'https://drive.google.com/file/d/mock2',
        snippet: 'Data Loss Prevention 솔루션은 기업의 중요 정보 유출을 방지합니다. 네트워크, 엔드포인트, 클라우드 전 영역을 커버...',
        mimeType: 'application/vnd.google-apps.document',
        type: 'drive_document',
        score: 0.88,
      },
      {
        id: 'mock3',
        title: 'PrintSafer 설치 및 운영 가이드',
        url: 'https://drive.google.com/file/d/mock3',
        snippet: 'PrintSafer는 인쇄 보안 솔루션으로 워터마크, 인쇄 로그, 인쇄 제어 기능을 제공합니다...',
        mimeType: 'application/pdf',
        type: 'drive_document',
        score: 0.82,
      },
    ];

    // 간단한 키워드 매칭
    const keywords = query.toLowerCase().split(' ');
    return mockDocs.filter(doc => 
      keywords.some(kw => 
        doc.title.toLowerCase().includes(kw) || 
        doc.snippet.toLowerCase().includes(kw)
      )
    );
  }

  // 벡터 임베딩 생성 (향후 Gemini Embedding API 사용)
  async createEmbedding(text) {
    // TODO: Gemini Embedding API 연동
    // const model = genAI.getGenerativeModel({ model: "embedding-001" });
    // const result = await model.embedContent(text);
    // return result.embedding.values;
    
    return Array(768).fill(0).map(() => Math.random());
  }

  // 유사도 검색
  async semanticSearch(query, documents) {
    const queryEmbedding = await this.createEmbedding(query);
    
    const results = documents.map(doc => ({
      ...doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding || []),
    }));

    return results.sort((a, b) => b.score - a.score);
  }

  // 코사인 유사도 계산
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;
    
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
}

export const googleDriveRAG = new GoogleDriveRAG();
