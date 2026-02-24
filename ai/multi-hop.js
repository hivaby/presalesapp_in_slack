// CHECK-inspired Multi-Hop Question Decomposition & Resolution
// Based on: Knowledge Editing for Multi-Hop QA Using Semantic Analysis
//
// Flow: Question → Decompose → Per-hop RAG retrieval → Edit Bank caching → Final synthesis

/**
 * Edit Bank - 지식 캐시
 * 이전 hop에서 해결된 sub-question 답변을 캐싱하여 중복 검색 방지
 */
class EditBank {
  constructor(ttlMs = 10 * 60 * 1000, maxSize = 500) {
    this.entries = new Map();
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    // 5분마다 만료 항목 자동 정리
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
    // Node.js 프로세스 종료를 막지 않도록 unref
    if (this._cleanupInterval.unref) this._cleanupInterval.unref();
  }

  _normalize(text) {
    return text.toLowerCase().replace(/[은는이가을를의에로으로\s?!.]/g, '').trim();
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.ts > this.ttlMs) {
        this.entries.delete(key);
      }
    }
  }

  get(subQuestion) {
    const key = this._normalize(subQuestion);
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.ts > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return entry;
  }

  set(subQuestion, answer, sources = []) {
    // 최대 크기 초과 시 가장 오래된 항목 제거 (LRU 방식)
    if (this.entries.size >= this.maxSize) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
    }
    const key = this._normalize(subQuestion);
    this.entries.set(key, { answer, sources, ts: Date.now() });
  }

  /**
   * 유사도 기반 검색 - 2단계: exact match → Jaccard similarity
   * 길이 기반 사전 필터링으로 불필요한 비교 최소화
   */
  findSimilar(subQuestion, threshold = 0.5) {
    const key = this._normalize(subQuestion);

    // 1단계: 정확 매칭 (O(1))
    const exact = this.entries.get(key);
    if (exact && Date.now() - exact.ts <= this.ttlMs) {
      return { ...exact, similarity: 1.0 };
    }

    // 2단계: 길이 기반 사전 필터링 후 Jaccard similarity
    const queryTokens = new Set(key.split(''));
    let bestMatch = null;
    let bestScore = 0;

    for (const [entryKey, entry] of this.entries) {
      if (Date.now() - entry.ts > this.ttlMs) continue;
      // 길이 차이가 50% 이상이면 스킵 (유사도 낮을 확률 높음)
      if (Math.abs(entryKey.length - key.length) > key.length * 0.5) continue;

      const entryTokens = new Set(entryKey.split(''));
      const intersection = [...queryTokens].filter(t => entryTokens.has(t)).length;
      const union = new Set([...queryTokens, ...entryTokens]).size;
      const score = union > 0 ? intersection / union : 0;

      if (score > bestScore && score >= threshold) {
        bestScore = score;
        bestMatch = { ...entry, similarity: score };
      }
    }
    return bestMatch;
  }

  clear() { this.entries.clear(); }
  get size() { return this.entries.size; }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.entries.clear();
  }
}

// Lazy-initialized Edit Bank (Cloudflare Workers prohibits setInterval at global scope)
let _editBank = null;
function getEditBank() {
  if (!_editBank) _editBank = new EditBank();
  return _editBank;
}
// Backward-compatible getter
const editBank = { get instance() { return getEditBank(); } };

/**
 * Multi-hop 질문인지 판별
 * 복합 질문 패턴: 여러 엔티티, 비교, 인과관계, 조건부 질문
 */
function isMultiHopQuestion(question) {
  const multiHopPatterns = [
    // 비교/관계 패턴
    /(.+)(와|과|랑|하고|그리고|및)\s*.+\s*(차이|비교|다른점|관계|연동|통합|연결)/,
    // 조건부 패턴
    /(.+)(하면|하고나서|한\s*후에?|다음에?|이후에?)\s*.+(어떻게|방법|설정|가능)/,
    // 인과 패턴
    /(.+)(때문에|원인|이유|왜)\s*.+(안되|오류|에러|문제|실패)/,
    // 다단계 절차
    /(설정|설치|구성|배포).+(후|다음|그리고).+(설정|설치|구성|연동)/,
    // 영어 multi-hop
    /how.+after.+/i,
    /what.+if.+then/i,
    /compare.+and.+/i,
    /difference.+between.+and/i,
    /(.+)\s+and\s+(.+)\s+(integration|setup|config)/i,
  ];

  // 2개 이상 제품 언급
  const products = ['drm', 'dlp', 'printsafer', 'screensafer', 'ai sentinel'];
  const mentionedProducts = products.filter(p => question.toLowerCase().includes(p));
  if (mentionedProducts.length >= 2) return true;

  return multiHopPatterns.some(p => p.test(question));
}

/**
 * 질문 분해 (Question Decomposition)
 * LLM을 사용하여 복합 질문을 논리적 sub-question 체인으로 분해
 */
async function decomposeQuestion(question, callLLM) {
  const prompt = `당신은 질문 분해 전문가입니다. 복합 질문을 논리적 순서의 하위 질문들로 분해해주세요.

규칙:
1. 각 하위 질문은 독립적으로 검색 가능해야 합니다
2. 이전 하위 질문의 답변이 다음 질문에 필요한 경우 순서를 지켜주세요
3. 최대 4개 이하로 분해해주세요
4. JSON 배열로만 응답해주세요

질문: "${question}"

응답 형식 (JSON만):
["하위 질문 1", "하위 질문 2", "하위 질문 3"]`;

  try {
    const result = await callLLM(prompt);
    // Extract JSON array from response
    const match = result.match(/\[[\s\S]*?\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        console.log(`[MultiHop] Decomposed into ${parsed.length} sub-questions`);
        return parsed.slice(0, 4); // max 4 hops
      }
    }
  } catch (e) {
    console.error('[MultiHop] Decomposition failed:', e.message);
  }

  // Fallback: 원본 질문 그대로 반환
  return [question];
}

/**
 * 엔티티 타입 분류 (Entity Type Extraction)
 * CHECK 논문의 Entity Linking → Type Extraction 단계
 * Product / Feature / Config / Person / General 로 분류
 */
function classifyEntityType(subQuestion) {
  const lower = subQuestion.toLowerCase();

  const productKeywords = ['drm', 'dlp', 'printsafer', 'screensafer', 'ai sentinel', '제품'];
  const featureKeywords = ['기능', '워터마크', '암호화', '캡처방지', '정책', 'feature', '추적'];
  const configKeywords = ['설정', '설치', '구성', '배포', '연동', 'config', 'setup', 'install'];
  const personKeywords = ['담당자', '팀', '조직', 'mcg', 'ps', 'mtg', 'sist', 'pist'];

  if (productKeywords.some(k => lower.includes(k))) return 'Product';
  if (featureKeywords.some(k => lower.includes(k))) return 'Feature';
  if (configKeywords.some(k => lower.includes(k))) return 'Config';
  if (personKeywords.some(k => lower.includes(k))) return 'Person';
  return 'General';
}

/**
 * Hop 해결 (Subquestion Resolution)
 * Edit Bank 확인 → RAG 검색 → LLM 답변 생성
 */
async function resolveHop(subQuestion, ragSearch, callLLM, previousHops = []) {
  // 1. Edit Bank에서 유사 답변 확인 (similarity >= threshold)
  const cached = getEditBank().findSimilar(subQuestion, 0.6);
  if (cached) {
    console.log(`[MultiHop] Edit Bank hit (similarity: ${cached.similarity.toFixed(2)}): "${subQuestion}"`);
    return { answer: cached.answer, sources: cached.sources, fromCache: true };
  }

  // 2. 엔티티 타입에 따른 검색 전략
  const entityType = classifyEntityType(subQuestion);
  console.log(`[MultiHop] Hop entity type: ${entityType} for "${subQuestion}"`);

  // 3. RAG 검색 수행
  const ragResults = await ragSearch(subQuestion);

  // 4. 이전 hop 컨텍스트 + RAG 결과로 LLM 답변 생성
  const previousContext = previousHops.length > 0
    ? `이전 단계 정보:\n${previousHops.map((h, i) => `${i + 1}. Q: ${h.question}\n   A: ${h.answer}`).join('\n')}\n\n`
    : '';

  const hopPrompt = `다음 질문에 대해 제공된 컨텍스트를 기반으로 간결하게 답변해주세요.

${previousContext}[검색된 컨텍스트]
${ragResults.context || '관련 문서를 찾지 못했습니다.'}

질문: ${subQuestion}

★ 핵심 규칙:
- 위 [검색된 컨텍스트]에 있는 정보만 사용하여 답변하세요.
- 컨텍스트에 명시적으로 나열되지 않은 어플리케이션, 기능, 지원 범위를 절대 추가하지 마세요.
- 일반적인 DRM/보안 지식으로 마크애니 제품의 구체적 지원 범위를 추측하지 마세요.
- 개발도구(IDE), 영상편집 등 컨텍스트에 없는 카테고리는 답변에 포함하지 마세요.
- 정보가 부족하면 "해당 정보가 지식뱅크에 없습니다"라고 명시하세요.`;

  const answer = await callLLM(hopPrompt);

  // 5. Edit Bank에 저장
  const sources = [...(ragResults.documents || []), ...(ragResults.slackMessages || [])];
  getEditBank().set(subQuestion, answer, sources);

  return { answer, sources, fromCache: false, entityType };
}

/**
 * Multi-Hop 질의응답 메인 함수
 * CHECK 논문의 전체 파이프라인 구현
 *
 * @param {string} question - 사용자 질문
 * @param {Function} ragSearch - RAG 검색 함수 (query) => ragResults
 * @param {Function} callLLM - LLM 호출 함수 (prompt) => string
 * @returns {{ answer: string, sources: Array, hops: Array, isMultiHop: boolean }}
 */
export async function multiHopQA(question, ragSearch, callLLM) {
  const isComplex = isMultiHopQuestion(question);

  // 단순 질문은 기존 파이프라인 사용
  if (!isComplex) {
    console.log('[MultiHop] Simple question, using single-hop');
    const ragResults = await ragSearch(question);
    return {
      context: ragResults.context,
      documents: ragResults.documents || [],
      slackMessages: ragResults.slackMessages || [],
      confluence: ragResults.confluence || [],
      jira: ragResults.jira || [],
      hops: [],
      isMultiHop: false
    };
  }

  console.log(`[MultiHop] Complex question detected, decomposing...`);

  // 1. 질문 분해
  const subQuestions = await decomposeQuestion(question, callLLM);
  console.log(`[MultiHop] Sub-questions:`, subQuestions);

  // 2. 각 hop 순차 해결 (이전 hop 결과가 다음에 필요할 수 있으므로)
  const hops = [];
  const allSources = [];

  for (const subQ of subQuestions) {
    const hopResult = await resolveHop(subQ, ragSearch, callLLM, hops);
    hops.push({
      question: subQ,
      answer: hopResult.answer,
      entityType: hopResult.entityType || 'General',
      fromCache: hopResult.fromCache || false
    });
    allSources.push(...(hopResult.sources || []));
  }

  // 3. 최종 합성 (Final Answer Synthesis)
  const synthesisPrompt = `다음은 복합 질문에 대한 단계별 분석 결과입니다. 이를 종합하여 최종 답변을 작성해주세요.

★★★ 가장 중요한 규칙 ★★★
- 각 단계의 분석 결과에 포함된 정보만 사용하세요.
- 분석 결과에 없는 제품 기능, 지원 범위, 어플리케이션을 절대 추측하거나 추가하지 마세요.
- 개발도구(IDE: Visual Studio, Eclipse, IntelliJ 등), 영상편집 소프트웨어 등 분석 결과에 없는 카테고리는 답변에 포함하지 마세요.
- 일반적인 DRM/보안 업계 지식으로 마크애니 제품의 구체적 지원 범위를 추측하지 마세요.
- 정보가 부족한 영역은 "해당 정보는 현재 지식뱅크에 없습니다"라고 명시하세요.

원래 질문: "${question}"

단계별 분석:
${hops.map((h, i) => `[${i + 1}단계] ${h.question}\n답변: ${h.answer}`).join('\n\n')}

위 분석을 종합하여 원래 질문에 대한 완전한 답변을 작성해주세요.
- 각 단계의 핵심 내용을 연결하여 일관된 답변을 만들어주세요
- 분석 결과에 없는 정보는 절대 추가하지 마세요
- 출처가 있는 경우 포함해주세요
- 한국어 질문에는 한국어로 답변해주세요`;

  const finalAnswer = await callLLM(synthesisPrompt);

  // 4. 소스 중복 제거
  const uniqueSources = deduplicateSources(allSources);

  return {
    context: '', // multi-hop은 자체 합성 답변 사용
    synthesizedAnswer: finalAnswer,
    documents: uniqueSources.filter(s => s.type === 'drive_document'),
    slackMessages: uniqueSources.filter(s => s.type === 'slack_message'),
    confluence: uniqueSources.filter(s => s.type === 'confluence'),
    jira: uniqueSources.filter(s => s.type === 'jira'),
    hops,
    isMultiHop: true
  };
}

function deduplicateSources(sources) {
  const seen = new Set();
  return sources.filter(s => {
    const key = s.url || s.permalink || s.id || s.title;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Export for testing / direct use
export { getEditBank as editBank, isMultiHopQuestion, EditBank };
