# Atlassian (Jira/Confluence) 통합 문제 해결 가이드

## 🔍 문제: Jira/Confluence 데이터가 Slack에 표시되지 않음

### 1단계: Cloudflare Secrets 확인

다음 환경 변수가 설정되어 있는지 확인하세요:

```bash
# Secrets 확인
wrangler secret list

# 필요한 Secrets:
# - ATLASSIAN_API_TOKEN
# - ATLASSIAN_EMAIL
```

#### Secrets 설정 방법:

```bash
# API 토큰 설정
wrangler secret put ATLASSIAN_API_TOKEN
# 입력: your-atlassian-api-token

# 이메일 설정  
wrangler secret put ATLASSIAN_EMAIL
# 입력: your-email@company.com
```

### 2단계: wrangler.toml 확인

`wrangler.toml` 파일에 도메인이 올바르게 설정되어 있는지 확인:

```toml
[vars]
ATLASSIAN_DOMAIN = "markany.atlassian.net"
```

### 3단계: API 토큰 권한 확인

Atlassian API 토큰이 다음 권한을 가지고 있는지 확인:

1. **Jira 권한**:
   - Read issues
   - Search issues

2. **Confluence 권한**:
   - Read content
   - Search content

#### API 토큰 생성 방법:

1. https://id.atlassian.com/manage-profile/security/api-tokens 접속
2. "Create API token" 클릭
3. 토큰 이름 입력 (예: "Slack AI Assistant")
4. 생성된 토큰 복사
5. `wrangler secret put ATLASSIAN_API_TOKEN`으로 설정

### 4단계: 배포 및 로그 확인

```bash
# 1. 코드 배포
wrangler deploy

# 2. 실시간 로그 확인
wrangler tail

# 3. Slack에서 테스트 질문
# 예: "DRM 관련 이슈 찾아줘"
```

### 5단계: 로그 분석

배포 후 Slack에서 질문하면 다음과 같은 로그가 표시됩니다:

#### ✅ 정상 동작 시:
```
[RAG] searchAtlassian called with query: DRM 관련 이슈
[RAG] Searching Atlassian with query: "DRM 관련 이슈"
[Atlassian] Searching Confluence for: "DRM 관련 이슈"
[Atlassian] Confluence URL: https://markany.atlassian.net/wiki/rest/api/content/search?...
[Atlassian] ✅ Confluence returned 3 results
[Atlassian] Searching Jira for: "DRM 관련 이슈"
[Atlassian] Jira URL: https://markany.atlassian.net/rest/api/3/search
[Atlassian] ✅ Jira returned 5 issues
[RAG] ✅ Found 3 Confluence pages and 5 Jira issues
[RAG] Sample Confluence result: DRM 제품 가이드
[RAG] Sample Jira result: [MARK-123] DRM 버그 수정
```

#### ❌ 설정 문제 시:
```
[RAG] ⚠️ Atlassian client not configured - check ATLASSIAN_API_TOKEN, ATLASSIAN_EMAIL, ATLASSIAN_DOMAIN
[RAG] Config status: {
  hasConfig: true,
  hasDomain: "markany.atlassian.net",
  hasEmail: "user@company.com",
  hasApiToken: "NOT SET"  ← 문제!
}
```

#### ❌ API 오류 시:
```
[Atlassian] ❌ Confluence search failed: 401
[Atlassian] Error response: Unauthorized
```

### 6단계: 일반적인 문제 해결

| 문제 | 원인 | 해결 방법 |
|------|------|----------|
| `hasApiToken: "NOT SET"` | API 토큰 미설정 | `wrangler secret put ATLASSIAN_API_TOKEN` |
| `401 Unauthorized` | 잘못된 API 토큰 또는 이메일 | API 토큰 재생성 및 재설정 |
| `403 Forbidden` | 권한 부족 | Jira/Confluence 관리자에게 권한 요청 |
| `404 Not Found` | 잘못된 도메인 | `wrangler.toml`에서 `ATLASSIAN_DOMAIN` 확인 |
| `0 results` | 검색어 문제 | 더 간단한 키워드로 테스트 (예: "DRM") |

### 7단계: 테스트 쿼리

다음 질문들로 테스트해보세요:

```
1. "DRM 관련 문서 찾아줘"
2. "최근 이슈 보여줘"
3. "MARK-123 이슈 상태는?"
4. "Confluence에서 가이드 찾아줘"
```

### 8단계: 추가 디버깅

여전히 문제가 있다면:

1. **Atlassian 웹에서 직접 검색 테스트**:
   - https://markany.atlassian.net/jira 접속
   - 검색창에 "DRM" 입력
   - 결과가 나오는지 확인

2. **API 직접 테스트**:
```bash
# Confluence API 테스트
curl -u "your-email@company.com:your-api-token" \
  "https://markany.atlassian.net/wiki/rest/api/content/search?cql=siteSearch~\"DRM\""

# Jira API 테스트
curl -u "your-email@company.com:your-api-token" \
  -H "Content-Type: application/json" \
  -X POST \
  -d '{"jql":"text~\"DRM\"","maxResults":5}' \
  "https://markany.atlassian.net/rest/api/3/search"
```

## 📝 체크리스트

- [ ] `ATLASSIAN_API_TOKEN` Secret 설정됨
- [ ] `ATLASSIAN_EMAIL` Secret 설정됨
- [ ] `ATLASSIAN_DOMAIN` wrangler.toml에 설정됨
- [ ] API 토큰이 Jira/Confluence 읽기 권한 보유
- [ ] 코드 배포 완료 (`wrangler deploy`)
- [ ] 로그에서 "✅ Found X Confluence pages and Y Jira issues" 확인
- [ ] Slack 응답에 Jira/Confluence 데이터 포함됨

## 🆘 도움이 필요하면

로그 전체를 복사하여 공유해주세요:
```bash
wrangler tail > atlassian-debug.log
# Slack에서 질문 후
# Ctrl+C로 중단
# atlassian-debug.log 파일 확인
```
