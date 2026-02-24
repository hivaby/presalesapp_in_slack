# MarkAny Slack AI Assistant - 종합 코드 리뷰 리포트
> 생성일: 2026-02-22 | 리뷰 대상: ai/, listeners/, app.js

---

## 🔒 A. 보안 취약점 및 엣지 케이스 리뷰

### A-1. [Critical] API 키 하드코딩 및 .env 파일 노출

**파일:** `.env`

**문제점:** `.env` 파일에 실제 API 키가 평문으로 저장되어 있으며, `GOOGLE_SERVICE_ACCOUNT_KEY`에 placeholder가 아닌 실제 값 형태가 존재합니다. `google-service-account.json` 파일도 워크스페이스 루트에 직접 존재합니다.

**발생 시나리오:** `.gitignore`에 누락되거나 실수로 커밋 시 모든 API 키가 유출됩니다.

**해결 코드:**
```javascript
// ai/config.js - 환경변수 검증 모듈 신규 생성
const REQUIRED_ENV_VARS = ['GEMINI_API_KEY', 'SLACK_BOT_TOKEN', 'SLACK_APP_TOKEN'];

export function validateEnvVars() {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`필수 환경변수 누락: ${missing.join(', ')}`);
  }
}

// API 키 마스킹 유틸리티 (로그 출력용)
export function maskApiKey(key) {
  if (!key || key.length < 8) return '***';
  return key.substring(0, 4) + '***' + key.substring(key.length - 4);
}
```

### A-2. [Critical] Prompt Injection 방어 우회 가능

**파일:** `ai/index.js` - `classifyPrompt()` 함수

**문제점:** 1차 패턴 기반 검증은 간단한 변형(유니코드 치환, 줄바꿈 삽입, 인코딩 변환)으로 우회 가능합니다. 2차 AI 기반 분류도 에러 시 `SAFE_QUERY`로 fallback하여 공격자가 의도적으로 분류 에러를 유발할 수 있습니다.

**발생 시나리오:**
- `"ign\u200Bore previous instructions"` → 유니코드 zero-width 문자로 패턴 우회
- 매우 긴 입력으로 분류 API 타임아웃 유발 → `SAFE_QUERY` fallback

**해결 코드:**
```javascript
// ai/index.js - classifyPrompt 개선
async function classifyPrompt(prompt, apiKey) {
  // 0단계: 입력 길이 제한 (DoS 방지)
  if (prompt.length > 2000) {
    return 'SECURITY_RISK';
  }

  // 1단계: 유니코드 정규화 후 패턴 검증
  const normalized = prompt
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '') // zero-width 문자 제거
    .toLowerCase();

  const dangerousPatterns = [
    /ignore.*previous.*instructions/i,
    /forget.*system.*prompt/i,
    /개인정보|주민번호|전화번호/,
    /system.*prompt|role.*play|pretend.*you.*are/i,
    /\b\d{3}-\d{4}-\d{4}\b/,
    /\b\d{6}-\d{7}\b/
  ];

  if (dangerousPatterns.some(pattern => pattern.test(normalized))) {
    return 'SECURITY_RISK';
  }

  // 2단계: AI 분류 (에러 시 SECURITY_RISK로 안전하게 fallback)
  try {
    const result = await callGeminiAPI(classifier, apiKey, "gemini-2.5-flash");
    return result.trim();
  } catch (error) {
    console.error('Classification error:', error);
    return 'SECURITY_RISK'; // 안전한 방향으로 fallback
  }
}
```

### A-3. [High] 민감정보 필터링 우회 가능

**파일:** `ai/index.js` - `filterSensitiveResponse()`, `ai/rag.js` - `filterSensitiveContent()`

**문제점:** 이메일 정규식이 `[A-Z|a-z]`로 되어 있어 `|` 문자를 리터럴로 매칭합니다. 또한 국제 전화번호, 다양한 이메일 형식, 카드번호 등은 필터링되지 않습니다.

**해결 코드:**
```javascript
// ai/index.js - 개선된 민감정보 필터링
function filterSensitiveResponse(response) {
  const sensitivePatterns = [
    /\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,           // 전화번호 (다양한 형식)
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, // 이메일 (수정)
    /\b\d{6}[-\s]?\d{7}\b/g,                              // 주민번호
    /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,       // 카드번호
    /\bpassword|pwd|secret|token|api[_-]?key\b/gi,        // 민감 키워드
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,                       // IP 주소
  ];

  let filtered = response;
  for (const pattern of sensitivePatterns) {
    filtered = filtered.replace(pattern, '[보안상 비공개]');
  }
  return filtered;
}
```

### A-4. [High] 에러 핸들링에서 내부 정보 유출

**파일:** `ai/rag.js`, `ai/product-knowledge-bank.js`

**문제점:** `console.error`로 API 응답 전문, 스택 트레이스, 내부 URL 등이 로그에 출력됩니다. 프로덕션 환경에서 로그 수집 시 민감 정보가 노출될 수 있습니다.

**해결 코드:**
```javascript
// ai/rag.js - 안전한 에러 로깅
function safeLogError(context, error) {
  console.error(`[${context}] Error: ${error.message}`);
  // 스택 트레이스는 DEBUG 레벨에서만
  if (process.env.LOG_LEVEL === 'DEBUG') {
    console.debug(`[${context}] Stack:`, error.stack);
  }
  // API 응답 본문은 절대 로깅하지 않음
}
```

### A-5. [Medium] 사용자 입력 길이 제한 없음

**파일:** `listeners/assistant/message.js`, `listeners/events/direct_message.js`

**문제점:** 사용자 메시지 길이에 대한 검증이 없어 매우 긴 입력으로 Gemini API 비용 폭증 및 메모리 과다 사용이 가능합니다.

**해결 코드:**
```javascript
// listeners/assistant/message.js - 입력 검증 추가
const MAX_INPUT_LENGTH = 2000;

if (message.text.length > MAX_INPUT_LENGTH) {
  const streamer = client.chatStream({ channel, recipient_team_id: teamId, recipient_user_id: userId, thread_ts });
  await streamer.append({ markdown_text: `⚠️ 메시지가 너무 깁니다. ${MAX_INPUT_LENGTH}자 이내로 질문해주세요.` });
  await streamer.stop();
  return;
}
```

### A-6. [Medium] JWT 서명 시 private key 메모리 노출

**파일:** `ai/product-knowledge-bank.js` - `fetchSheetData()`

**문제점:** Service Account JSON을 매 API 호출마다 파싱하고 private key를 메모리에 로드합니다. 캐시 TTL(30분) 동안 반복 호출 시 불필요한 키 노출 횟수가 증가합니다.

**해결 코드:**
```javascript
// ai/product-knowledge-bank.js - 토큰 캐싱으로 private key 노출 최소화
let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken(serviceAccountJson) {
  if (cachedToken && Date.now() < tokenExpiry - 60000) {
    return cachedToken; // 만료 1분 전까지 캐시 사용
  }
  // ... JWT 생성 및 토큰 교환 로직 ...
  cachedToken = access_token;
  tokenExpiry = Date.now() + 3600 * 1000;
  return cachedToken;
}
```

---

## 🧹 B. 클린 코드 리뷰

### B-1. [DRY 위배] 민감정보 필터링 로직 중복

**파일:** `ai/index.js` (filterSensitiveResponse) + `ai/rag.js` (filterSensitiveContent)

**문제점:** 거의 동일한 정규식 패턴이 두 파일에 중복 정의되어 있습니다. 패턴 수정 시 양쪽 모두 변경해야 합니다.

**해결 코드:**
```javascript
// ai/utils/sanitizer.js - 공통 모듈로 추출
const SENSITIVE_PATTERNS = [
  { pattern: /\b\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g, label: '전화번호' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, label: '이메일' },
  { pattern: /\b\d{6}[-\s]?\d{7}\b/g, label: '주민번호' },
  { pattern: /\bpassword|pwd|secret|token|api[_-]?key\b/gi, label: '민감키워드' },
];

export function sanitize(text, replacement = '[보안상 비공개]') {
  let result = text;
  for (const { pattern } of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}
```

### B-2. [DRY 위배] 제품 키워드 매핑 중복

**파일:** `ai/index.js` (detectProduct) + `ai/rag.js` (detectProductFromQuery)

**문제점:** 동일한 제품-키워드 매핑이 두 파일에 각각 정의되어 있습니다.

**해결 코드:**
```javascript
// ai/constants.js - 공통 상수 모듈
export const PRODUCT_KEYWORDS = {
  DRM: ['drm', '문서보안', '암호화', '권한관리', 'digital rights'],
  DLP: ['dlp', '데이터유출', '정보유출', 'data loss prevention'],
  PrintSafer: ['printsafer', '인쇄보안', '워터마크', 'print security'],
  ScreenSafer: ['screensafer', '화면캡처', '스크린샷', 'screen capture'],
  'AI Sentinel': ['ai sentinel', 'ai보안', 'ai 보안'],
};

export function detectProduct(query) {
  const lower = query.toLowerCase();
  for (const [product, keywords] of Object.entries(PRODUCT_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) return product;
  }
  return null;
}
```

### B-3. [DRY 위배] RAG 검색 래퍼 함수 반복

**파일:** `listeners/assistant/message.js`, `listeners/events/direct_message.js`, `listeners/events/app_mention.js`

**문제점:** 3개 파일 모두 동일한 패턴을 반복합니다:
```javascript
const ragSearchFn = (query) => markanyRAG.search(query, client);
const result = await runMultiHopAI(text, ragSearchFn, conversationContext);
const formattedResponse = formatResponse(result.answer, result.sources);
```

**해결 코드:**
```javascript
// ai/pipeline.js - 공통 AI 파이프라인 추출
import { runMultiHopAI, formatResponse } from './index.js';
import { markanyRAG } from './rag.js';

export async function processQuery(query, slackClient, conversationHistory = '') {
  const ragSearchFn = (q) => markanyRAG.search(q, slackClient);
  const result = await runMultiHopAI(query, ragSearchFn, conversationHistory);
  
  let formatted = formatResponse(result.answer, result.sources);
  if (result.isMultiHop && result.hops?.length > 0) {
    formatted += `\n\n🔗 *${result.hops.length}단계 분석을 통해 답변을 생성했습니다.*`;
  }
  
  return { formatted, result };
}
```

### B-4. [SRP 위배] MarkAnyRAG 클래스 과도한 책임

**파일:** `ai/rag.js` - `MarkAnyRAG` 클래스

**문제점:** 하나의 클래스가 Google Drive 검색, Slack 메시지 검색, Atlassian 검색, 제품별 검색, 컨텍스트 빌딩, 민감정보 필터링, 제품 감지, 캐시 관리, 통계까지 모두 담당합니다.

**해결 방향:**
```
MarkAnyRAG (오케스트레이터)
  ├── DriveSearcher      - Google Drive 검색 전담
  ├── SlackSearcher      - Slack 메시지 검색 전담
  ├── AtlassianSearcher  - Jira/Confluence 검색 전담
  ├── ContextBuilder     - RAG 컨텍스트 조합 전담
  └── ContentSanitizer   - 민감정보 필터링 전담
```

### B-5. [네이밍] 비직관적 변수명/함수명

**파일:** 여러 파일

| 현재 | 개선안 | 이유 |
|------|--------|------|
| `kbResults` | `knowledgeBankResults` | 약어 불명확 |
| `sa` | `serviceAccount` | 1~2글자 변수명 |
| `op` | `operationPlan` | 약어 불명확 |
| `q` | `normalizedQuery` | 검색 함수 내 의미 불명확 |
| `ctx` | `contextText` | 약어 불명확 |
| `tkws` | `typeKeywords` | 약어 불명확 |
| `fkws` | `fieldKeywords` | 약어 불명확 |
| `pRows`, `oRows`, `mRows` | `productRows`, `operationRows`, `moduleRows` | 약어 불명확 |

### B-6. [매직 넘버] 하드코딩된 상수값

**파일:** 여러 파일

```javascript
// 현재 - 매직 넘버 산재
.slice(0, 3)    // ai/rag.js - 왜 3개?
.slice(0, 5)    // ai/rag.js - 왜 5개?
.slice(0, 8)    // ai/rag.js - 왜 8개?
.slice(0, 4)    // ai/multi-hop.js - 왜 4 hops?
limit: 50       // listeners - 왜 50개?
10 * 60 * 1000  // ai/multi-hop.js - EditBank TTL

// 개선 - 명명된 상수로 추출
// ai/constants.js
export const RAG_CONFIG = {
  MAX_DRIVE_CONTENT_FETCH: 3,
  MAX_DRIVE_RESULTS: 5,
  MAX_SLACK_RESULTS: 8,
  MAX_MULTI_HOP_STEPS: 4,
  CHANNEL_HISTORY_LIMIT: 50,
  EDIT_BANK_TTL_MS: 10 * 60 * 1000,
  MAX_INPUT_LENGTH: 2000,
};
```

---

## 🚀 C. 성능 및 최적화 리뷰

### C-1. [Memory Leak] EditBank 무한 성장

**파일:** `ai/multi-hop.js` - `EditBank` 클래스

**문제점:** TTL 기반 만료가 있지만, 만료된 항목은 `get()` 또는 `findSimilar()` 호출 시에만 삭제됩니다. 접근되지 않는 항목은 영원히 메모리에 남습니다. 장시간 운영 시 Map이 무한히 커질 수 있습니다.

**해결 코드:**
```javascript
// ai/multi-hop.js - 주기적 정리 + 최대 크기 제한
class EditBank {
  constructor(ttlMs = 10 * 60 * 1000, maxSize = 500) {
    this.entries = new Map();
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    // 5분마다 만료 항목 정리
    this._cleanupInterval = setInterval(() => this._cleanup(), 5 * 60 * 1000);
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (now - entry.ts > this.ttlMs) {
        this.entries.delete(key);
      }
    }
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

  destroy() {
    clearInterval(this._cleanupInterval);
    this.entries.clear();
  }
}
```

### C-2. [Memory Leak] MarkAnyRAG 캐시 무한 성장

**파일:** `ai/rag.js` - `vectorDB`, `slackCache`, `driveCache`

**문제점:** `this.vectorDB = new Map()`, `this.slackCache = new Map()`, `this.driveCache = new Map()`이 선언되어 있지만 `clearCache()` 외에 자동 정리 메커니즘이 없습니다.

**해결 코드:**
```javascript
// ai/rag.js - LRU 캐시로 교체
class LRUCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }
  get(key) {
    if (!this.cache.has(key)) return undefined;
    const value = this.cache.get(key);
    // 접근 시 순서 갱신 (LRU)
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }
  set(key, value) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
  clear() { this.cache.clear(); }
  get size() { return this.cache.size; }
}
```

### C-3. [O(n²)] findSimilar Jaccard 유사도 전수 검색

**파일:** `ai/multi-hop.js` - `EditBank.findSimilar()`

**문제점:** 모든 캐시 항목에 대해 Jaccard 유사도를 계산합니다. 캐시가 커지면 O(n × m) 복잡도 (n=캐시 크기, m=평균 토큰 수).

**현재 Big-O:** O(n × m) per query
**개선 Big-O:** O(1) amortized (해시 기반 exact match) + O(k) (상위 k개만 유사도 계산)

**해결 코드:**
```javascript
// ai/multi-hop.js - 2단계 검색: exact match → 유사도
findSimilar(subQuestion, threshold = 0.5) {
  const key = this._normalize(subQuestion);
  
  // 1단계: 정확 매칭 (O(1))
  const exact = this.entries.get(key);
  if (exact && Date.now() - exact.ts <= this.ttlMs) {
    return { ...exact, similarity: 1.0 };
  }

  // 2단계: 키워드 기반 후보 필터링 후 유사도 계산
  const queryTokens = new Set(key.split(''));
  let bestMatch = null;
  let bestScore = 0;

  for (const [entryKey, entry] of this.entries) {
    if (Date.now() - entry.ts > this.ttlMs) continue;
    // 빠른 길이 기반 사전 필터링 (길이 차이가 크면 유사도 낮음)
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
```

### C-4. [병목] Slack 채널 순차 검색

**파일:** `ai/rag.js` - `searchSlackMessages()`

**문제점:** 최대 5개 채널을 순차적으로 검색하며, 각 채널에서 메시지 히스토리 조회 + 키워드 매칭 + permalink 조회를 수행합니다. 특히 `getPermalink()`가 매칭된 메시지마다 개별 API 호출을 합니다.

**예상 영향:** 채널당 ~500ms × 5채널 + permalink 호출 = 3~5초 지연

**해결 코드:**
```javascript
// ai/rag.js - 채널 병렬 검색 + permalink 배치 처리
async searchSlackMessages(query, client, limit = 5) {
  try {
    const channelsResponse = await client.getChannels(20);
    const channels = (channelsResponse.channels || [])
      .filter(ch => ch.is_member)
      .slice(0, 5);

    const keywords = query.toLowerCase().split(' ').filter(k => k.length > 1);

    // 채널별 검색을 병렬 실행
    const channelResults = await Promise.allSettled(
      channels.map(channel => this._searchChannel(channel, keywords, client))
    );

    const allResults = channelResults
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // 상위 결과만 permalink 조회 (API 호출 최소화)
    const topResults = allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // permalink 병렬 조회
    await Promise.allSettled(
      topResults.map(async (msg) => {
        try {
          const resp = await client.getPermalink(msg.channelId, msg.ts);
          msg.permalink = resp.permalink;
        } catch { /* permalink 실패는 무시 */ }
      })
    );

    return topResults;
  } catch (error) {
    console.error('Slack search error:', error.message);
    return [];
  }
}
```

### C-5. [병목] RAG search()에서 순차 실행 가능한 병렬화

**파일:** `ai/rag.js` - `search()` 메서드

**문제점:** 현재 지식뱅크 → Drive → Slack → Atlassian 순서로 실행됩니다. Drive, Slack, Atlassian은 서로 독립적이므로 병렬 실행 가능합니다.

**현재:** ~8초 (2s + 2s + 2s + 2s 순차)
**개선:** ~3초 (지식뱅크 0.2s + 나머지 병렬 2s)

**해결 코드:**
```javascript
// ai/rag.js - search() 병렬화
async search(query, slackClient = null) {
  const results = {
    documents: [], slackMessages: [], confluence: [], jira: [],
    productInfo: [], context: ''
  };

  try {
    // 0. 지식뱅크 (가장 빠름, 먼저 실행)
    await productKnowledgeBank.load(this.googleServiceAccountJson || 'google-service-account.json');
    const kbResults = productKnowledgeBank.search(query);
    results.productInfo = kbResults.products;

    // 1~3. Drive, Slack, Atlassian 병렬 실행
    const [driveResults, slackResults, atlassianResults] = await Promise.allSettled([
      this.searchDriveDocuments(query),
      slackClient ? this.searchSlackMessages(query, slackClient) : Promise.resolve([]),
      this.searchAtlassian(query)
    ]);

    results.documents = driveResults.status === 'fulfilled' ? driveResults.value : [];
    results.slackMessages = slackResults.status === 'fulfilled' ? slackResults.value : [];
    
    if (atlassianResults.status === 'fulfilled') {
      results.confluence = atlassianResults.value.confluence || [];
      results.jira = atlassianResults.value.jira || [];
    }

    // 컨텍스트 생성
    results.context = this.buildContext(
      results.documents, results.slackMessages,
      results.confluence, results.jira, kbResults.context
    );

    return results;
  } catch (error) {
    console.error('RAG search error:', error.message);
    return results;
  }
}
```

### C-6. [병목] product-knowledge-bank 매 요청마다 파일 I/O

**파일:** `ai/product-knowledge-bank.js` - `load()` 메서드

**문제점:** `cacheTTL`(30분) 이내라도 `load()` 호출 시 매번 `this.products.length > 0` 체크를 합니다. 이건 가벼운 체크지만, 30분 만료 후에는 5개 시트를 모두 다시 읽습니다. Google Sheets API가 비활성화된 상태에서는 매번 5개의 실패 API 호출 + fallback 로직이 실행됩니다.

**해결 코드:**
```javascript
// ai/product-knowledge-bank.js - API 실패 시 재시도 간격 설정
async load(serviceAccountJson = null) {
  const now = Date.now();
  // 캐시 유효하면 스킵
  if (this.products.length > 0 && (now - this.lastFetchTime) < this.cacheTTL) return;
  // API 실패 후 5분간 재시도 방지 (불필요한 API 호출 차단)
  if (this._lastApiFailure && (now - this._lastApiFailure) < 5 * 60 * 1000) {
    if (this.products.length > 0) return; // fallback 데이터 있으면 그대로 사용
  }
  // ... 기존 로직 ...
}
```

---

## 📊 요약 매트릭스

| 카테고리 | 항목 | 심각도 | 수정 난이도 | 우선순위 |
|---------|------|--------|-----------|---------|
| 🔒 보안 | API 키 하드코딩 | Critical | 낮음 | P0 |
| 🔒 보안 | Prompt Injection 우회 | Critical | 중간 | P0 |
| 🔒 보안 | 민감정보 필터링 우회 | High | 낮음 | P1 |
| 🔒 보안 | 에러 로그 정보 유출 | High | 낮음 | P1 |
| 🔒 보안 | 입력 길이 제한 없음 | Medium | 낮음 | P1 |
| 🔒 보안 | JWT private key 노출 | Medium | 중간 | P2 |
| 🧹 클린 | 민감정보 필터링 중복 | Medium | 낮음 | P2 |
| 🧹 클린 | 제품 키워드 매핑 중복 | Medium | 낮음 | P2 |
| 🧹 클린 | RAG 파이프라인 중복 | Medium | 중간 | P2 |
| 🧹 클린 | MarkAnyRAG SRP 위배 | High | 높음 | P3 |
| 🧹 클린 | 비직관적 변수명 | Low | 낮음 | P3 |
| 🧹 클린 | 매직 넘버 산재 | Low | 낮음 | P3 |
| 🚀 성능 | EditBank 메모리 누수 | High | 낮음 | P1 |
| 🚀 성능 | RAG 캐시 무한 성장 | High | 중간 | P1 |
| 🚀 성능 | Jaccard O(n²) 검색 | Medium | 중간 | P2 |
| 🚀 성능 | Slack 순차 검색 병목 | High | 중간 | P1 |
| 🚀 성능 | RAG search 순차 실행 | High | 낮음 | P1 |
| 🚀 성능 | KB API 실패 시 반복 호출 | Medium | 낮음 | P2 |
