-- Presalesapp Analytics Database Schema

-- 질의응답 로그 테이블
CREATE TABLE IF NOT EXISTS query_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  keywords TEXT,
  response_time REAL,
  sources_count INTEGER,
  success INTEGER,
  error_type TEXT,
  timestamp INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_timestamp ON query_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_hash ON query_logs(user_hash);
CREATE INDEX IF NOT EXISTS idx_success ON query_logs(success);

-- 일일 통계 집계 테이블
CREATE TABLE IF NOT EXISTS daily_stats (
  date TEXT PRIMARY KEY,
  total_queries INTEGER DEFAULT 0,
  successful_queries INTEGER DEFAULT 0,
  avg_response_time REAL DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인기 키워드 테이블
CREATE TABLE IF NOT EXISTS popular_keywords (
  keyword TEXT PRIMARY KEY,
  count INTEGER DEFAULT 1,
  last_used INTEGER
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_keyword_count ON popular_keywords(count DESC);
