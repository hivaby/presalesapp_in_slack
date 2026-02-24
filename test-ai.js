import 'dotenv/config';
import { runAI, formatResponse } from './ai/index.js';
import { MarkAnyRAG } from './ai/rag.js';

// 테스트 질문
const testQuery = "DRM 지원 가능한 특수어플리케이션 종류를 정리해줘";

console.log('🧪 MarkAny AI Assistant 테스트 시작\n');
console.log(`📝 질문: ${testQuery}\n`);

// RAG 검색 (모의 데이터 사용)
const rag = new MarkAnyRAG();

// 모의 RAG 컨텍스트 생성
const mockContext = `
관련 문서 (Google Drive):
- [PDF] DRM 특수 어플리케이션 지원 가이드
  내용: MarkAny DRM은 다양한 특수 어플리케이션을 지원합니다.
  
  1. CAD/CAM 프로그램
     - AutoCAD (2D/3D 도면)
     - SolidWorks (3D 설계)
     - CATIA (항공/자동차 설계)
  
  2. 그래픽 디자인 툴
     - Adobe Photoshop (이미지 편집)
     - Adobe Illustrator (벡터 그래픽)
     - CorelDRAW (그래픽 디자인)
  
  3. 영상 편집 프로그램
     - Adobe Premiere Pro
     - Final Cut Pro
     - DaVinci Resolve
  
  4. 개발 도구
     - Visual Studio (IDE)
     - Eclipse (Java IDE)
     - IntelliJ IDEA
  
  5. 데이터베이스 툴
     - Oracle SQL Developer
     - MySQL Workbench
     - Microsoft SQL Server Management Studio
  
  6. 의료 영상 뷰어
     - PACS Viewer
     - DICOM Viewer
  
  7. 건축/건설 BIM
     - Revit
     - ArchiCAD
     - Tekla Structures
  
  (출처: https://drive.google.com/file/d/example123)

관련 Slack 대화:
- [tech-drm] "DRM 특수 어플리케이션 지원은 화이트리스트 방식으로 관리됩니다. 고객사 요청 시 추가 가능합니다."
  (링크: https://markany.slack.com/archives/C123/p1234567890)

[MARKANY_PRODUCT_INFO]
DRM: 디지털 권한 관리 솔루션, 문서 보안 및 암호화
`;

async function test() {
  try {
    console.log('🔍 RAG 검색 중...\n');
    
    // AI 실행
    console.log('🤖 Gemini AI 응답 생성 중...\n');
    const response = await runAI(testQuery, mockContext, '', process.env.GEMINI_API_KEY);
    
    console.log('✅ AI 응답:\n');
    console.log('─'.repeat(80));
    console.log(response);
    console.log('─'.repeat(80));
    
    // 출처 포함 포맷팅
    const sources = [
      {
        type: 'drive_document',
        title: 'DRM 특수 어플리케이션 지원 가이드',
        url: 'https://drive.google.com/file/d/example123'
      },
      {
        type: 'slack_message',
        channel: 'tech-drm',
        permalink: 'https://markany.slack.com/archives/C123/p1234567890'
      }
    ];
    
    const formattedResponse = formatResponse(response, sources);
    
    console.log('\n📄 출처 포함 최종 응답:\n');
    console.log('─'.repeat(80));
    console.log(formattedResponse);
    console.log('─'.repeat(80));
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
    console.error('상세 오류:', error.stack);
  }
}

test();
