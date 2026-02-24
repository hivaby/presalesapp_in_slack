# 🎯 Daily Habit Tracker

매일 습관을 추적하고 연속 달성 일수를 기록하는 웹 앱입니다.

## ✨ 주요 기능

- 🎯 **습관 추가/삭제**: 새로운 습관을 쉽게 추가하고 관리
- 🔥 **연속 달성 추적**: 습관을 연속으로 달성한 일수 표시  
- 📊 **실시간 통계**: 총 습관 수, 오늘 완료한 습관, 평균/최장 연속 기록
- 💾 **데이터 지속성**: Cloudflare KV로 데이터 저장 + 로컬 스토리지 fallback
- 📱 **반응형 디자인**: 모바일과 데스크톱에서 모두 사용 가능
- 🎨 **아름다운 UI**: 그라데이션 배경과 글래스모피즘 디자인

## 🚀 기술 스택

- **Frontend**: React (CDN), Vanilla JavaScript
- **Backend**: Cloudflare Workers + Hono
- **Database**: Cloudflare KV Storage
- **Deployment**: Cloudflare Workers

## 📦 설치 및 실행

### 1. 프로젝트 설정
\`\`\`bash
cd habit-tracker
npm install
\`\`\`

### 2. Cloudflare KV 네임스페이스 생성 (선택사항)
\`\`\`bash
# KV 네임스페이스 생성
wrangler kv:namespace create "HABITS_KV"
wrangler kv:namespace create "HABITS_KV" --preview

# wrangler.toml에 반환된 ID 입력
\`\`\`

### 3. 개발 서버 실행
\`\`\`bash
npm run dev
\`\`\`

브라우저에서 \`http://localhost:8787\` 접속

### 4. 배포
\`\`\`bash
npm run deploy
\`\`\`

## 🏗️ 프로젝트 구조

\`\`\`
habit-tracker/
├── src/
│   └── worker.js          # Cloudflare Worker + React 앱
├── package.json           # 의존성 및 스크립트
├── wrangler.toml          # Cloudflare 설정
└── README.md
\`\`\`

## 📱 사용법

### 습관 관리
1. **습관 추가**: 상단 입력 필드에 습관 이름 입력 후 "추가하기" 클릭
2. **습관 완료**: 각 습관 카드의 "완료하기" 버튼 클릭
3. **습관 삭제**: 습관 카드 우상단의 ✕ 버튼 클릭

### 통계 확인
- **총 습관**: 등록된 모든 습관 수
- **오늘 완료**: 오늘 완료한 습관 수  
- **평균 연속**: 모든 습관의 평균 연속 달성 일수
- **최장 연속**: 가장 긴 연속 달성 기록

## 🎨 디자인 특징

### 시각적 요소
- 🌈 **그라데이션 배경**: 보라색에서 파란색으로 이어지는 아름다운 그라데이션
- 🪟 **글래스모피즘**: 반투명 카드와 블러 효과
- 🔥 **연속 달성 표시**: 불꽃 이모지와 함께 연속 일수 표시
- ✨ **부드러운 애니메이션**: 호버 효과와 버튼 상호작용

### 반응형 디자인
- 데스크톱: 4열 통계 그리드
- 태블릿: 2열 통계 그리드  
- 모바일: 세로 레이아웃, 터치 친화적 버튼

## 🔧 커스터마이징

### 색상 테마 변경
\`\`\`css
/* worker.js 내 스타일 섹션에서 수정 */
body { 
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
}
.stat-number { color: #4f46e5; }
.check-button { background: #4f46e5; }
\`\`\`

### 새로운 기능 추가
1. **습관 카테고리**: 건강, 학습, 업무 등으로 분류
2. **주간 통계**: 주간 완료율 차트
3. **알림 기능**: 브라우저 알림으로 습관 리마인더
4. **목표 설정**: 연속 달성 목표 설정

### API 확장 예시
\`\`\`javascript
// 습관 히스토리 조회
app.get('/api/habits/:id/history', async (c) => {
  const habitId = c.req.param('id')
  // 특정 습관의 완료 히스토리 반환
})

// 습관에 메모 추가
app.post('/api/habits/:id/note', async (c) => {
  const habitId = c.req.param('id')
  const { note } = await c.req.json()
  // 습관에 메모 저장
})
\`\`\`

## 💡 사용 팁

### 효과적인 습관 만들기
- **구체적으로**: "운동하기" → "30분 걷기"
- **측정 가능하게**: "물 많이 마시기" → "물 8잔 마시기"  
- **작게 시작**: "1시간 독서" → "10분 독서"
- **시간 정하기**: "아침 7시에 물 2잔 마시기"

### 연속 달성 유지하기
- 🌅 **아침에 체크**: 하루를 시작하며 습관 확인
- 📱 **알림 설정**: 브라우저 북마크나 홈 화면 추가
- 🎯 **작은 목표**: 7일, 21일, 100일 등 단계별 목표
- 🏆 **보상 시스템**: 연속 달성 시 자신에게 보상

## 🚀 향후 개선 사항

- [ ] 사용자 인증 시스템 (Google/GitHub 로그인)
- [ ] 습관 완료 히스토리 차트 (Chart.js)
- [ ] 모바일 앱 (React Native/Flutter)
- [ ] 다크 모드 지원
- [ ] 다국어 지원 (영어/일본어)
- [ ] PWA 기능 (오프라인 지원, 푸시 알림)
- [ ] 소셜 기능 (친구와 습관 공유)
- [ ] 습관 템플릿 (건강, 학습, 업무 등)

## 🐛 문제 해결

### KV 네임스페이스 오류
KV가 설정되지 않아도 로컬 스토리지로 동작합니다. 프로덕션에서는 KV 설정을 권장합니다.

### 로컬 개발 시 CORS 오류
\`wrangler dev\` 명령어로 실행하면 CORS가 자동으로 처리됩니다.

### 데이터 손실 방지
로컬 스토리지와 KV 스토리지 이중 저장으로 데이터 손실을 방지합니다.

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능합니다.

---

**Happy Habit Building! 🌟**