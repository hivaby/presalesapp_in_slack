# Cloudflare Workers 배포 가이드

MarkAny Slack AI Assistant를 Cloudflare Workers에 배포하는 방법입니다.

## 사전 준비

### 1. Cloudflare 계정 생성

1. [Cloudflare](https://dash.cloudflare.com/sign-up)에서 계정 생성
2. Workers & Pages 섹션으로 이동

### 2. Wrangler CLI 로그인

```bash
npx wrangler login
```

브라우저가 열리면 Cloudflare 계정으로 로그인합니다.

## 환경 변수 설정

Cloudflare Workers는 Secrets를 사용하여 환경 변수를 안전하게 저장합니다.

### Slack Bot Token 설정

```bash
npx wrangler secret put SLACK_BOT_TOKEN
```

프롬프트가 나타나면 Slack Bot User OAuth Token을 입력합니다.
(형식: `xoxb-...`)

### Slack Signing Secret 설정

```bash
npx wrangler secret put SLACK_SIGNING_SECRET
```

Slack App 설정 > Basic Information > App Credentials에서 Signing Secret을 복사하여 입력합니다.

### Gemini API Key 설정

```bash
npx wrangler secret put GEMINI_API_KEY
```

Google AI Studio에서 발급받은 Gemini API Key를 입력합니다.

## 로컬 개발

### 1. 로컬 개발 서버 실행

```bash
npm run dev
```

Wrangler가 `http://localhost:8787`에서 개발 서버를 시작합니다.

### 2. ngrok으로 터널링

Slack Events API는 공개 URL이 필요하므로 ngrok을 사용합니다.

```bash
# ngrok 설치 (Mac)
brew install ngrok

# 터널 시작
ngrok http 8787
```

ngrok이 제공하는 HTTPS URL을 복사합니다 (예: `https://abc123.ngrok.io`).

### 3. Slack App 설정 변경

1. [Slack API](https://api.slack.com/apps)에서 앱 선택
2. **Event Subscriptions** 활성화
   - Request URL: `https://abc123.ngrok.io` 입력
   - Slack이 URL을 검증합니다 (초록색 체크 표시 확인)
3. **Subscribe to bot events** 섹션에서 다음 이벤트 추가:
   - `message.im` (DM 메시지)
   - `app_mention` (멘션)
   - `assistant_thread_started` (Assistant 시작)
   - `assistant_thread_context_changed` (Assistant 컨텍스트 변경)
4. **Save Changes** 클릭
5. **Socket Mode 비활성화** (Settings > Socket Mode)

### 4. 로컬 테스트

Slack에서 봇에게 DM을 보내거나 채널에서 멘션하여 테스트합니다.

```
@MarkAny Assistant DRM 라이선스 설정 방법은?
```

Wrangler 터미널에서 로그를 확인할 수 있습니다.

## 프로덕션 배포

### 1. Workers 배포

```bash
npm run deploy
```

Wrangler가 코드를 Cloudflare Workers에 배포하고 URL을 제공합니다.
(예: `https://markany-slack-assistant.your-subdomain.workers.dev`)

### 2. Slack App Request URL 업데이트

1. [Slack API](https://api.slack.com/apps)에서 앱 선택
2. **Event Subscriptions** > Request URL 업데이트
   - URL: `https://markany-slack-assistant.your-subdomain.workers.dev`
3. **Save Changes** 클릭

### 3. 배포 확인

Slack에서 봇을 테스트하여 정상 동작하는지 확인합니다.

## 모니터링

### 실시간 로그 확인

```bash
npm run tail
```

Cloudflare Workers의 실시간 로그를 터미널에서 확인할 수 있습니다.

### Cloudflare Dashboard

[Cloudflare Dashboard](https://dash.cloudflare.com) > Workers & Pages에서:
- 요청 수
- 에러율
- CPU 사용량
- 실행 시간

등의 메트릭을 확인할 수 있습니다.

## 문제 해결

### URL Verification 실패

**증상:** Slack이 Request URL을 검증하지 못함

**해결:**
1. Wrangler dev 서버가 실행 중인지 확인
2. ngrok 터널이 활성화되어 있는지 확인
3. `worker/index.js`의 URL verification 로직 확인

### Signature Verification 실패

**증상:** 401 Unauthorized 에러

**해결:**
1. `SLACK_SIGNING_SECRET`이 올바르게 설정되었는지 확인
   ```bash
   npx wrangler secret list
   ```
2. Slack App의 Signing Secret과 일치하는지 확인

### AI 응답 없음

**증상:** 봇이 응답하지 않음

**해결:**
1. `GEMINI_API_KEY`가 설정되었는지 확인
2. Gemini API 할당량 확인
3. Wrangler tail로 에러 로그 확인

### 3초 타임아웃

**증상:** Slack에서 "timeout" 에러

**해결:**
- Cloudflare Workers는 이미 `ctx.waitUntil()`을 사용하여 비동기 처리 중
- RAG 검색이나 AI 응답 생성 시간이 너무 길면 최적화 필요
- 캐싱 추가 고려 (Cloudflare KV)

## 추가 설정 (선택사항)

### Custom Domain 설정

Cloudflare Dashboard에서 Workers에 커스텀 도메인을 연결할 수 있습니다.

1. Workers & Pages > 해당 Worker 선택
2. Settings > Triggers > Custom Domains
3. Add Custom Domain

### Cloudflare KV (캐싱)

RAG 검색 결과를 캐싱하려면 KV를 사용할 수 있습니다.

1. Cloudflare Dashboard > Workers & Pages > KV
2. Create namespace: `markany-cache`
3. `wrangler.toml`에 추가:
   ```toml
   [[kv_namespaces]]
   binding = "CACHE"
   id = "your-namespace-id"
   ```

## 비용

- **Free Plan**: 일일 100,000 요청, CPU 10ms/요청
- **Paid Plan ($5/월)**: 일일 10,000,000 요청

대부분의 경우 Free Plan으로 충분합니다.

## 다음 단계

1. ✅ Cloudflare Workers 배포 완료
2. 📊 사용 통계 모니터링
3. 🔧 성능 최적화 (캐싱, 배치 처리)
4. 📈 기능 확장 (Vector DB 연동, 실시간 인덱싱)

---

**문의:** IT팀 또는 Slack #tech-support 채널
