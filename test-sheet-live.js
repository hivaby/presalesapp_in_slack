// Test: Product Knowledge Bank - 전체 시트 통합 테스트
import { ProductKnowledgeBank } from './ai/product-knowledge-bank.js';

const kb = new ProductKnowledgeBank();
await kb.load('google-service-account.json');

console.log(`\n=== 로드 결과 ===`);
console.log(`제품: ${kb.products.length}개`);
console.log(`제어모듈: ${kb.controlModules.length}개`);
console.log(`제품모듈: ${kb.productModules.length}개`);
console.log(`담당자: ${kb.managers.length}명`);

// Test 1: 특수어플리케이션
console.log(`\n=== Test 1: "특수어플리케이션 종류" ===`);
const r1 = kb.search('특수어플리케이션 종류');
console.log(`제품: ${r1.products.length}개, 모듈: ${r1.modules.length}개`);
r1.modules.slice(0, 5).forEach(m => {
  console.log(`  [${m.appType}] ${m.appName} (${m.versions}) - ${m.developer}`);
});

// Test 2: CAD 지원
console.log(`\n=== Test 2: "CAD 지원범위" ===`);
const r2 = kb.search('CAD 지원범위');
console.log(`제품: ${r2.products.length}개, 모듈: ${r2.modules.length}개`);
r2.modules.slice(0, 5).forEach(m => {
  console.log(`  ${m.appName} (${m.versions}) - 확장자: ${(m.extensions || '').substring(0, 60)}...`);
});

// Test 3: 담당자
console.log(`\n=== Test 3: "DRM 담당자 누구" ===`);
const r3 = kb.search('DRM 담당자 누구');
console.log(`제품: ${r3.products.length}개, 모듈: ${r3.modules.length}개`);
console.log(r3.context.substring(0, 500));

// Test 4: AutoCAD
console.log(`\n=== Test 4: "AutoCAD 지원 버전" ===`);
const r4 = kb.search('AutoCAD 지원 버전');
console.log(`제품: ${r4.products.length}개, 모듈: ${r4.modules.length}개`);
r4.modules.forEach(m => {
  if (m.appName.includes('AutoCAD') || m.appName.includes('DWG')) {
    console.log(`  ${m.appName}: ${m.versions}`);
  }
});

// Test 5: SafePC 서버환경
console.log(`\n=== Test 5: "SafePC 서버환경" ===`);
const r5 = kb.search('SafePC 서버환경');
r5.products.forEach(p => {
  console.log(`  ${p.name}: ${p.serverEnv?.substring(0, 100)}`);
});

// Test 6: MINITAB 통계
console.log(`\n=== Test 6: "MINITAB 지원" ===`);
const r6 = kb.search('MINITAB 지원');
r6.modules.forEach(m => {
  if (m.appName.includes('MINITAB') || m.appName.includes('Minitab')) {
    console.log(`  ${m.appName} v${m.versions} - ${m.extensions?.substring(0, 60)}`);
  }
});

// Test 7: 서버 모듈 검색 (NEW)
console.log(`\n=== Test 7: "Document SAFER 서버 모듈" ===`);
const r7 = kb.search('Document SAFER 서버 모듈');
console.log(`제품: ${r7.products.length}개, 제어모듈: ${r7.modules.length}개, 제품모듈: ${r7.productModules.length}개`);
r7.productModules.slice(0, 5).forEach(m => {
  console.log(`  ${m.moduleName} - ${m.description} (${m.supportOS || 'N/A'})`);
});

// Test 8: 암복호화 데몬 빌드환경 (NEW)
console.log(`\n=== Test 8: "암복호화 데몬 빌드환경" ===`);
const r8 = kb.search('암복호화 데몬 빌드환경');
console.log(`제품모듈: ${r8.productModules.length}개`);
r8.productModules.slice(0, 3).forEach(m => {
  console.log(`  ${m.moduleName} (빌드: ${m.buildEnv}) - OS: ${m.supportOS}`);
});

// Test 9: 전체 컨텍스트 출력 (특수어플리케이션)
console.log(`\n=== Test 9: 전체 컨텍스트 (특수어플리케이션) ===`);
console.log(r1.context.substring(0, 2000));
