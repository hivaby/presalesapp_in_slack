// Test Script: Product Knowledge Bank + Multi-Hop Detection
// 100개 쿼리로 지식뱅크 검색 정확도 및 multi-hop 감지 테스트

import { ProductKnowledgeBank } from './ai/product-knowledge-bank.js';
import { isMultiHopQuestion } from './ai/multi-hop.js';

const kb = new ProductKnowledgeBank();

// ============================================================
// 100 Test Queries - 실제 사용자가 물어볼 법한 질문들
// ============================================================
const TEST_QUERIES = [
  // === DRM 제품군 (1-20) ===
  { q: "Document SAFER 최신 버전이 뭐야?", expect: "Document SAFER", category: "DRM" },
  { q: "문서보안 서버 환경 알려줘", expect: "Document SAFER", category: "DRM" },
  { q: "Privacy SAFER 지원 OS는?", expect: "Privacy SAFER", category: "DRM" },
  { q: "Print SAFER 버전 정보", expect: "Print SAFER", category: "DRM" },
  { q: "Screen SAFER 매뉴얼 어디있어?", expect: "Screen SAFER", category: "DRM" },
  { q: "Web SAFER 브라우저 지원 범위", expect: "Web SAFER", category: "DRM" },
  { q: "Cowork SAFER DB 뭐 쓰나요?", expect: "Cowork SAFER", category: "DRM" },
  { q: "Mobile DOCS 최소 안드로이드 버전", expect: "Mobile DOCS", category: "DRM" },
  { q: "Mobile SAFER iOS 지원 버전", expect: "Mobile SAFER", category: "DRM" },
  { q: "MACRYPTO KCMVP 인증 버전", expect: "MACRYPTO", category: "DRM" },
  { q: "ES SAFER 제품 매뉴얼", expect: "ES SAFER", category: "DRM" },
  { q: "인쇄보안 솔루션 버전 알려줘", expect: "Print SAFER", category: "DRM" },
  { q: "화면캡처 방지 제품 스펙", expect: "Screen SAFER", category: "DRM" },
  { q: "DRM 서버에 톰캣 버전 뭐 써야해?", expect: "Document SAFER", category: "DRM" },
  { q: "Document SAFER Green 버전이랑 Blue3 차이", expect: "Document SAFER", category: "DRM" },
  { q: "웹DRM 크롬 지원되나요?", expect: "Web SAFER", category: "DRM" },
  { q: "모바일 스티커 앱 최소 사양", expect: "Mobile STICKER", category: "DRM" },
  { q: "Mobile Capture SAFER 아이폰 지원?", expect: "Mobile Capture SAFER", category: "DRM" },
  { q: "Print TRACER가 뭐야?", expect: "Print TRACER", category: "DRM" },
  { q: "Screen TRACER MAC 지원되나?", expect: "Screen TRACER", category: "DRM" },

  // === DLP 제품군 (21-35) ===
  { q: "SafePC Enterprise 서버 환경", expect: "SafePC Enterprise", category: "DLP" },
  { q: "SafePC 최신 버전 뭐야?", expect: "SafePC Enterprise", category: "DLP" },
  { q: "DLP 솔루션 Windows 11 지원?", expect: "SafePC Enterprise", category: "DLP" },
  { q: "SafeUSB 버전 정보 알려줘", expect: "SafeUSB", category: "DLP" },
  { q: "데이터유출방지 제품 DB 뭐 쓰나?", expect: "SafePC Enterprise", category: "DLP" },
  { q: "SafePC 브라우저 지원 범위", expect: "SafePC Enterprise", category: "DLP" },
  { q: "USB 보안 솔루션 있어?", expect: "SafeUSB", category: "DLP" },
  { q: "정보유출 방지 제품 스펙", expect: "SafePC Enterprise", category: "DLP" },
  { q: "SafePC JDK 버전", expect: "SafePC Enterprise", category: "DLP" },
  { q: "DLP 제품 매뉴얼 어디서 봐?", expect: "SafePC Enterprise", category: "DLP" },
  { q: "SafeUSB 윈도우10 32비트 지원?", expect: "SafeUSB", category: "DLP" },
  { q: "SafePC MariaDB 버전", expect: "SafePC Enterprise", category: "DLP" },
  { q: "DLP 사전환경 조사서", expect: "SafePC Enterprise", category: "DLP" },
  { q: "SafePC Rocky Linux 지원?", expect: "SafePC Enterprise", category: "DLP" },
  { q: "SecuPrint 기능 아직 되나?", expect: "SafePC Enterprise", category: "DLP" },

  // === 응용보안 제품군 (36-45) ===
  { q: "ePage SAFER 서버 환경", expect: "ePage SAFER", category: "응용보안" },
  { q: "전자문서 보안 솔루션 브라우저 지원", expect: "ePage SAFER", category: "응용보안" },
  { q: "ePage SAFER Mac 지원되나?", expect: "ePage SAFER", category: "응용보안" },
  { q: "ePageSAFER JDK 최소 버전", expect: "ePage SAFER", category: "응용보안" },
  { q: "ePage SAFER 리포트 연동 가능?", expect: "ePage SAFER", category: "응용보안" },
  { q: "ePage SAFER AIX 지원?", expect: "ePage SAFER", category: "응용보안" },
  { q: "ePage SAFER PDF 연동", expect: "ePage SAFER", category: "응용보안" },
  { q: "ePageSAFER 매뉴얼", expect: "ePage SAFER", category: "응용보안" },
  { q: "ePage SAFER 리눅스 지원 범위", expect: "ePage SAFER", category: "응용보안" },
  { q: "ePage SAFER Whale 브라우저 되나?", expect: "ePage SAFER", category: "응용보안" },

  // === TRACER 제품군 (46-55) ===
  { q: "TRACER SDK for Screen 지원 OS", expect: "TRACER SDK for Screen", category: "TRACER" },
  { q: "TRACER 출력보호 제품", expect: "TRACER SDK for Print", category: "TRACER" },
  { q: "TRACER 웹 버전 브라우저 지원", expect: "TRACER SDK for Web", category: "TRACER" },
  { q: "TRACER 모바일 SDK 최소 사양", expect: "TRACER SDK for Mobile", category: "TRACER" },
  { q: "화면보호 SDK 있어?", expect: "TRACER SDK for Screen", category: "TRACER" },
  { q: "TRACER Print 서버 환경", expect: "TRACER SDK for Print", category: "TRACER" },
  { q: "트레이서 SDK 종류 알려줘", expect: "TRACER", category: "TRACER" },
  { q: "TRACER Screen Mac 지원?", expect: "TRACER SDK for Screen", category: "TRACER" },
  { q: "TRACER Web 서버사이드인가?", expect: "TRACER SDK for Web", category: "TRACER" },
  { q: "TRACER Mobile iOS 최소 버전", expect: "TRACER SDK for Mobile", category: "TRACER" },

  // === 크로스 제품 / 일반 질문 (56-75) ===
  { q: "MarkAny 전체 제품 목록", expect: null, category: "general" },
  { q: "DRM 제품군에 뭐가 있어?", expect: "Document SAFER", category: "DRM" },
  { q: "모바일 관련 제품 전부 알려줘", expect: "Mobile", category: "DRM" },
  { q: "Windows 11 지원하는 제품 목록", expect: null, category: "general" },
  { q: "Linux 서버에 설치 가능한 제품", expect: null, category: "general" },
  { q: "Oracle DB 쓰는 제품이 뭐야?", expect: null, category: "general" },
  { q: "톰캣 9 지원하는 제품", expect: null, category: "general" },
  { q: "Mac 지원되는 제품 있어?", expect: "Screen TRACER", category: "general" },
  { q: "크롬 브라우저 지원 제품", expect: "Web SAFER", category: "general" },
  { q: "JDK 1.8 쓰는 제품", expect: "Document SAFER", category: "general" },
  { q: "기능명세서 있는 제품 목록", expect: null, category: "general" },
  { q: "사전환경 조사서 양식 어디있어?", expect: null, category: "general" },
  { q: "HW 스펙 문서 어디서 봐?", expect: null, category: "general" },
  { q: "제품 매뉴얼 전체 목록", expect: null, category: "general" },
  { q: "Android 7 이상 지원 모바일 제품", expect: "Mobile", category: "general" },
  { q: "iOS 14 이상 필요한 제품", expect: "Mobile", category: "general" },
  { q: "서버 DRM이 뭐야?", expect: "Document SAFER", category: "DRM" },
  { q: "JAVA 인터페이스 연동 가능한 제품", expect: "Document SAFER", category: "DRM" },
  { q: "Nexacro 연동 가능한 제품", expect: "ePage SAFER", category: "응용보안" },
  { q: "ClipReport 연동 되는 제품", expect: "ePage SAFER", category: "응용보안" },

  // === Multi-Hop 질문 (76-90) ===
  { q: "Document SAFER와 Print SAFER 연동 방법", expect: "Document SAFER", category: "multi-hop", multiHop: true },
  { q: "DRM 설정 후 DLP 정책 연동하는 방법", expect: null, category: "multi-hop", multiHop: true },
  { q: "SafePC와 Document SAFER 차이점", expect: "SafePC Enterprise", category: "multi-hop", multiHop: true },
  { q: "Screen SAFER 설치하고 TRACER 연동하려면?", expect: "Screen SAFER", category: "multi-hop", multiHop: true },
  { q: "DRM 서버 구축 후 모바일 연동 절차", expect: "Document SAFER", category: "multi-hop", multiHop: true },
  { q: "Print SAFER 워터마크 설정하고 TRACER로 추적하는 방법", expect: "Print SAFER", category: "multi-hop", multiHop: true },
  { q: "ePage SAFER와 Web SAFER 비교", expect: "ePage SAFER", category: "multi-hop", multiHop: true },
  { q: "SafePC Enterprise 설치 후 SafeUSB 연동", expect: "SafePC Enterprise", category: "multi-hop", multiHop: true },
  { q: "Document SAFER Green에서 Blue3로 마이그레이션하면 서버 환경 바꿔야해?", expect: "Document SAFER", category: "multi-hop", multiHop: true },
  { q: "DRM 암호화 적용 후 DLP에서 유출 방지 정책 설정하는 순서", expect: null, category: "multi-hop", multiHop: true },
  { q: "Mobile SAFER 설치하고 Document SAFER 서버랑 연결하는 방법", expect: "Mobile SAFER", category: "multi-hop", multiHop: true },
  { q: "Screen SAFER와 Screen TRACER 차이가 뭐야?", expect: "Screen SAFER", category: "multi-hop", multiHop: true },
  { q: "Print SAFER 비가시성 기능이랑 Print TRACER 관계", expect: "Print TRACER", category: "multi-hop", multiHop: true },
  { q: "Cowork SAFER 설정하고 Document SAFER 연동하는 방법", expect: "Cowork SAFER", category: "multi-hop", multiHop: true },
  { q: "compare SafePC and Document SAFER features", expect: "SafePC Enterprise", category: "multi-hop", multiHop: true },

  // === Edge Cases / 오타 / 약어 (91-100) ===
  { q: "docsafer 버전", expect: "Document SAFER", category: "edge" },
  { q: "printsafer 스펙", expect: "Print SAFER", category: "edge" },
  { q: "screensafer mac", expect: "Screen SAFER", category: "edge" },
  { q: "safepc 윈도우11", expect: "SafePC Enterprise", category: "edge" },
  { q: "날씨 알려줘", expect: null, category: "irrelevant" },
  { q: "점심 뭐 먹을까?", expect: null, category: "irrelevant" },
  { q: "DRM", expect: "Document SAFER", category: "edge" },
  { q: "DLP", expect: "SafePC Enterprise", category: "edge" },
  { q: "암호모듈 인증", expect: "MACRYPTO", category: "edge" },
  { q: "협업 보안 솔루션", expect: "Cowork SAFER", category: "edge" },
];

// ============================================================
// Test Runner
// ============================================================
async function runTests() {
  console.log('='.repeat(70));
  console.log('  Product Knowledge Bank + Multi-Hop Test Suite');
  console.log('  Total queries:', TEST_QUERIES.length);
  console.log('='.repeat(70));

  // Load knowledge bank (uses embedded fallback)
  await kb.load();
  console.log(`\nLoaded ${kb.products.length} products\n`);

  const results = {
    total: TEST_QUERIES.length,
    kbHit: 0,        // 지식뱅크에서 결과 찾음
    kbMiss: 0,       // 지식뱅크에서 결과 못찾음
    kbCorrect: 0,    // 기대한 제품을 찾음
    kbWrong: 0,      // 다른 제품을 찾음
    multiHopCorrect: 0,
    multiHopWrong: 0,
    multiHopTotal: 0,
    irrelevantCorrect: 0, // 관련없는 질문에 결과 없음
    byCategory: {},
    failures: [],
    timings: []
  };

  for (let i = 0; i < TEST_QUERIES.length; i++) {
    const { q, expect: expected, category, multiHop } = TEST_QUERIES[i];
    const num = String(i + 1).padStart(3, '0');

    // Category tracking
    if (!results.byCategory[category]) {
      results.byCategory[category] = { total: 0, hit: 0, correct: 0 };
    }
    results.byCategory[category].total++;

    // Test 1: Knowledge Bank search
    const start = performance.now();
    const kbResult = kb.search(q, 3);
    const elapsed = performance.now() - start;
    results.timings.push(elapsed);

    const topProduct = kbResult.products[0]?.name || null;
    const hasResults = kbResult.products.length > 0;

    if (hasResults) {
      results.kbHit++;
      results.byCategory[category].hit++;
    } else {
      results.kbMiss++;
    }

    // Check correctness
    let correct = false;
    if (expected === null) {
      // For general/irrelevant queries, any result or no result is OK
      if (category === 'irrelevant') {
        correct = !hasResults;
        if (correct) results.irrelevantCorrect++;
      } else {
        correct = true; // general queries - we just want some results
      }
    } else {
      // Check if expected product is in top results
      correct = kbResult.products.some(p =>
        p.name.toLowerCase().includes(expected.toLowerCase())
      );
    }

    if (correct) {
      results.kbCorrect++;
      results.byCategory[category].correct++;
    } else {
      results.kbWrong++;
      results.failures.push({
        num: i + 1,
        query: q,
        expected,
        got: topProduct,
        category,
        score: kbResult.products[0]?.score || 0
      });
    }

    // Test 2: Multi-hop detection
    if (multiHop !== undefined) {
      results.multiHopTotal++;
      const detected = isMultiHopQuestion(q);
      if (detected === multiHop) {
        results.multiHopCorrect++;
      } else {
        results.multiHopWrong++;
        results.failures.push({
          num: i + 1,
          query: q,
          type: 'multi-hop',
          expected: multiHop,
          got: detected
        });
      }
    }

    // Progress indicator
    const status = correct ? '✅' : '❌';
    const multiHopStatus = multiHop !== undefined
      ? (isMultiHopQuestion(q) === multiHop ? ' 🔗✅' : ' 🔗❌')
      : '';
    const resultStr = topProduct ? `→ ${topProduct} (score:${kbResult.products[0]?.score})` : '→ (no match)';

    console.log(`[${num}] ${status}${multiHopStatus} ${q.substring(0, 45).padEnd(45)} ${resultStr}`);
  }

  // ============================================================
  // Analysis Report
  // ============================================================
  const avgTime = results.timings.reduce((a, b) => a + b, 0) / results.timings.length;
  const maxTime = Math.max(...results.timings);
  const p95Time = results.timings.sort((a, b) => a - b)[Math.floor(results.timings.length * 0.95)];

  console.log('\n' + '='.repeat(70));
  console.log('  ANALYSIS REPORT');
  console.log('='.repeat(70));

  console.log('\n📊 Overall Results:');
  console.log(`  Total queries:     ${results.total}`);
  console.log(`  KB Hit rate:       ${results.kbHit}/${results.total} (${(results.kbHit/results.total*100).toFixed(1)}%)`);
  console.log(`  Accuracy:          ${results.kbCorrect}/${results.total} (${(results.kbCorrect/results.total*100).toFixed(1)}%)`);
  console.log(`  Failures:          ${results.kbWrong}`);

  console.log('\n🔗 Multi-Hop Detection:');
  console.log(`  Total tested:      ${results.multiHopTotal}`);
  console.log(`  Correct:           ${results.multiHopCorrect}/${results.multiHopTotal} (${(results.multiHopCorrect/results.multiHopTotal*100).toFixed(1)}%)`);

  console.log('\n⏱️  Performance:');
  console.log(`  Avg search time:   ${avgTime.toFixed(3)}ms`);
  console.log(`  P95 search time:   ${p95Time.toFixed(3)}ms`);
  console.log(`  Max search time:   ${maxTime.toFixed(3)}ms`);

  console.log('\n📁 By Category:');
  for (const [cat, stats] of Object.entries(results.byCategory)) {
    const pct = (stats.correct / stats.total * 100).toFixed(1);
    console.log(`  ${cat.padEnd(15)} ${stats.correct}/${stats.total} correct (${pct}%) | ${stats.hit}/${stats.total} hit`);
  }

  if (results.failures.length > 0) {
    console.log('\n❌ Failures:');
    for (const f of results.failures) {
      if (f.type === 'multi-hop') {
        console.log(`  [${f.num}] Multi-hop: "${f.query}" expected=${f.expected} got=${f.got}`);
      } else {
        console.log(`  [${f.num}] "${f.query}" expected="${f.expected}" got="${f.got}" (score:${f.score})`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('  TEST COMPLETE');
  console.log('='.repeat(70));
}

runTests().catch(console.error);
