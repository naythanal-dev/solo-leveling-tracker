import { useState, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore'

// ==========================================
// FIREBASE CONFIG - FROM ENVIRONMENT VARIABLES
// ==========================================
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_FIREBASE_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_PROJECT.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_PROJECT.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
const googleProvider = new GoogleAuthProvider()

// ==========================================
// GROQ AI CONFIG - FROM ENVIRONMENT VARIABLES
// ==========================================
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || ""
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

// ==========================================
// GAME CONSTANTS
// ==========================================
const DIFFICULTY_XP = { easy: 10, normal: 20, hard: 35, elite: 60, boss: 100 }
const DIFFICULTY_COINS = { easy: 5, normal: 10, hard: 18, elite: 30, boss: 50 }
const DIFFICULTY_LABEL = { easy: 'E', normal: 'N', hard: 'H', elite: 'EL', boss: 'B' }

const RANKS = [
  { name: 'Trainee', color: '#888', minXP: 0 },
  { name: 'E-Rank', color: '#4ade80', minXP: 100 },
  { name: 'D-Rank', color: '#60a5fa', minXP: 300 },
  { name: 'C-Rank', color: '#c084fc', minXP: 700 },
  { name: 'B-Rank', color: '#fb923c', minXP: 1500 },
  { name: 'A-Rank', color: '#f472b6', minXP: 3000 },
  { name: 'S-Rank', color: '#ef4444', minXP: 6000 },
  { name: 'Elite', color: '#fbbf24', minXP: 10000 },
  { name: 'Master', color: '#7c3aed', minXP: 20000 },
  { name: 'Monarch', color: '#ffd700', minXP: 50000 }
]

const ACHIEVEMENTS = [
  { id: 'first_quest', icon: '🎯', title: 'First Blood', desc: 'Complete your first quest' },
  { id: 'quest_10', icon: '⚔️', title: 'Getting Started', desc: 'Complete 10 quests' },
  { id: 'quest_50', icon: '💫', title: 'Quest Hunter', desc: 'Complete 50 quests' },
  { id: 'streak_3', icon: '🔥', title: 'On Fire', desc: '3-day streak' },
  { id: 'streak_7', icon: '🔥', title: 'Unstoppable', desc: '7-day streak' },
  { id: 'level_5', icon: '⬆️', title: 'Rising Star', desc: 'Reach level 5' },
  { id: 'level_10', icon: '⚡', title: 'Power Up', desc: 'Reach level 10' },
  { id: 'rank_d', icon: '🏅', title: 'Ranked Up', desc: 'Reach D-Rank' }
]

const QUEST_TEMPLATES = {
  warrior: [
    { title: 'Morning Workout', stat: 'strength', difficulty: 'normal' },
    { title: 'Stretching', stat: 'vitality', difficulty: 'easy' },
    { title: 'Cardio Session', stat: 'strength', difficulty: 'normal' }
  ],
  scholar: [
    { title: 'Study Session', stat: 'intelligence', difficulty: 'normal' },
    { title: 'Read 20 Pages', stat: 'intelligence', difficulty: 'easy' },
    { title: 'Practice Problems', stat: 'focus', difficulty: 'normal' }
  ],
  assassin: [
    { title: 'Deep Work Block', stat: 'focus', difficulty: 'hard' },
    { title: 'Clear Inbox', stat: 'discipline', difficulty: 'easy' },
    { title: 'No Phone 1 Hour', stat: 'willpower', difficulty: 'normal' }
  ],
  guardian: [
    { title: 'Healthy Meal', stat: 'vitality', difficulty: 'easy' },
    { title: 'Sleep by 11 PM', stat: 'vitality', difficulty: 'normal' },
    { title: 'Drink 2L Water', stat: 'discipline', difficulty: 'easy' }
  ],
  monarch: [
    { title: 'Morning Routine', stat: 'discipline', difficulty: 'normal' },
    { title: 'Learn Something New', stat: 'intelligence', difficulty: 'easy' },
    { title: 'Evening Reflection', stat: 'focus', difficulty: 'easy' }
  ]
}

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [screen, setScreen] = useState('splash')
  const [slide, setSlide] = useState(1)
  const [toast, setToast] = useState(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Greetings, Hunter. I am your AI Oracle, here to guide your journey. Ask me anything.' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef(null)
  
  const [state, setState] = useState({
    username: '',
    avatar: '🧙',
    path: '',
    goals: [],
    level: 1,
    currentXP: 0,
    totalXP: 0,
    coins: 0,
    rank: 'Trainee',
    title: 'Trainee Hunter',
    streak: 0,
    bestStreak: 0,
    stats: { strength: 0, intelligence: 0, discipline: 0, focus: 0, vitality: 0, willpower: 0, charisma: 0 },
    quests: [],
    totalQuests: 0,
    achievements: [],
    initialized: false
  })

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user)
        await loadData(user.uid)
      } else {
        setUser(null)
        setLoading(false)
      }
    })
    return () => unsubscribe()
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // ==========================================
  // DATA FUNCTIONS
  // ==========================================
  const loadData = async (uid) => {
    setLoading(true)
    try {
      const docRef = doc(db, 'users', uid)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        // Found data in Firestore - use it
        const cloudData = docSnap.data()
        setState(cloudData)
        if (cloudData.initialized) {
          setScreen('home')
        }
        // Also save to localStorage as backup
        localStorage.setItem('soloLevelingState', JSON.stringify(cloudData))
      } else {
        // No data in Firestore - check localStorage
        const saved = localStorage.getItem('soloLevelingState')
        if (saved) {
          const localData = JSON.parse(saved)
          // Push local data to Firestore for syncing
          await setDoc(doc(db, 'users', uid), localData)
          setState(localData)
          if (localData.initialized) {
            setScreen('home')
          }
        }
      }
    } catch (e) {
      console.error('Error loading data:', e)
      // Fallback to localStorage
      const saved = localStorage.getItem('soloLevelingState')
      if (saved) {
        setState(JSON.parse(saved))
        if (JSON.parse(saved).initialized) {
          setScreen('home')
        }
      }
    }
    setLoading(false)
  }

  const saveData = async (newState) => {
    setState(newState)
    
    // Always save to localStorage first
    localStorage.setItem('soloLevelingState', JSON.stringify(newState))
    
    // Then try to save to Firestore
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), newState, { merge: true })
        console.log('Saved to Firestore successfully')
      } catch (e) {
        console.error('Firebase save failed:', e)
      }
    }
  }

  // ==========================================
  // AUTH FUNCTIONS
  // ==========================================
  const signIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider)
      showToast('✅', 'Welcome, Hunter!')
    } catch (e) {
      console.error('Sign in error:', e)
      let errorMessage = 'Sign in failed'
      if (e.code === 'auth/operation-not-allowed') {
        errorMessage = 'Google sign-in not enabled in Firebase'
      } else if (e.code === 'auth/unauthorized-domain') {
        errorMessage = 'Domain not authorized - check Firebase settings'
      } else if (e.code === 'auth/popup-blocked') {
        errorMessage = 'Popup blocked - allow popups for this site'
      }
      showToast('❌', errorMessage)
    }
  }

  const signOutUser = async () => {
    await signOut(auth)
    setScreen('splash')
  }

  // ==========================================
  // GAME FUNCTIONS
  // ==========================================
  const showToast = (icon, message) => {
    setToast({ icon, message })
    setTimeout(() => setToast(null), 3000)
  }

  const getRequiredXP = (level) => 100 + (level - 1) * 50
  const getCurrentRank = () => RANKS.filter(r => state.totalXP >= r.minXP).pop() || RANKS[0]
  const getStatIcon = (s) => ({ strength: '💪', intelligence: '🧠', discipline: '🎯', focus: '⚡', vitality: '❤️', willpower: '🔥', charisma: '✨' }[s] || '⭐')
  const getStatName = (s) => ({ strength: 'STR', intelligence: 'INT', discipline: 'DIS', focus: 'FOC', vitality: 'VIT', willpower: 'WIL', charisma: 'CHA' }[s] || s.toUpperCase())

  const completeOnboarding = () => {
    const templates = QUEST_TEMPLATES[state.path] || QUEST_TEMPLATES.monarch
    const quests = templates.map((t, i) => ({
      id: `quest_${i}_${Date.now()}`,
      title: t.title,
      stat: t.stat,
      difficulty: t.difficulty,
      xp: DIFFICULTY_XP[t.difficulty],
      coins: DIFFICULTY_COINS[t.difficulty],
      statValue: Math.ceil(DIFFICULTY_XP[t.difficulty] / 5),
      completed: false,
      streak: 0,
      icon: getStatIcon(t.stat)
    }))

    const newState = {
      ...state,
      quests,
      initialized: true,
      lastActive: new Date().toISOString().split('T')[0]
    }
    saveData(newState)
    setScreen('home')
    showToast('⚔️', 'Your journey begins!')
  }

  const completeQuest = async (questId) => {
    const quest = state.quests.find(q => q.id === questId)
    if (!quest || quest.completed) return

    const xpEarned = quest.xp
    const coinsEarned = quest.coins
    let newState = {
      ...state,
      quests: state.quests.map(q => q.id === questId ? { ...q, completed: true, streak: (q.streak || 0) + 1 } : q),
      totalQuests: state.totalQuests + 1,
      currentXP: state.currentXP + xpEarned,
      totalXP: state.totalXP + xpEarned,
      coins: state.coins + coinsEarned,
      stats: { ...state.stats, [quest.stat]: (state.stats[quest.stat] || 0) + quest.statValue }
    }

    // Level up check
    const requiredXP = getRequiredXP(newState.level)
    if (newState.currentXP >= requiredXP) {
      newState.currentXP -= requiredXP
      newState.level++
      newState.coins += 50
      showToast('⚔️', `Level Up! Level ${newState.level}`)
    }

    // Rank check
    const newRank = getCurrentRank()
    if (newRank.name !== state.rank) {
      newState.rank = newRank.name
      showToast('🏅', `Rank Up! ${newRank.name}`)
    }

    // Achievement check
    const newAchievements = [...newState.achievements]
    if (newState.totalQuests >= 1 && !newAchievements.includes('first_quest')) newAchievements.push('first_quest')
    if (newState.totalQuests >= 10 && !newAchievements.includes('quest_10')) newAchievements.push('quest_10')
    if (newState.totalQuests >= 50 && !newAchievements.includes('quest_50')) newAchievements.push('quest_50')
    if (newState.level >= 5 && !newAchievements.includes('level_5')) newAchievements.push('level_5')
    if (newState.level >= 10 && !newAchievements.includes('level_10')) newAchievements.push('level_10')
    newState.achievements = newAchievements

    saveData(newState)
    showToast('✅', `+${xpEarned} XP, +${coinsEarned} coins`)
  }

  const undoQuest = async (questId) => {
    const quest = state.quests.find(q => q.id === questId)
    if (!quest || !quest.completed) return

    const newState = {
      ...state,
      quests: state.quests.map(q => q.id === questId ? { ...q, completed: false, streak: Math.max(0, (q.streak || 0) - 1) } : q),
      totalQuests: Math.max(0, state.totalQuests - 1),
      currentXP: Math.max(0, state.currentXP - quest.xp),
      totalXP: Math.max(0, state.totalXP - quest.xp),
      coins: Math.max(0, state.coins - quest.coins),
      stats: { ...state.stats, [quest.stat]: Math.max(0, (state.stats[quest.stat] || 0) - quest.statValue) }
    }
    saveData(newState)
    showToast('↩️', 'Quest undone')
  }

  const addQuest = async () => {
    const name = prompt('Quest name:')
    if (!name) return
    const diff = prompt('Difficulty? (easy/normal/hard/elite/boss)', 'normal')
    const stat = prompt('Stat? (strength/intelligence/discipline/focus/vitality/willpower)', 'discipline')
    
    const newQuest = {
      id: `quest_${Date.now()}`,
      title: name,
      stat,
      difficulty: diff,
      xp: DIFFICULTY_XP[diff] || 20,
      coins: DIFFICULTY_COINS[diff] || 10,
      statValue: Math.ceil((DIFFICULTY_XP[diff] || 20) / 5),
      completed: false,
      streak: 0,
      icon: getStatIcon(stat)
    }

    const newState = { ...state, quests: [...state.quests, newQuest] }
    saveData(newState)
    showToast('✅', 'Quest added!')
  }

  // ==========================================
  // AI FUNCTIONS
  // ==========================================
  const getContext = () => `User: ${state.username}, Level: ${state.level}, Rank: ${state.rank}, Streak: ${state.streak} days, Total XP: ${state.totalXP}, Path: ${state.path}, Goals: ${state.goals.join(', ')}`

  const askAI = async (message) => {
    setChatLoading(true)
    setChatMessages(prev => [...prev, { role: 'user', content: message }])

    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: `You are an ancient AI Oracle guiding a user in a gamified habit tracker. Keep responses short (2-3 sentences), motivating, and actionable. Current context: ${getContext()}` },
            ...chatMessages,
            { role: 'user', content: message }
          ],
          temperature: 0.7,
          max_tokens: 256
        })
      })
      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || 'The Oracle is silent for now.'
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'The Oracle has lost connection. Please try again.' }])
    }
    setChatLoading(false)
  }

  const getSuggestions = () => {
    askAI('Based on my profile, suggest 3 personalized quests I should add to my quest board.')
  }

  // ==========================================
  // RENDER
  // ==========================================
  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 18) return 'Good Afternoon'
    return 'Good Evening'
  }

  const dailyQuests = state.quests.filter(q => !q.completed)
  const completedCount = state.quests.filter(q => q.completed).length
  const rank = getCurrentRank()
  const requiredXP = getRequiredXP(state.level)

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="app">
      {/* Toast */}
      {toast && (
        <div className="toast">
          <span>{toast.icon}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Splash Screen */}
      {screen === 'splash' && (
        <div className="splash">
          <div className="splash-content">
            <div className="splash-icon">⚔️</div>
            <h1>Solo Leveling</h1>
            <p>Turn your life into a leveling system</p>
            <button className="btn-primary" onClick={signIn}>
              <span>🔵</span> Sign in with Google
            </button>
            <p className="hint">Sign in to sync your progress across all devices</p>
            <button className="btn-guest" onClick={() => { localStorage.setItem('soloLevelingState', JSON.stringify({...state, initialized: true})); setScreen('onboarding') }}>
              Continue as Guest
            </button>
          </div>
        </div>
      )}

      {/* Onboarding */}
      {screen === 'onboarding' && (
        <div className="onboarding">
          {slide === 1 && (
            <div className="slide">
              <div className="slide-icon">⚔️</div>
              <h1>Begin Your Journey</h1>
              <p>Complete quests, earn XP, level up, and become stronger through daily discipline.</p>
              <button className="btn-primary" onClick={() => setSlide(2)}>Continue</button>
            </div>
          )}

          {slide === 2 && (
            <div className="slide">
              <h2>Choose Your Goals</h2>
              <div className="goals-grid">
                {['fitness', 'study', 'productivity', 'health'].map(g => (
                  <div key={g} className={`goal-card ${state.goals.includes(g) ? 'selected' : ''}`}
                    onClick={() => {
                      const goals = state.goals.includes(g) ? state.goals.filter(x => x !== g) : [...state.goals, g]
                      setState(s => ({ ...s, goals }))
                    }}>
                    <span className="goal-icon">{{ fitness: '💪', study: '📚', productivity: '⚡', health: '❤️' }[g]}</span>
                    <span>{g.charAt(0).toUpperCase() + g.slice(1)}</span>
                  </div>
                ))}
              </div>
              <button className="btn-secondary" onClick={() => setSlide(1)}>Back</button>
              <button className="btn-primary" onClick={() => setSlide(3)}>Continue</button>
            </div>
          )}

          {slide === 3 && (
            <div className="slide">
              <h2>Choose Your Path</h2>
              <div className="path-grid">
                {[
                  { id: 'warrior', icon: '⚔️', name: 'Warrior', desc: 'Fitness focus' },
                  { id: 'scholar', icon: '📖', name: 'Scholar', desc: 'Knowledge focus' },
                  { id: 'assassin', icon: '🌙', name: 'Assassin', desc: 'Focus mastery' },
                  { id: 'guardian', icon: '🛡️', name: 'Guardian', desc: 'Health focus' },
                  { id: 'monarch', icon: '👑', name: 'Monarch', desc: 'Balanced growth' }
                ].map(p => (
                  <div key={p.id} className={`path-card ${state.path === p.id ? 'selected' : ''}`}
                    onClick={() => setState(s => ({ ...s, path: p.id }))}>
                    <span className="path-icon">{p.icon}</span>
                    <strong>{p.name}</strong>
                    <small>{p.desc}</small>
                  </div>
                ))}
              </div>
              <button className="btn-secondary" onClick={() => setSlide(2)}>Back</button>
              <button className="btn-primary" onClick={() => setSlide(4)} disabled={!state.path}>Continue</button>
            </div>
          )}

          {slide === 4 && (
            <div className="slide">
              <h2>Create Your Identity</h2>
              <div className="avatar-grid">
                {['🧙', '⚔️', '🏹', '🛡️', '👑', '🦊', '🐉', '🌟'].map(a => (
                  <div key={a} className={`avatar ${state.avatar === a ? 'selected' : ''}`}
                    onClick={() => setState(s => ({ ...s, avatar: a }))}>
                    {a}
                  </div>
                ))}
              </div>
              <input
                type="text"
                placeholder="Enter your Hunter name"
                value={state.username}
                onChange={e => setState(s => ({ ...s, username: e.target.value }))}
                maxLength={20}
              />
              <button className="btn-secondary" onClick={() => setSlide(3)}>Back</button>
              <button className="btn-primary" onClick={completeOnboarding} disabled={!state.username}>Begin Journey</button>
            </div>
          )}
        </div>
      )}

      {/* Home Screen */}
      {screen === 'home' && (
        <div className="home">
          <header className="home-header">
            <div>
              <p className="greeting">{greeting()}</p>
              <h1>{state.username}</h1>
            </div>
            <button className="avatar-btn" onClick={signOutUser}>{state.avatar}</button>
          </header>

          <div className="level-card">
            <div className="level-badge">{state.level}</div>
            <div className="xp-section">
              <div className="xp-bar">
                <div className="xp-fill" style={{ width: `${(state.currentXP / requiredXP) * 100}%` }}></div>
              </div>
              <span>{state.currentXP} / {requiredXP} XP</span>
            </div>
            <div className="rank-coins">
              <span className="rank-badge" style={{ borderColor: rank.color }}>
                <span className="rank-dot" style={{ background: rank.color }}></span>
                {rank.name}
              </span>
              <span className="coins">🪙 {state.coins}</span>
            </div>
          </div>

          <div className="streak-banner">
            <span className="streak-icon">🔥</span>
            <div>
              <strong>{state.streak} Day Streak</strong>
              <small>{completedCount}/{state.quests.length} quests today</small>
            </div>
          </div>

          <div className="stats-row">
            {Object.entries(state.stats).slice(0, 4).map(([s, v]) => (
              <div key={s} className="stat">
                <span>{getStatIcon(s)}</span>
                <strong>{v}</strong>
                <small>{getStatName(s)}</small>
              </div>
            ))}
          </div>

          <div className="section">
            <h2>Daily Quests</h2>
            <div className="quest-list">
              {state.quests.length === 0 ? (
                <p className="empty">No quests yet. Tap + to create one!</p>
              ) : (
                state.quests.map(q => (
                  <div key={q.id} className={`quest ${q.completed ? 'done' : ''}`}>
                    <span className="quest-icon">{q.icon}</span>
                    <div className="quest-info">
                      <strong>{q.title}</strong>
                      <small>
                        <span className={`diff diff-${q.difficulty}`}>{DIFFICULTY_LABEL[q.difficulty]}</span>
                        {getStatName(q.stat)} +{q.statValue}
                      </small>
                    </div>
                    <div className="quest-rewards">
                      <span className="xp">+{q.xp}</span>
                      <span className="coins">+{q.coins} 🪙</span>
                    </div>
                    <button className={`check ${q.completed ? 'done' : ''}`} onClick={() => q.completed ? undoQuest(q.id) : completeQuest(q.id)}>
                      {q.completed ? '↩️' : '○'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <button className="fab" onClick={addQuest}>+</button>

          <nav className="bottom-nav">
            <div className="nav-item active"><span>🏠</span><small>Home</small></div>
            <div className="nav-item" onClick={getSuggestions}><span>🤖</span><small>AI</small></div>
            <div className="nav-item" onClick={() => setChatOpen(true)}><span>💬</span><small>Chat</small></div>
            <div className="nav-item" onClick={() => setScreen('profile')}><span>👤</span><small>Profile</small></div>
          </nav>
        </div>
      )}

      {/* Profile Screen */}
      {screen === 'profile' && (
        <div className="profile">
          <button className="back" onClick={() => setScreen('home')}>← Back</button>
          
          <div className="profile-header">
            <div className="profile-avatar">{state.avatar}</div>
            <h1>{state.username}</h1>
            <p className="title">{state.title}</p>
            <div className="profile-stats">
              <div><strong>{state.level}</strong><small>Level</small></div>
              <div><strong>{state.totalXP}</strong><small>Total XP</small></div>
              <div><strong>{state.totalQuests}</strong><small>Quests</small></div>
              <div><strong>{state.bestStreak}</strong><small>Best Streak</small></div>
            </div>
          </div>

          <div className="section">
            <h2>All Stats</h2>
            <div className="stats-grid">
              {Object.entries(state.stats).map(([s, v]) => (
                <div key={s} className="stat-card">
                  <span>{getStatIcon(s)} {s}</span>
                  <strong>{v}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <h2>Achievements</h2>
            <div className="achievements">
              {ACHIEVEMENTS.map(a => (
                <div key={a.id} className={`achievement ${state.achievements.includes(a.id) ? '' : 'locked'}`}>
                  <span>{state.achievements.includes(a.id) ? a.icon : '🔒'}</span>
                  <small>{a.title}</small>
                </div>
              ))}
            </div>
          </div>

          <button className="btn-secondary" onClick={signOutUser}>Sign Out</button>
        </div>
      )}

      {/* Chat Modal */}
      {chatOpen && (
        <div className="chat">
          <div className="chat-header">
            <div>
              <h3>Oracle</h3>
              <small>AI Assistant</small>
            </div>
            <button onClick={() => setChatOpen(false)}>×</button>
          </div>
          <div className="chat-messages">
            {chatMessages.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>{m.content}</div>
            ))}
            {chatLoading && <div className="message assistant">Thinking...</div>}
            <div ref={chatEndRef} />
          </div>
          <div className="chat-input">
            <input
              type="text"
              placeholder="Ask the Oracle..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && chatInput && !chatLoading && (askAI(chatInput), setChatInput(''))}
            />
            <button onClick={() => chatInput && !chatLoading && (askAI(chatInput), setChatInput(''))} disabled={chatLoading}>➤</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
