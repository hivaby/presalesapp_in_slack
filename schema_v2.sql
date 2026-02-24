-- Enhanced Presalesapp Analytics Database Schema v2

-- Create new enhanced query logs table
CREATE TABLE IF NOT EXISTS query_logs_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_hash TEXT NOT NULL,
  user_name TEXT,
  question_text TEXT,
  answer_text TEXT,
  keywords TEXT,
  category TEXT,
  response_time REAL,
  sources_count INTEGER,
  success INTEGER,
  error_type TEXT,
  timestamp INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_timestamp_v2 ON query_logs_v2(timestamp);
CREATE INDEX IF NOT EXISTS idx_user_hash_v2 ON query_logs_v2(user_hash);
CREATE INDEX IF NOT EXISTS idx_success_v2 ON query_logs_v2(success);
CREATE INDEX IF NOT EXISTS idx_category ON query_logs_v2(category);
CREATE INDEX IF NOT EXISTS idx_created_at ON query_logs_v2(created_at);

-- Migrate existing data from query_logs to query_logs_v2
INSERT INTO query_logs_v2 
  (user_hash, keywords, response_time, sources_count, success, error_type, timestamp, created_at)
SELECT 
  user_hash, keywords, response_time, sources_count, success, error_type, timestamp, created_at
FROM query_logs;

-- Drop old table (optional - keep for backup)
-- DROP TABLE IF EXISTS query_logs;
