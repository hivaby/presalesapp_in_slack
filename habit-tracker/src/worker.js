import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// CORS 설정
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type'],
}))

// 메인 페이지 - React 앱
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="ko">
    <head>
      <title>Daily Habit Tracker</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
      <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
      <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        .container { max-width: 900px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; color: white; }
        .header h1 { font-size: 42px; font-weight: 700; margin-bottom: 8px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .header p { font-size: 18px; opacity: 0.9; }
        
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { 
          background: rgba(255,255,255,0.95); 
          border-radius: 16px; 
          padding: 24px; 
          text-align: center; 
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .stat-number { font-size: 36px; font-weight: bold; color: #4f46e5; margin-bottom: 8px; }
        .stat-label { color: #6b7280; font-weight: 500; }
        
        .add-habit { 
          background: rgba(255,255,255,0.95); 
          border-radius: 16px; 
          padding: 24px; 
          margin-bottom: 24px; 
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        }
        .add-habit h3 { margin-bottom: 16px; color: #1f2937; font-size: 20px; }
        .input-group { display: flex; gap: 12px; }
        .input-group input { 
          flex: 1; 
          padding: 14px 16px; 
          border: 2px solid #e5e7eb; 
          border-radius: 12px; 
          font-size: 16px;
          transition: border-color 0.2s;
        }
        .input-group input:focus { outline: none; border-color: #4f46e5; }
        .add-button { 
          background: #10b981; 
          color: white; 
          border: none; 
          border-radius: 12px; 
          padding: 14px 28px; 
          cursor: pointer; 
          font-size: 16px; 
          font-weight: 600;
          transition: background 0.2s;
        }
        .add-button:hover { background: #059669; }
        
        .habit-card { 
          background: rgba(255,255,255,0.95); 
          border-radius: 16px; 
          padding: 24px; 
          margin-bottom: 16px; 
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          transition: transform 0.2s;
        }
        .habit-card:hover { transform: translateY(-2px); }
        .habit-header { display: flex; justify-content: space-between; align-items: flex-start; }
        .habit-content { flex: 1; }
        .habit-name { font-size: 20px; font-weight: 600; margin-bottom: 12px; color: #1f2937; }
        .habit-streak { 
          color: #f59e0b; 
          font-weight: 600; 
          margin-bottom: 16px; 
          font-size: 16px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .check-button { 
          background: #4f46e5; 
          color: white; 
          border: none; 
          border-radius: 12px; 
          padding: 12px 24px; 
          cursor: pointer; 
          font-size: 16px; 
          font-weight: 600;
          transition: all 0.2s;
        }
        .check-button:hover { background: #4338ca; transform: scale(1.02); }
        .check-button.completed { background: #10b981; }
        .check-button.completed:hover { background: #059669; }
        .delete-button {
          background: none;
          border: none;
          color: #ef4444;
          cursor: pointer;
          font-size: 20px;
          padding: 8px;
          border-radius: 8px;
          transition: background 0.2s;
        }
        .delete-button:hover { background: rgba(239, 68, 68, 0.1); }
        
        .empty-state { 
          text-align: center; 
          padding: 60px 20px; 
          color: rgba(255,255,255,0.8); 
        }
        .empty-state h3 { font-size: 24px; margin-bottom: 12px; }
        .empty-state p { font-size: 16px; opacity: 0.8; }
        
        .loading { 
          text-align: center; 
          padding: 60px; 
          color: white; 
          font-size: 18px; 
        }
        
        @media (max-width: 768px) {
          .container { padding: 16px; }
          .header h1 { font-size: 32px; }
          .stats { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .input-group { flex-direction: column; }
          .habit-header { flex-direction: column; gap: 16px; }
        }
      </style>
    </head>
    <body>
      <div id="root"></div>
      <script type="text/babel">
        const { useState, useEffect } = React;

        function HabitTracker() {
          const [habits, setHabits] = useState([]);
          const [newHabitName, setNewHabitName] = useState('');
          const [loading, setLoading] = useState(true);

          // 데이터 로드
          useEffect(() => {
            loadHabits();
          }, []);

          const loadHabits = async () => {
            try {
              const response = await fetch('/api/habits');
              const data = await response.json();
              setHabits(data.habits || []);
            } catch (error) {
              console.error('Failed to load habits:', error);
              // 로컬 스토리지 fallback
              const saved = localStorage.getItem('daily-habits');
              if (saved) {
                setHabits(JSON.parse(saved));
              }
            }
            setLoading(false);
          };

          const saveHabits = async (updatedHabits) => {
            try {
              await fetch('/api/habits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ habits: updatedHabits })
              });
            } catch (error) {
              console.error('Failed to save habits:', error);
              // 로컬 스토리지 fallback
              localStorage.setItem('daily-habits', JSON.stringify(updatedHabits));
            }
          };

          const addHabit = () => {
            if (!newHabitName.trim()) return;
            
            const newHabit = {
              id: Date.now(),
              name: newHabitName.trim(),
              streak: 0,
              completedDates: [],
              createdAt: new Date().toISOString()
            };
            
            const updatedHabits = [...habits, newHabit];
            setHabits(updatedHabits);
            saveHabits(updatedHabits);
            setNewHabitName('');
          };

          const toggleHabit = (id) => {
            const today = new Date().toDateString();
            const updatedHabits = habits.map(habit => {
              if (habit.id === id) {
                const wasCompletedToday = habit.completedDates.includes(today);
                
                if (wasCompletedToday) {
                  // 완료 취소
                  return {
                    ...habit,
                    streak: Math.max(0, habit.streak - 1),
                    completedDates: habit.completedDates.filter(date => date !== today)
                  };
                } else {
                  // 완료 체크
                  return {
                    ...habit,
                    streak: habit.streak + 1,
                    completedDates: [...habit.completedDates, today]
                  };
                }
              }
              return habit;
            });
            
            setHabits(updatedHabits);
            saveHabits(updatedHabits);
          };

          const deleteHabit = (id) => {
            if (confirm('정말로 이 습관을 삭제하시겠습니까?')) {
              const updatedHabits = habits.filter(habit => habit.id !== id);
              setHabits(updatedHabits);
              saveHabits(updatedHabits);
            }
          };

          // 통계 계산
          const today = new Date().toDateString();
          const totalHabits = habits.length;
          const completedToday = habits.filter(h => h.completedDates.includes(today)).length;
          const averageStreak = totalHabits > 0 ? Math.round(habits.reduce((sum, h) => sum + h.streak, 0) / totalHabits) : 0;
          const longestStreak = habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0;

          if (loading) {
            return (
              <div className="container">
                <div className="loading">⏳ 습관 데이터를 불러오는 중...</div>
              </div>
            );
          }

          return (
            <div className="container">
              <div className="header">
                <h1>🎯 Daily Habit Tracker</h1>
                <p>매일 조금씩, 더 나은 나를 만들어가세요</p>
              </div>

              {/* 통계 대시보드 */}
              <div className="stats">
                <div className="stat-card">
                  <div className="stat-number">{totalHabits}</div>
                  <div className="stat-label">총 습관</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{completedToday}</div>
                  <div className="stat-label">오늘 완료</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{averageStreak}</div>
                  <div className="stat-label">평균 연속</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">{longestStreak}</div>
                  <div className="stat-label">최장 연속</div>
                </div>
              </div>

              {/* 새 습관 추가 */}
              <div className="add-habit">
                <h3>✨ 새로운 습관 추가</h3>
                <div className="input-group">
                  <input
                    type="text"
                    placeholder="습관을 입력하세요 (예: 물 8잔 마시기, 30분 운동하기)"
                    value={newHabitName}
                    onChange={(e) => setNewHabitName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addHabit()}
                  />
                  <button className="add-button" onClick={addHabit}>
                    추가하기
                  </button>
                </div>
              </div>

              {/* 습관 목록 */}
              {habits.length === 0 ? (
                <div className="empty-state">
                  <h3>🌱 첫 번째 습관을 시작해보세요!</h3>
                  <p>작은 변화가 큰 성장을 만듭니다</p>
                </div>
              ) : (
                habits.map(habit => {
                  const isCompletedToday = habit.completedDates.includes(today);
                  return (
                    <div key={habit.id} className="habit-card">
                      <div className="habit-header">
                        <div className="habit-content">
                          <div className="habit-name">{habit.name}</div>
                          <div className="habit-streak">
                            🔥 <span>{habit.streak}일 연속</span>
                          </div>
                          <button
                            className={\`check-button \${isCompletedToday ? 'completed' : ''}\`}
                            onClick={() => toggleHabit(habit.id)}
                          >
                            {isCompletedToday ? '✅ 오늘 완료!' : '⭕ 완료하기'}
                          </button>
                        </div>
                        <button
                          className="delete-button"
                          onClick={() => deleteHabit(habit.id)}
                          title="습관 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          );
        }

        ReactDOM.render(<HabitTracker />, document.getElementById('root'));
      </script>
    </body>
    </html>
  `)
})

// API 엔드포인트들
app.get('/api/habits', async (c) => {
  try {
    const userId = 'default' // 실제로는 인증에서 가져와야 함
    
    // KV가 설정되어 있지 않으면 빈 배열 반환
    if (!c.env.HABITS_KV) {
      return c.json({ habits: [] })
    }
    
    const data = await c.env.HABITS_KV.get(\`habits:\${userId}\`)
    
    if (!data) {
      return c.json({ habits: [] })
    }
    
    return c.json(JSON.parse(data))
  } catch (error) {
    console.error('Error loading habits:', error)
    return c.json({ habits: [] })
  }
})

app.post('/api/habits', async (c) => {
  try {
    const userId = 'default' // 실제로는 인증에서 가져와야 함
    const body = await c.req.json()
    
    // KV가 설정되어 있지 않으면 성공으로 처리 (로컬 스토리지 사용)
    if (!c.env.HABITS_KV) {
      return c.json({ success: true, message: 'Using local storage' })
    }
    
    await c.env.HABITS_KV.put(\`habits:\${userId}\`, JSON.stringify(body))
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Error saving habits:', error)
    return c.json({ error: 'Failed to save habits' }, 500)
  }
})

// 습관 통계 API
app.get('/api/stats', async (c) => {
  try {
    const userId = 'default'
    
    if (!c.env.HABITS_KV) {
      return c.json({ totalHabits: 0, completedToday: 0, averageStreak: 0, longestStreak: 0 })
    }
    
    const data = await c.env.HABITS_KV.get(\`habits:\${userId}\`)
    
    if (!data) {
      return c.json({ totalHabits: 0, completedToday: 0, averageStreak: 0, longestStreak: 0 })
    }
    
    const { habits } = JSON.parse(data)
    const today = new Date().toDateString()
    
    const stats = {
      totalHabits: habits.length,
      completedToday: habits.filter(h => h.completedDates.includes(today)).length,
      averageStreak: habits.length > 0 ? Math.round(habits.reduce((sum, h) => sum + h.streak, 0) / habits.length) : 0,
      longestStreak: habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0
    }
    
    return c.json(stats)
  } catch (error) {
    console.error('Error getting stats:', error)
    return c.json({ error: 'Failed to get stats' }, 500)
  }
})

export default app