// MarkAny Google Drive Document Parser
// PDF, DOCX, PPTX, HWP 파일 파싱 및 벡터화

import { google } from 'googleapis';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { parse } from 'node-html-parser';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export class DriveDocumentParser {
  constructor() {
    this.supportedMimeTypes = {
      'application/pdf': 'pdf',
      'application/vnd.google-apps.document': 'gdoc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'text/plain': 'txt',
      'text/html': 'html'
    };
  }

  // 파일 내용 추출 메인 함수
  async extractContent(fileBuffer, mimeType, fileName = '') {
    try {
      const fileType = this.supportedMimeTypes[mimeType];
      
      switch (fileType) {
        case 'pdf':
          return await this.parsePDF(fileBuffer);
        case 'docx':
          return await this.parseDOCX(fileBuffer);
        case 'txt':
          return fileBuffer.toString('utf-8');
        case 'html':
          return this.parseHTML(fileBuffer.toString('utf-8'));
        case 'gdoc':
          // Google Docs는 이미 텍스트로 export됨
          return fileBuffer.toString('utf-8');
        default:
          console.warn(`지원되지 않는 파일 형식: ${mimeType}`);
          return '';
      }
    } catch (error) {
      console.error(`파일 파싱 오류 (${fileName}):`, error);
      return '';
    }
  }

  // PDF 파싱
  async parsePDF(buffer) {
    try {
      const data = await pdfParse(buffer);
      return this.cleanText(data.text);
    } catch (error) {
      console.error('PDF 파싱 오류:', error);
      return '';
    }
  }

  // DOCX 파싱
  async parseDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return this.cleanText(result.value);
    } catch (error) {
      console.error('DOCX 파싱 오류:', error);
      return '';
    }
  }

  // HTML 파싱
  parseHTML(htmlContent) {
    try {
      const root = parse(htmlContent);
      const textContent = root.text;
      return this.cleanText(textContent);
    } catch (error) {
      console.error('HTML 파싱 오류:', error);
      return '';
    }
  }

  // 텍스트 정리 및 정규화
  cleanText(text) {
    if (!text) return '';
    
    return text
      // 연속된 공백 제거
      .replace(/\s+/g, ' ')
      // 연속된 줄바꿈 제거
      .replace(/\n\s*\n/g, '\n')
      // 특수 문자 정리
      .replace(/[^\w\s가-힣.,!?-]/g, ' ')
      // 앞뒤 공백 제거
      .trim();
  }

  // 문서를 청크로 분할
  splitIntoChunks(text, maxChunkSize = 1000, overlap = 100) {
    if (!text || text.length <= maxChunkSize) {
      return [text];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + maxChunkSize;
      
      // 문장 경계에서 자르기
      if (end < text.length) {
        const lastSentenceEnd = text.lastIndexOf('.', end);
        const lastNewline = text.lastIndexOf('\n', end);
        const cutPoint = Math.max(lastSentenceEnd, lastNewline);
        
        if (cutPoint > start + maxChunkSize * 0.5) {
          end = cutPoint + 1;
        }
      }

      chunks.push(text.slice(start, end).trim());
      start = end - overlap;
    }

    return chunks.filter(chunk => chunk.length > 50); // 너무 짧은 청크 제외
  }

  // 텍스트 임베딩 생성 (Gemini 사용)
  async generateEmbedding(text) {
    try {
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('임베딩 생성 오류:', error);
      // 간단한 해시 기반 벡터 (fallback)
      return this.simpleTextVector(text);
    }
  }

  // 간단한 텍스트 벡터화 (fallback)
  simpleTextVector(text, dimensions = 384) {
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(dimensions).fill(0);
    
    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      vector[hash % dimensions] += 1;
    });
    
    // 정규화
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }

  // 간단한 해시 함수
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32비트 정수로 변환
    }
    return Math.abs(hash);
  }

  // 문서 메타데이터 추출
  extractMetadata(content, fileName = '') {
    const metadata = {
      fileName,
      wordCount: content.split(/\s+/).length,
      charCount: content.length,
      language: this.detectLanguage(content),
      topics: this.extractTopics(content),
      sensitivity: this.assessSensitivity(content)
    };

    return metadata;
  }

  // 언어 감지 (간단한 구현)
  detectLanguage(text) {
    const koreanPattern = /[가-힣]/g;
    const englishPattern = /[a-zA-Z]/g;
    
    const koreanMatches = (text.match(koreanPattern) || []).length;
    const englishMatches = (text.match(englishPattern) || []).length;
    
    if (koreanMatches > englishMatches) {
      return 'ko';
    } else if (englishMatches > 0) {
      return 'en';
    }
    return 'unknown';
  }

  // 주제 추출
  extractTopics(content) {
    const markanyTopics = {
      'DRM': ['drm', 'digital rights', '디지털 권한', '저작권'],
      'DLP': ['dlp', 'data loss prevention', '데이터 유출', '정보 보호'],
      'PrintSafer': ['printsafer', 'print security', '인쇄 보안', '워터마크'],
      'ScreenSafer': ['screensafer', 'screen capture', '화면 캡처', '스크린샷'],
      'AI Sentinel': ['ai sentinel', 'artificial intelligence', '인공지능', 'ai 보안']
    };

    const detectedTopics = [];
    const lowerContent = content.toLowerCase();

    Object.entries(markanyTopics).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => lowerContent.includes(keyword.toLowerCase()))) {
        detectedTopics.push(topic);
      }
    });

    return detectedTopics;
  }

  // 민감도 평가
  assessSensitivity(content) {
    const sensitivePatterns = [
      /confidential|기밀|비밀/i,
      /internal only|내부용/i,
      /proprietary|독점/i,
      /\b\d{3}-\d{4}-\d{4}\b/, // 전화번호
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/i // 이메일
    ];

    let sensitivityScore = 0;
    sensitivePatterns.forEach(pattern => {
      if (pattern.test(content)) {
        sensitivityScore += 1;
      }
    });

    if (sensitivityScore >= 3) return 'high';
    if (sensitivityScore >= 1) return 'medium';
    return 'low';
  }
}

// 전역 파서 인스턴스
export const driveParser = new DriveDocumentParser();