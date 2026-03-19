import { useState, useEffect, useRef } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut, onAuthStateChanged, getRedirectResult, deleteUser } from 'firebase/auth'
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, getDocs, query, where, orderBy, serverTimestamp } from 'firebase/firestore'

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
// FIREBASE CHAT HELPERS
// ==========================================
const createChat = async (userId, title = 'New Chat') => {
  const chatRef = await addDoc(collection(db, 'chats'), {
    userId,
    title,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  })
  return chatRef.id
}

const saveChatMessage = async (chatId, message) => {
  await updateDoc(doc(db, 'chats', chatId), {
    messages: [...(await getChatMessages(chatId)), message],
    updatedAt: new Date().toISOString()
  })
}

const getChatMessages = async (chatId) => {
  const chatDoc = await getDoc(doc(db, 'chats', chatId))
  return chatDoc.exists() ? (chatDoc.data().messages || []) : []
}

const updateChatTitle = async (chatId, title) => {
  await updateDoc(doc(db, 'chats', chatId), {
    title,
    updatedAt: new Date().toISOString()
  })
}

const getUserChats = async (userId) => {
  const q = query(collection(db, 'chats'), where('userId', '==', userId), orderBy('updatedAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
}

const deleteUserChat = async (chatId) => {
  await deleteDoc(doc(db, 'chats', chatId))
}

const deleteAllUserChats = async (userId) => {
  const chats = await getUserChats(userId)
  await Promise.all(chats.map(chat => deleteDoc(doc(db, 'chats', chat.id))))
}

const deleteAllUserData = async (userId) => {
  try {
    await deleteDoc(doc(db, 'users', userId))
  } catch (e) {
    console.log('User doc delete skipped (may not exist)')
  }
  try {
    await deleteAllUserChats(userId)
  } catch (e) {
    console.log('Chats delete skipped')
  }
  localStorage.removeItem('soloLevelingState')
}

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

const CATEGORIES = [
  { id: 'fitness', icon: '💪', name: 'Fitness', stat: 'strength' },
  { id: 'study', icon: '📚', name: 'Study', stat: 'intelligence' },
  { id: 'productivity', icon: '⚡', name: 'Productivity', stat: 'focus' },
  { id: 'health', icon: '❤️', name: 'Health', stat: 'vitality' },
  { id: 'discipline', icon: '🎯', name: 'Discipline', stat: 'discipline' },
  { id: 'mindset', icon: '🧠', name: 'Mindset', stat: 'willpower' },
  { id: 'social', icon: '💬', name: 'Social', stat: 'charisma' }
]

const QUEST_TEMPLATES = {
  warrior: [
    { title: 'Morning Workout (30 min)', stat: 'strength', difficulty: 'normal', category: 'fitness' },
    { title: 'Push-ups x 20', stat: 'strength', difficulty: 'easy', category: 'fitness' },
    { title: 'Stretch for 10 min', stat: 'vitality', difficulty: 'easy', category: 'fitness' },
    { title: 'Cardio Session', stat: 'strength', difficulty: 'hard', category: 'fitness' },
    { title: 'Plank Hold 60 sec', stat: 'discipline', difficulty: 'easy', category: 'fitness' }
  ],
  scholar: [
    { title: 'Study Session (1 hour)', stat: 'intelligence', difficulty: 'normal', category: 'study' },
    { title: 'Read 20 Pages', stat: 'intelligence', difficulty: 'easy', category: 'study' },
    { title: 'Practice Problems', stat: 'focus', difficulty: 'normal', category: 'study' },
    { title: 'Review Notes', stat: 'intelligence', difficulty: 'easy', category: 'study' },
    { title: 'Watch Tutorial', stat: 'intelligence', difficulty: 'easy', category: 'study' }
  ],
  assassin: [
    { title: 'Deep Work (2 hours)', stat: 'focus', difficulty: 'hard', category: 'productivity' },
    { title: 'Clear Inbox', stat: 'discipline', difficulty: 'easy', category: 'productivity' },
    { title: 'No Phone 1 Hour', stat: 'willpower', difficulty: 'normal', category: 'discipline' },
    { title: 'Complete Priority Task', stat: 'focus', difficulty: 'normal', category: 'productivity' },
    { title: 'Plan Tomorrow', stat: 'discipline', difficulty: 'easy', category: 'productivity' }
  ],
  guardian: [
    { title: 'Healthy Meal', stat: 'vitality', difficulty: 'easy', category: 'health' },
    { title: 'Sleep by 11 PM', stat: 'vitality', difficulty: 'normal', category: 'health' },
    { title: 'Drink 2L Water', stat: 'vitality', difficulty: 'easy', category: 'health' },
    { title: 'Walk 30 min', stat: 'vitality', difficulty: 'easy', category: 'health' },
    { title: 'No Junk Food', stat: 'willpower', difficulty: 'normal', category: 'health' }
  ],
  monarch: [
    { title: 'Morning Routine', stat: 'discipline', difficulty: 'normal', category: 'discipline' },
    { title: 'Learn Something New', stat: 'intelligence', difficulty: 'easy', category: 'study' },
    { title: 'Meditate 10 min', stat: 'willpower', difficulty: 'easy', category: 'mindset' },
    { title: 'Evening Reflection', stat: 'focus', difficulty: 'easy', category: 'mindset' },
    { title: 'Connect with Someone', stat: 'charisma', difficulty: 'easy', category: 'social' }
  ]
}

// ==========================================
// MARKDOWN PARSER
// ==========================================
function parseMarkdown(text) {
  if (!text) return ''
  
  let html = text
    // Bold: **text** or *text*
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    // Italic: _text_
    .replace(/_(.*?)_/g, '<em>$1</em>')
    // Code: `text`
    .replace(/`(.*?)`/g, '<code>$1</code>')
    // Line breaks
    .replace(/\n/g, '<br/>')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
  
  // Wrap consecutive li elements in ul
  html = html.replace(/(<li>.*<\/li>)+/g, '<ul>$&</ul>')
  
  return html
}

// ==========================================
// NATURAL LANGUAGE PARSER
// ==========================================
function parseNaturalLanguage(input) {
  const text = input.toLowerCase().trim()
  
  let result = {
    title: input,
    stat: 'discipline',
    difficulty: 'normal',
    category: 'productivity',
    frequency: 'daily',
    target: '',
    xp: 20,
    coins: 10
  }
  
  // Detect category and stat
  if (text.match(/\b(read|study|book|course|learn|lecture|notes|tutorial)\b/)) {
    result.stat = 'intelligence'
    result.category = 'study'
  }
  if (text.match(/\b(gym|workout|exercise|running|run|jog|pushup|squat|fit|muscle|cardio|stretch)\b/)) {
    result.stat = 'strength'
    result.category = 'fitness'
  }
  if (text.match(/\b(sleep|water|healthy|meal|veg|fruit|vitamin|walk|rest|recover|energy)\b/)) {
    result.stat = 'vitality'
    result.category = 'health'
  }
  if (text.match(/\b(focus|deep work|productive|task|block|inbox|complete|finish)\b/)) {
    result.stat = 'focus'
    result.category = 'productivity'
  }
  if (text.match(/\b(meditat|calm|breathe|peace|relax|mindful)\b/)) {
    result.stat = 'willpower'
    result.category = 'mindset'
  }
  if (text.match(/\b(no |don't|don't|avoid|stop|quit|refrain)\b/)) {
    result.stat = 'willpower'
    result.category = 'discipline'
    result.title = input.replace(/^(no |don't |don't |avoid |stop )/i, '')
  }
  
  // Detect difficulty from keywords
  if (text.match(/\b(hard|tough|intense|extreme|challenging|1 hour|2 hour|30 min|60 min)\b/)) {
    result.difficulty = 'hard'
    result.xp = 35
    result.coins = 18
  }
  if (text.match(/\b(easy|quick|simple|5 min|10 min|short)\b/)) {
    result.difficulty = 'easy'
    result.xp = 10
    result.coins = 5
  }
  if (text.match(/\b(elite|master|pro|advanced|expert)\b/)) {
    result.difficulty = 'elite'
    result.xp = 60
    result.coins = 30
  }
  
  // Detect frequency
  if (text.match(/\b(daily|every day|each day|everyday)\b/)) {
    result.frequency = 'daily'
  }
  if (text.match(/\b(weekly|every week|once a week|3 times|5 times)\b/)) {
    result.frequency = 'weekly'
  }
  if (text.match(/\b(monthly|every month|once a month)\b/)) {
    result.frequency = 'monthly'
  }
  
  // Extract numbers
  const numberMatch = input.match(/\d+/)
  if (numberMatch) {
    result.target = numberMatch[0]
  }
  
  return result
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
  
  // Multi-chat states
  const [chatOpen, setChatOpen] = useState(false)
  const [chatListOpen, setChatListOpen] = useState(false)
  const [chats, setChats] = useState([])
  const [currentChatId, setCurrentChatId] = useState(null)
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Greetings, Hunter. I am your **AI Oracle**, here to guide your journey. Ask me anything about your habits, progress, or how to become stronger.' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const chatEndRef = useRef(null)
  
  // Task preview modal
  const [taskPreviewOpen, setTaskPreviewOpen] = useState(false)
  const [taskPreviewData, setTaskPreviewData] = useState(null)
  
  // Reset modal
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetConfirmInput, setResetConfirmInput] = useState('')
  
  // Edit quest modal
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingQuest, setEditingQuest] = useState(null)
  const [editForm, setEditForm] = useState({
    title: '', stat: 'discipline', category: 'productivity', difficulty: 'normal',
    frequency: 'daily', recurring: false, reminder: false
  })
  
  // Delete confirmation
  const [deleteConfirmQuest, setDeleteConfirmQuest] = useState(null)
  
  // More menu for swipe actions
  const [moreMenuQuest, setMoreMenuQuest] = useState(null)
  
  // Chat search
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [filteredChats, setFilteredChats] = useState([])
  
  // Quest filters
  const [questFilter, setQuestFilter] = useState('all') // all, daily, weekly, completed
  
  // Swipe state - mobile-optimized reveal pattern
  const [swipeState, setSwipeState] = useState({
    questId: null,
    offsetX: 0,
    stage: 'idle', // idle, dragging, revealed
    startX: 0,
    startY: 0,
    isScrolling: false
  })
  const swipeThreshold = 100
  
  // Add Quest Modal States
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addMode, setAddMode] = useState('quick') // quick, guided, ai
  const [quickInput, setQuickInput] = useState('')
  const [guidedStep, setGuidedStep] = useState(1)
  const [guidedData, setGuidedData] = useState({
    category: '',
    type: 'build',
    frequency: 'daily',
    target: '',
    difficulty: 'normal'
  })
  const [aiSuggestions, setAiSuggestions] = useState([])
  const [aiLoading, setAiLoading] = useState(false)
  
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
        setLoading(true)
        
        try {
          const docRef = doc(db, 'users', user.uid)
          const docSnap = await getDoc(docRef)
          
          if (docSnap.exists()) {
            const cloudData = docSnap.data()
            setState(cloudData)
            localStorage.setItem('soloLevelingState', JSON.stringify(cloudData))
            
            if (cloudData.initialized) {
              setScreen('home')
            } else {
              setScreen('onboarding')
              setSlide(1)
            }
          } else {
            const saved = localStorage.getItem('soloLevelingState')
            if (saved) {
              const localData = JSON.parse(saved)
              await setDoc(doc(db, 'users', user.uid), localData)
              setState(localData)
              
              if (localData.initialized) {
                setScreen('home')
              } else {
                setScreen('onboarding')
                setSlide(1)
              }
            } else {
              setScreen('onboarding')
              setSlide(1)
            }
          }
          
          // Load chats
          await loadUserChats(user.uid)
          const userChats = await getUserChats(user.uid)
          if (userChats.length > 0) {
            setCurrentChatId(userChats[0].id)
            if (userChats[0].messages?.length > 0) {
              setChatMessages(userChats[0].messages)
            }
          } else {
            const chatId = await createChat(user.uid, 'Getting Started')
            setCurrentChatId(chatId)
          }
          
          showToast('✅', 'Welcome, Hunter!')
        } catch (e) {
          console.error('Load data error:', e)
          // Fallback to local
          const saved = localStorage.getItem('soloLevelingState')
          if (saved) {
            setState(JSON.parse(saved))
            setScreen('home')
          } else {
            setScreen('onboarding')
            setSlide(1)
          }
        }
      } else {
        setUser(null)
        setScreen('splash')
        setChats([])
        setCurrentChatId(null)
      }
      setLoading(false)
    })
    
    return () => unsubscribe()
  }, [])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Filter chats based on search
  useEffect(() => {
    if (chatSearchQuery.trim() === '') {
      setFilteredChats(chats)
    } else {
      const query = chatSearchQuery.toLowerCase()
      const filtered = chats.filter(chat => {
        const titleMatch = chat.title?.toLowerCase().includes(query)
        const msgMatch = chat.messages?.some(m => 
          m.content?.toLowerCase().includes(query)
        )
        return titleMatch || msgMatch
      })
      setFilteredChats(filtered)
    }
  }, [chatSearchQuery, chats])

  // ==========================================
  // DATA FUNCTIONS
  // ==========================================
  const loadData = async (uid) => {
    setLoading(true)
    try {
      const docRef = doc(db, 'users', uid)
      const docSnap = await getDoc(docRef)
      
      if (docSnap.exists()) {
        const cloudData = docSnap.data()
        setState(cloudData)
        localStorage.setItem('soloLevelingState', JSON.stringify(cloudData))
        setLoading(false)
        return cloudData.initialized
      } else {
        const saved = localStorage.getItem('soloLevelingState')
        if (saved) {
          const localData = JSON.parse(saved)
          await setDoc(doc(db, 'users', uid), localData)
          setState(localData)
          setLoading(false)
          return localData.initialized
        }
      }
      setLoading(false)
      return false
    } catch (e) {
      console.error('Error loading data:', e)
      const saved = localStorage.getItem('soloLevelingState')
      if (saved) {
        const localData = JSON.parse(saved)
        setState(localData)
        setLoading(false)
        return localData.initialized
      }
      setLoading(false)
      return false
    }
  }

  const saveData = async (newState) => {
    setState(newState)
    localStorage.setItem('soloLevelingState', JSON.stringify(newState))
    
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid), newState, { merge: true })
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
      let errorMsg = 'Sign in failed'
      
      if (e.code === 'auth/unauthorized-domain') {
        errorMsg = 'Domain not authorized. Add vercel domain to Firebase.'
      } else if (e.code === 'auth/popup-blocked') {
        errorMsg = 'Popup blocked. Try again.'
      } else if (e.code === 'auth/network-request-failed') {
        errorMsg = 'Network error. Check connection.'
      } else if (e.code === 'auth/cancelled-popup-request') {
        errorMsg = 'Sign in cancelled.'
      } else {
        errorMsg = 'Sign in failed: ' + (e.message || 'Unknown error')
      }
      
      showToast('❌', errorMsg)
    }
  }

  const signInWithRedirect = async () => {
    try {
      await signInWithRedirect(auth, googleProvider)
    } catch (e) {
      console.error('Redirect sign in error:', e)
      showToast('❌', 'Redirect sign in failed')
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
      category: t.category,
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

    const requiredXP = getRequiredXP(newState.level)
    if (newState.currentXP >= requiredXP) {
      newState.currentXP -= requiredXP
      newState.level++
      newState.coins += 50
      showToast('⚔️', `Level Up! Level ${newState.level}`)
    }

    const newRank = getCurrentRank()
    if (newRank.name !== state.rank) {
      newState.rank = newRank.name
      showToast('🏅', `Rank Up! ${newRank.name}`)
    }

    const newAchievements = [...newState.achievements]
    if (newState.totalQuests >= 1 && !newAchievements.includes('first_quest')) newAchievements.push('first_quest')
    if (newState.totalQuests >= 10 && !newAchievements.includes('quest_10')) newAchievements.push('quest_10')
    if (newState.totalQuests >= 50 && !newAchievements.includes('quest_50')) newAchievements.push('quest_50')
    if (newState.level >= 5 && !newAchievements.includes('level_5')) newAchievements.push('level_5')
    if (newState.level >= 10 && !newAchievements.includes('level_10')) newAchievements.push('level_10')
    if (newState.streak >= 3 && !newAchievements.includes('streak_3')) newAchievements.push('streak_3')
    if (newState.streak >= 7 && !newAchievements.includes('streak_7')) newAchievements.push('streak_7')
    if (newRank.name !== 'Trainee' && !newAchievements.includes('rank_d')) newAchievements.push('rank_d')
    newState.achievements = newAchievements

    saveData(newState)
    showToast('✅', `+${xpEarned} XP, +${coinsEarned} coins`)
  }

  const undoQuest = async (questId) => {
    const quest = state.quests.find(q => q.id === questId)
    if (!quest || !quest.completed) return

    let newCurrentXP = state.currentXP - quest.xp
    let newLevel = state.level
    
    if (newCurrentXP < 0 && newLevel > 1) {
      newLevel--
      const prevRequiredXP = getRequiredXP(newLevel)
      newCurrentXP = prevRequiredXP + newCurrentXP
    } else if (newCurrentXP < 0) {
      newCurrentXP = 0
    }

    const newState = {
      ...state,
      quests: state.quests.map(q => q.id === questId ? { ...q, completed: false, streak: Math.max(0, (q.streak || 0) - 1) } : q),
      totalQuests: Math.max(0, state.totalQuests - 1),
      currentXP: Math.max(0, newCurrentXP),
      totalXP: Math.max(0, state.totalXP - quest.xp),
      level: newLevel,
      coins: Math.max(0, state.coins - quest.coins),
      stats: { ...state.stats, [quest.stat]: Math.max(0, (state.stats[quest.stat] || 0) - quest.statValue) }
    }
    saveData(newState)
    showToast('↩️', 'Quest undone')
  }

  // ==========================================
  // SWIPE & QUEST ACTIONS (REVEAL ON LEFT SWIPE)
  // ==========================================
  
  const closeAllSwipes = () => {
    setSwipeState({ questId: null, offsetX: 0, stage: 'idle', startX: 0, startY: 0, isScrolling: false })
  }

  const handleTouchStart = (e, questId) => {
    const touch = e.touches[0]
    setSwipeState(prev => ({
      ...prev,
      questId,
      startX: touch.clientX,
      startY: touch.clientY,
      isScrolling: false,
      stage: 'idle'
    }))
  }

  const handleTouchMove = (e) => {
    if (!swipeState.questId) return
    
    const touch = e.touches[0]
    const deltaX = swipeState.startX - touch.clientX
    const deltaY = touch.clientY - swipeState.startY
    
    // Detect scroll vs swipe - if vertical movement is greater, treat as scroll
    if (!swipeState.isScrolling && Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 15) {
      setSwipeState(prev => ({ ...prev, isScrolling: true }))
      return
    }
    
    // Only allow left swipe (deltaX > 0 means swiping left)
    if (deltaX <= 0) {
      if (swipeState.offsetX > 0) {
        setSwipeState(prev => ({ ...prev, offsetX: 0, stage: 'idle' }))
      }
      return
    }
    
    // Smooth tracking - card follows finger
    const newOffset = Math.min(deltaX, 160)
    const stage = newOffset >= swipeThreshold ? 'revealed' : 'dragging'
    
    setSwipeState(prev => ({
      ...prev,
      offsetX: newOffset,
      stage
    }))
  }

  const handleTouchEnd = () => {
    if (!swipeState.questId) return
    
    const { offsetX } = swipeState
    
    if (offsetX < swipeThreshold / 2) {
      // Snap back - not enough swipe
      setSwipeState(prev => ({ ...prev, offsetX: 0, stage: 'idle' }))
    } else {
      // Keep revealed
      setSwipeState(prev => ({ ...prev, offsetX: swipeThreshold, stage: 'revealed' }))
    }
  }

  const openSwipeActions = (questId) => {
    setSwipeState(prev => ({ ...prev, questId, offsetX: swipeThreshold, stage: 'revealed' }))
  }

  const openEditModal = (quest) => {
    setEditingQuest(quest)
    setEditForm({
      title: quest.title,
      stat: quest.stat,
      category: quest.category,
      difficulty: quest.difficulty,
      frequency: quest.frequency || 'daily',
      recurring: quest.recurring || false,
      reminder: quest.reminder || false
    })
    setEditModalOpen(true)
    closeAllSwipes()
  }

  const saveEditedQuest = () => {
    if (!editingQuest || !editForm.title.trim()) return
    
    const newQuests = state.quests.map(q => {
      if (q.id === editingQuest.id) {
        return {
          ...q,
          title: editForm.title,
          stat: editForm.stat,
          category: editForm.category,
          difficulty: editForm.difficulty,
          frequency: editForm.frequency,
          recurring: editForm.recurring,
          reminder: editForm.reminder,
          xp: DIFFICULTY_XP[editForm.difficulty],
          coins: DIFFICULTY_COINS[editForm.difficulty],
          statValue: Math.ceil(DIFFICULTY_XP[editForm.difficulty] / 5),
          icon: getStatIcon(editForm.stat)
        }
      }
      return q
    })
    
    const newState = { ...state, quests: newQuests }
    saveData(newState)
    setEditModalOpen(false)
    setEditingQuest(null)
    showToast('✏️', 'Quest updated!')
  }

  const confirmDeleteQuest = (quest) => {
    setDeleteConfirmQuest(quest)
    closeAllSwipes()
  }

  const deleteQuest = () => {
    if (!deleteConfirmQuest) return
    
    const newState = {
      ...state,
      quests: state.quests.filter(q => q.id !== deleteConfirmQuest.id)
    }
    saveData(newState)
    setDeleteConfirmQuest(null)
    showToast('🗑️', 'Quest deleted')
  }

  const skipQuest = (questId) => {
    const newState = {
      ...state,
      quests: state.quests.map(q => q.id === questId ? { ...q, skipped: true } : q)
    }
    saveData(newState)
    closeAllSwipes()
    showToast('⏭️', 'Quest skipped')
  }

  const pauseQuest = (questId) => {
    const quest = state.quests.find(q => q.id === questId)
    const newState = {
      ...state,
      quests: state.quests.map(q => q.id === questId ? { ...q, paused: !q.paused } : q)
    }
    saveData(newState)
    closeAllSwipes()
    showToast(quest?.paused ? '▶️' : '⏸️', quest?.paused ? 'Quest resumed' : 'Quest paused')
  }

  // ==========================================
  // ADD QUEST FUNCTIONS
  // ==========================================
  const openAddModal = () => setAddModalOpen(true)
  const closeAddModal = () => {
    setAddModalOpen(false)
    setAddMode('quick')
    setQuickInput('')
    setGuidedStep(1)
    setGuidedData({ category: '', type: 'build', frequency: 'daily', target: '', difficulty: 'normal' })
    setAiSuggestions([])
  }

  const handleQuickAdd = () => {
    if (!quickInput.trim()) return
    
    const parsed = parseNaturalLanguage(quickInput)
    const newQuest = {
      id: `quest_${Date.now()}`,
      title: parsed.title,
      stat: parsed.stat,
      category: parsed.category,
      difficulty: parsed.difficulty,
      xp: DIFFICULTY_XP[parsed.difficulty],
      coins: DIFFICULTY_COINS[parsed.difficulty],
      statValue: Math.ceil(DIFFICULTY_XP[parsed.difficulty] / 5),
      completed: false,
      streak: 0,
      icon: getStatIcon(parsed.stat)
    }

    const newState = { ...state, quests: [...state.quests, newQuest] }
    saveData(newState)
    showToast('✅', `Quest "${parsed.title}" added!`)
    closeAddModal()
  }

  const handleGuidedAdd = () => {
    const cat = CATEGORIES.find(c => c.id === guidedData.category) || CATEGORIES[0]
    const title = guidedData.target || `${guidedData.category} habit`
    
    const newQuest = {
      id: `quest_${Date.now()}`,
      title: title.charAt(0).toUpperCase() + title.slice(1),
      stat: cat.stat,
      category: guidedData.category,
      difficulty: guidedData.difficulty,
      xp: DIFFICULTY_XP[guidedData.difficulty],
      coins: DIFFICULTY_COINS[guidedData.difficulty],
      statValue: Math.ceil(DIFFICULTY_XP[guidedData.difficulty] / 5),
      completed: false,
      streak: 0,
      icon: cat.icon
    }

    const newState = { ...state, quests: [...state.quests, newQuest] }
    saveData(newState)
    showToast('✅', `Quest "${newQuest.title}" added!`)
    closeAddModal()
  }

  const handleAIGenerate = async () => {
    setAiLoading(true)
    
    const context = `User: ${state.username}, Level: ${state.level}, Rank: ${state.rank}, Streak: ${state.streak}, Stats: STR ${state.stats.strength}, INT ${state.stats.intelligence}, DIS ${state.stats.discipline}, FOC ${state.stats.focus}, VIT ${state.stats.vitality}, WIL ${state.stats.willpower}, CHA ${state.stats.charisma}, Path: ${state.path}, Goals: ${state.goals.join(', ')}`
    
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
            { role: 'system', content: `You are a helpful habit coach for a gamified self-improvement app. Generate 3 personalized daily quests for the user. Each quest should:
1. Have a clear, actionable title
2. Boost a relevant stat
3. Be realistic and achievable
4. Match the user's current level and capacity

Format your response as a JSON array like this:
[
  {"title": "Quest Title", "stat": "stat_name", "category": "category_id", "difficulty": "easy/normal/hard", "reason": "Why this helps the user"}
]

Current user context: ${context}` },
            { role: 'user', content: 'Generate 3 personalized quests for me based on my profile' }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      })
      
      const data = await response.json()
      const responseText = data.choices?.[0]?.message?.content || '[]'
      
      // Try to parse JSON from response
      let suggestions = []
      try {
        // Extract JSON array from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          suggestions = JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error('Parse error:', e)
      }
      
      setAiSuggestions(suggestions)
    } catch (e) {
      console.error('AI error:', e)
      showToast('❌', 'Failed to generate suggestions')
    }
    
    setAiLoading(false)
  }

  const addAISuggestion = (suggestion) => {
    const stat = suggestion.stat || 'discipline'
    const difficulty = suggestion.difficulty || 'normal'
    
    const newQuest = {
      id: `quest_${Date.now()}`,
      title: suggestion.title,
      stat: stat,
      category: suggestion.category || 'productivity',
      difficulty: difficulty,
      xp: DIFFICULTY_XP[difficulty],
      coins: DIFFICULTY_COINS[difficulty],
      statValue: Math.ceil(DIFFICULTY_XP[difficulty] / 5),
      completed: false,
      streak: 0,
      icon: getStatIcon(stat)
    }

    const newState = { ...state, quests: [...state.quests, newQuest] }
    saveData(newState)
    showToast('✅', `Quest "${suggestion.title}" added!`)
    setAiSuggestions(prev => prev.filter(s => s.title !== suggestion.title))
  }

  // ==========================================
  // MULTI-CHAT MANAGEMENT
  // ==========================================
  const loadUserChats = async (userId) => {
    try {
      const userChats = await getUserChats(userId)
      setChats(userChats)
    } catch (e) {
      console.error('Error loading chats:', e)
    }
  }

  const startNewChat = async () => {
    const chatId = await createChat(user.uid, 'New Chat')
    await loadUserChats(user.uid)
    setCurrentChatId(chatId)
    setChatMessages([
      { role: 'assistant', content: 'Greetings, Hunter. I am your **AI Oracle**, here to guide your journey. Ask me anything about your habits, progress, or how to become stronger.' }
    ])
    setChatListOpen(false)
    setChatOpen(true)
  }

  const switchToChat = async (chatId) => {
    setCurrentChatId(chatId)
    const chat = chats.find(c => c.id === chatId)
    if (chat && chat.messages) {
      setChatMessages(chat.messages.length > 0 ? chat.messages : [
        { role: 'assistant', content: 'Greetings, Hunter. I am your **AI Oracle**, here to guide your journey. Ask me anything about your habits, progress, or how to become stronger.' }
      ])
    }
    setChatListOpen(false)
  }

  const deleteChatById = async (chatId) => {
    await deleteUserChat(chatId)
    await loadUserChats(user.uid)
    if (currentChatId === chatId) {
      if (chats.length > 1) {
        const nextChat = chats.find(c => c.id !== chatId)
        if (nextChat) await switchToChat(nextChat.id)
      } else {
        await startNewChat()
      }
    }
    showToast('🗑️', 'Chat deleted')
  }

  const deleteAllChats = async () => {
    await deleteAllUserChats(user.uid)
    setChats([])
    await startNewChat()
    showToast('🗑️', 'All chats deleted')
  }

  const renameCurrentChat = async (newTitle) => {
    if (!currentChatId) return
    await updateChatTitle(currentChatId, newTitle)
    await loadUserChats(user.uid)
  }

  // ==========================================
  // AI CHAT FUNCTIONS
  // ==========================================
  const getContext = () => `User: ${state.username}, Level: ${state.level}, Rank: ${state.rank}, Streak: ${state.streak} days, Total XP: ${state.totalXP}, Stats: STR ${state.stats.strength}, INT ${state.stats.intelligence}, DIS ${state.stats.discipline}, FOC ${state.stats.focus}, VIT ${state.stats.vitality}, WIL ${state.stats.willpower}, CHA ${state.stats.charisma}, Path: ${state.path}, Goals: ${state.goals.join(', ')}`

  const extractActionsFromMessage = (message) => {
    const actions = []
    const text = message.toLowerCase()
    
    const taskPatterns = [
      { pattern: /read\s+(\d+)\s*pages?/i, title: 'Read {n} Pages', stat: 'intelligence', category: 'study', difficulty: 'easy' },
      { pattern: /study|learn|course|tutorial/i, title: 'Study Session', stat: 'intelligence', category: 'study', difficulty: 'normal' },
      { pattern: /workout|gym|exercise|fitness/i, title: 'Workout', stat: 'strength', category: 'fitness', difficulty: 'normal' },
      { pattern: /sleep.*(\d+)|(\d+).*sleep/i, title: 'Sleep by {t}', stat: 'vitality', category: 'health', difficulty: 'normal' },
      { pattern: /walk|jog|run|cardio/i, title: 'Cardio Session', stat: 'strength', category: 'fitness', difficulty: 'easy' },
      { pattern: /meditat|breath|calm/i, title: 'Meditation', stat: 'willpower', category: 'mindset', difficulty: 'easy' },
      { pattern: /water|hydrate/i, title: 'Drink Water', stat: 'vitality', category: 'health', difficulty: 'easy' },
      { pattern: /focus|deep work|concentrat/i, title: 'Deep Work', stat: 'focus', category: 'productivity', difficulty: 'normal' },
      { pattern: /no\s+junk|no\s+food|healthy/i, title: 'Eat Healthy', stat: 'willpower', category: 'health', difficulty: 'normal' },
    ]
    
    for (const p of taskPatterns) {
      if (p.pattern.test(text)) {
        actions.push({
          type: 'add_task',
          title: p.title,
          stat: p.stat,
          category: p.category,
          difficulty: p.difficulty,
          xp: DIFFICULTY_XP[p.difficulty],
          coins: DIFFICULTY_COINS[p.difficulty]
        })
        break
      }
    }
    
    const completedPatterns = [
      { pattern: /(?:just|already|did|finished|completed)\s+(?:a|my|the)?\s*(workout|gym|exercise)/i, match: 'workout', title: 'Workout', stat: 'strength', xp: DIFFICULTY_XP.normal, coins: DIFFICULTY_COINS.normal },
      { pattern: /(?:just|already|did|finished|completed)\s+(?:a|my|the)?\s*(study|studied|learning)/i, match: 'study', title: 'Study Session', stat: 'intelligence', xp: DIFFICULTY_XP.normal, coins: DIFFICULTY_COINS.normal },
      { pattern: /(?:just|already|did|finished|completed)\s+(?:a|my|the)?\s*(read|reading)/i, match: 'read', title: 'Read 20 Pages', stat: 'intelligence', xp: DIFFICULTY_XP.easy, coins: DIFFICULTY_COINS.easy },
      { pattern: /(?:slept|sleeping|went\s+to\s+bed)\s*(?:before|at|by)?\s*(\d+)/i, match: 'sleep', title: 'Early Sleep', stat: 'vitality', xp: DIFFICULTY_XP.normal, coins: DIFFICULTY_COINS.normal },
      { pattern: /(?:just|already|did|finished|completed)\s+(?:a|my|the)?\s*(walk|ran|jog)/i, match: 'cardio', title: 'Cardio Session', stat: 'strength', xp: DIFFICULTY_XP.easy, coins: DIFFICULTY_COINS.easy },
    ]
    
    for (const p of completedPatterns) {
      if (p.pattern.test(text)) {
        const matchingQuest = state.quests.find(q => q.title.toLowerCase().includes(p.match) && !q.completed)
        actions.push({
          type: 'mark_complete',
          questId: matchingQuest?.id || null,
          title: p.title,
          stat: p.stat,
          xp: p.xp,
          coins: p.coins,
          hasExistingQuest: !!matchingQuest
        })
        break
      }
    }
    
    return actions
  }

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return
    
    const userMessage = chatInput.trim()
    setChatInput('')
    const newMessages = [...chatMessages, { role: 'user', content: userMessage }]
    setChatMessages(newMessages)
    setChatLoading(true)

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
            { role: 'system', content: `You are an ancient AI Oracle guiding a user in a gamified habit tracker called Solo Leveling. 

IMPORTANT: When the user describes completing a task (e.g., "I worked out", "I studied for 2 hours", "I slept early"), acknowledge it and offer to log their completion.

When you recommend habits or tasks, keep responses short (2-3 sentences) and motivating. Use **bold** for important words.

Current user context: ${getContext()}` },
            ...newMessages.slice(0, -1),
            { role: 'user', content: userMessage }
          ],
          temperature: 0.7,
          max_tokens: 512
        })
      })
      const data = await response.json()
      const reply = data.choices?.[0]?.message?.content || 'The Oracle is silent for now.'
      
      const replyMessage = { role: 'assistant', content: reply }
      const finalMessages = [...newMessages, replyMessage]
      setChatMessages(finalMessages)
      
      const actions = extractActionsFromMessage(userMessage + ' ' + reply)
      if (actions.length > 0) {
        setPendingAction(actions[0])
      }
      
      if (currentChatId) {
        await setDoc(doc(db, 'chats', currentChatId), {
          messages: finalMessages,
          updatedAt: new Date().toISOString()
        }, { merge: true })
      }
    } catch (e) {
      setChatMessages([...newMessages, { role: 'assistant', content: 'The Oracle has lost connection. Please try again.' }])
    }
    setChatLoading(false)
  }

  const openTaskPreview = (action) => {
    if (action.type === 'add_task') {
      setTaskPreviewData({
        title: action.title,
        stat: action.stat,
        category: action.category,
        difficulty: action.difficulty,
        xp: action.xp,
        coins: action.coins,
        frequency: 'daily',
        statValue: Math.ceil(action.xp / 5),
        icon: getStatIcon(action.stat)
      })
    } else if (action.type === 'mark_complete') {
      setTaskPreviewData({
        ...action,
        icon: getStatIcon(action.stat)
      })
    }
    setTaskPreviewOpen(true)
    setPendingAction(null)
  }

  const applyPendingAction = (actionType) => {
    if (!pendingAction) return
    
    if (actionType === 'add_task') {
      openTaskPreview(pendingAction)
    } else if (actionType === 'mark_complete') {
      if (pendingAction.questId) {
        completeQuest(pendingAction.questId)
        showToast('✅', `${pendingAction.title} completed!`)
      } else {
        openTaskPreview(pendingAction)
      }
    }
    setPendingAction(null)
  }

  const saveTaskFromPreview = () => {
    if (!taskPreviewData) return
    
    if (taskPreviewData.type === 'mark_complete') {
      const xp = taskPreviewData.xp
      const coins = taskPreviewData.coins
      const newState = {
        ...state,
        totalQuests: state.totalQuests + 1,
        currentXP: state.currentXP + xp,
        totalXP: state.totalXP + xp,
        coins: state.coins + coins,
        stats: { ...state.stats, [taskPreviewData.stat]: (state.stats[taskPreviewData.stat] || 0) + Math.ceil(xp / 5) }
      }
      const requiredXP = getRequiredXP(newState.level)
      if (newState.currentXP >= requiredXP) {
        newState.currentXP -= requiredXP
        newState.level++
        newState.coins += 50
        showToast('⚔️', `Level Up! Level ${newState.level}`)
      }
      saveData(newState)
      showToast('✅', `+${xp} XP logged!`)
    } else {
      const newQuest = {
        id: `quest_${Date.now()}`,
        title: taskPreviewData.title,
        stat: taskPreviewData.stat,
        category: taskPreviewData.category,
        difficulty: taskPreviewData.difficulty,
        xp: taskPreviewData.xp,
        coins: taskPreviewData.coins,
        statValue: taskPreviewData.statValue,
        completed: false,
        streak: 0,
        icon: taskPreviewData.icon
      }
      const newState = { ...state, quests: [...state.quests, newQuest] }
      saveData(newState)
      showToast('✅', `Quest "${taskPreviewData.title}" added!`)
    }
    
    setTaskPreviewOpen(false)
    setTaskPreviewData(null)
  }

  // ==========================================
  // RESET FUNCTIONS
  // ==========================================
  const handleFullReset = async () => {
    if (resetConfirmInput.toUpperCase() !== 'RESET MY DATA') return
    
    try {
      await deleteAllUserData(user.uid)
      await signOut(auth).catch(() => {})
      localStorage.clear()
      setScreen('splash')
      setState({
        username: '', avatar: '🧙', path: '', goals: [], level: 1, currentXP: 0, totalXP: 0,
        coins: 0, rank: 'Trainee', title: 'Trainee Hunter', streak: 0, bestStreak: 0,
        stats: { strength: 0, intelligence: 0, discipline: 0, focus: 0, vitality: 0, willpower: 0, charisma: 0 },
        quests: [], totalQuests: 0, achievements: [], initialized: false
      })
      setChats([])
      setCurrentChatId(null)
      setResetModalOpen(false)
      setResetConfirmInput('')
      showToast('🔄', 'All data reset!')
    } catch (e) {
      console.error('Reset error:', e)
      localStorage.clear()
      setScreen('splash')
      showToast('🔄', 'Local data cleared!')
    }
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

  // Find weakest stat
  const weakestStat = Object.entries(state.stats).sort((a, b) => a[1] - b[1])[0]

  // Filter quests based on selected filter
  const filteredQuests = state.quests.filter(q => {
    if (questFilter === 'daily') return !q.completed && (q.frequency === 'daily' || !q.frequency)
    if (questFilter === 'completed') return q.completed
    return true
  })

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
            <button className="btn-guest" onClick={signInWithRedirect}>
              Having issues? Try redirect sign-in
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

          {weakestStat && weakestStat[1] < 20 && (
            <div className="weak-stat-banner">
              <span>💡</span>
              <div>
                <strong>Your {weakestStat[0]} is weak</strong>
                <small>Add habits to strengthen this stat</small>
              </div>
            </div>
          )}

          <div className="stats-panel">
            <div className="stats-panel-header">
              <span>HUNTER STATS</span>
              <span className="stats-level">LV.{state.level}</span>
            </div>
            <div className="stats-grid-full">
              {Object.entries(state.stats).map(([s, v]) => (
                <div key={s} className={`stat-item ${s === weakestStat?.[0] && v < 20 ? 'weak' : ''}`}>
                  <span className="stat-icon">{getStatIcon(s)}</span>
                  <span className="stat-label">{getStatName(s)}</span>
                  <span className="stat-value">{v}</span>
                  <div className="stat-bar">
                    <div className="stat-bar-fill" style={{ width: `${Math.min(100, v)}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section">
            <div className="section-header">
              <h2>Daily Quests</h2>
              <div className="quest-filters">
                <button className={`filter-btn ${questFilter === 'all' ? 'active' : ''}`} onClick={() => { setQuestFilter('all'); closeAllSwipes(); }}>All</button>
                <button className={`filter-btn ${questFilter === 'daily' ? 'active' : ''}`} onClick={() => { setQuestFilter('daily'); closeAllSwipes(); }}>Active</button>
                <button className={`filter-btn ${questFilter === 'completed' ? 'active' : ''}`} onClick={() => { setQuestFilter('completed'); closeAllSwipes(); }}>Done</button>
              </div>
            </div>
            
            <div className="quest-list" onClick={() => closeAllSwipes()}>
              {filteredQuests.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">⚔️</span>
                  <p>{questFilter === 'completed' ? 'No completed quests yet' : 'No quests yet'}</p>
                  <small>Tap + to create your first quest</small>
                </div>
              ) : (
                filteredQuests.map(q => {
                  const isSwiped = swipeState.questId === q.id
                  const offset = isSwiped ? swipeState.offsetX : 0
                  const isDeep = isSwiped && swipeState.stage === 'deep'
                  
                  return (
                    <div 
                      key={q.id} 
                      className={`quest-card ${q.completed ? 'completed' : ''} ${q.paused ? 'paused' : ''} ${isSwiped ? 'swiping' : ''} ${isDeep ? 'deep-swipe' : ''}`}
                      onTouchStart={(e) => !q.completed && handleTouchStart(e, q.id)}
                      onTouchMove={(e) => !q.completed && handleTouchMove(e)}
                      onTouchEnd={(e) => !q.completed && handleTouchEnd(e)}
                      onClick={(e) => { e.stopPropagation(); if (isSwiped && offset < swipeThreshold / 2) closeAllSwipes(); }}
                    >
                      <div className="quest-card-content" style={{ transform: `translateX(${offset}px)` }}>
                        <div className="quest-icon-wrapper">
                          <span className="quest-icon">{q.icon}</span>
                          {q.streak > 1 && <span className="streak-badge">🔥{q.streak}</span>}
                        </div>
                        <div className="quest-details">
                          <h4>{q.title}</h4>
                          <div className="quest-meta">
                            <span className={`diff-pill diff-${q.difficulty}`}>{q.difficulty}</span>
                            <span className="stat-tag">{getStatIcon(q.stat)} {getStatName(q.stat)}</span>
                            {q.recurring && <span className="recurring-tag">🔄</span>}
                          </div>
                        </div>
                        <div className="quest-rewards-mini">
                          <span className="xp-badge">+{q.xp}</span>
                        </div>
                        <button 
                          className={`check-btn ${q.completed ? 'done' : ''}`} 
                          onClick={(e) => { e.stopPropagation(); q.completed ? undoQuest(q.id) : completeQuest(q.id); }}
                        >
                          {q.completed ? '✓' : '○'}
                        </button>
                      </div>
                      
                      {isSwiped && (
                        <div className="swipe-panel">
                          <button 
                            className="swipe-action edit" 
                            onClick={(e) => { e.stopPropagation(); openEditModal(q); }}
                          >
                            <span>✏️</span>
                            <small>Edit</small>
                          </button>
                          <button 
                            className="swipe-action more" 
                            onClick={(e) => { e.stopPropagation(); setMoreMenuQuest(q); }}
                          >
                            <span>•••</span>
                            <small>More</small>
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <button className="fab" onClick={openAddModal}>+</button>

          <nav className="bottom-nav">
            <div className="nav-item active"><span>🏠</span><small>Home</small></div>
            <div className="nav-item" onClick={() => setChatOpen(true)}><span>💬</span><small>Oracle</small></div>
            <div className="nav-item" onClick={() => setScreen('profile')}><span>👤</span><small>Profile</small></div>
            <div className="nav-item" onClick={() => setScreen('settings')}><span>⚙️</span><small>Settings</small></div>
          </nav>
        </div>
      )}

      {/* Settings Screen */}
      {screen === 'settings' && (
        <div className="settings">
          <button className="back" onClick={() => setScreen('home')}>← Back</button>
          
          <div className="settings-header">
            <h1>Settings</h1>
          </div>

          <div className="settings-section">
            <h3>Account</h3>
            <div className="settings-card">
              <div className="settings-item" onClick={() => setScreen('profile')}>
                <span>👤</span>
                <div>
                  <strong>Profile</strong>
                  <small>View your stats and achievements</small>
                </div>
                <span className="arrow">›</span>
              </div>
              <div className="settings-item" onClick={signOutUser}>
                <span>🚪</span>
                <div>
                  <strong>Sign Out</strong>
                  <small>Sign out of your account</small>
                </div>
                <span className="arrow">›</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Privacy & Data</h3>
            <div className="settings-card danger">
              <div className="settings-item" onClick={() => setResetModalOpen(true)}>
                <span>⚠️</span>
                <div>
                  <strong>Reset All Data</strong>
                  <small>Permanently delete all your progress</small>
                </div>
                <span className="arrow">›</span>
              </div>
              <div className="settings-item" onClick={deleteAllChats}>
                <span>🗑️</span>
                <div>
                  <strong>Delete All AI Chats</strong>
                  <small>Remove all chat history</small>
                </div>
                <span className="arrow">›</span>
              </div>
              <div className="settings-item" onClick={() => setChatListOpen(true)}>
                <span>💬</span>
                <div>
                  <strong>Manage Chats</strong>
                  <small>View and delete individual chats</small>
                </div>
                <span className="arrow">›</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>About</h3>
            <div className="settings-card">
              <div className="settings-item">
                <span>⚔️</span>
                <div>
                  <strong>Solo Leveling Tracker</strong>
                  <small>Version 1.0.0</small>
                </div>
              </div>
            </div>
          </div>
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

      {/* Add Quest Modal */}
      {addModalOpen && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Quest</h2>
              <button className="modal-close" onClick={closeAddModal}>×</button>
            </div>

            <div className="modal-tabs">
              <button className={`tab ${addMode === 'quick' ? 'active' : ''}`} onClick={() => setAddMode('quick')}>Quick Add</button>
              <button className={`tab ${addMode === 'guided' ? 'active' : ''}`} onClick={() => setAddMode('guided')}>Guided</button>
              <button className={`tab ${addMode === 'ai' ? 'active' : ''}`} onClick={() => setAddMode('ai')}>✨ AI</button>
            </div>

            {/* Quick Add */}
            {addMode === 'quick' && (
              <div className="modal-content">
                <input
                  type="text"
                  placeholder="Type your habit... e.g., 'Read 10 pages' or 'Gym 3x week'"
                  value={quickInput}
                  onChange={e => setQuickInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleQuickAdd()}
                  autoFocus
                />
                <div className="quick-tips">
                  <small>Try: "Read 20 pages daily" or "No junk food today" or "Study 1 hour"</small>
                </div>
                <button className="btn-primary" onClick={handleQuickAdd} disabled={!quickInput.trim()}>Add Quest</button>
              </div>
            )}

            {/* Guided Add */}
            {addMode === 'guided' && (
              <div className="modal-content">
                {guidedStep === 1 && (
                  <div className="guided-step">
                    <h3>What do you want to improve?</h3>
                    <div className="category-grid">
                      {CATEGORIES.map(cat => (
                        <div key={cat.id} className={`cat-card ${guidedData.category === cat.id ? 'selected' : ''}`}
                          onClick={() => setGuidedData(d => ({ ...d, category: cat.id }))}>
                          <span>{cat.icon}</span>
                          <small>{cat.name}</small>
                        </div>
                      ))}
                    </div>
                    <button className="btn-primary" onClick={() => guidedData.category && setGuidedStep(2)} disabled={!guidedData.category}>Next</button>
                  </div>
                )}
                {guidedStep === 2 && (
                  <div className="guided-step">
                    <h3>How often?</h3>
                    <div className="freq-options">
                      {['daily', 'weekly', 'monthly'].map(f => (
                        <button key={f} className={`freq-btn ${guidedData.frequency === f ? 'selected' : ''}`}
                          onClick={() => setGuidedData(d => ({ ...d, frequency: f }))}>
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>
                    <div className="guided-buttons">
                      <button className="btn-secondary" onClick={() => setGuidedStep(1)}>Back</button>
                      <button className="btn-primary" onClick={() => setGuidedStep(3)}>Next</button>
                    </div>
                  </div>
                )}
                {guidedStep === 3 && (
                  <div className="guided-step">
                    <h3>Difficulty</h3>
                    <div className="diff-options">
                      {['easy', 'normal', 'hard'].map(d => (
                        <button key={d} className={`diff-btn ${guidedData.difficulty === d ? 'selected' : ''}`}
                          onClick={() => setGuidedData(dd => ({ ...dd, difficulty: d }))}>
                          <span className={`diff-badge diff-${d}`}>{DIFFICULTY_LABEL[d]}</span>
                          <small>{d.charAt(0).toUpperCase() + d.slice(1)} ({DIFFICULTY_XP[d]} XP)</small>
                        </button>
                      ))}
                    </div>
                    <div className="guided-buttons">
                      <button className="btn-secondary" onClick={() => setGuidedStep(2)}>Back</button>
                      <button className="btn-primary" onClick={handleGuidedAdd}>Add Quest</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Generate */}
            {addMode === 'ai' && (
              <div className="modal-content">
                {aiSuggestions.length === 0 && !aiLoading && (
                  <div className="ai-generate">
                    <p>Let AI generate personalized quests based on your stats and weak areas!</p>
                    <button className="btn-ai" onClick={handleAIGenerate}>✨ Generate For Me</button>
                    {weakestStat && (
                      <small className="ai-tip">Based on your weak {weakestStat[0]}, I'll suggest relevant quests.</small>
                    )}
                  </div>
                )}
                {aiLoading && (
                  <div className="ai-loading">
                    <div className="spinner"></div>
                    <p>Consulting the Oracle...</p>
                  </div>
                )}
                {aiSuggestions.map((sug, i) => (
                  <div key={i} className="ai-suggestion-card">
                    <h4>{sug.title}</h4>
                    <p className="ai-reason">{sug.reason}</p>
                    <div className="ai-suggestion-meta">
                      <span className={`diff diff-${sug.difficulty || 'normal'}`}>{DIFFICULTY_LABEL[sug.difficulty || 'normal']}</span>
                      <span>+{DIFFICULTY_XP[sug.difficulty || 'normal']} XP</span>
                      <span>{getStatName(sug.stat)} +{Math.ceil(DIFFICULTY_XP[sug.difficulty || 'normal'] / 5)}</span>
                    </div>
                    <button className="btn-add-suggestion" onClick={() => addAISuggestion(sug)}>Add Quest</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat List Sidebar */}
      {chatListOpen && (
        <div className="chat-sidebar-overlay" onClick={() => setChatListOpen(false)}>
          <div className="chat-sidebar" onClick={e => e.stopPropagation()}>
            <div className="chat-sidebar-header">
              <h3>Chat History</h3>
              <button onClick={() => setChatListOpen(false)}>×</button>
            </div>
            
            <div className="chat-search">
              <input
                type="text"
                placeholder="Search chats..."
                value={chatSearchQuery}
                onChange={e => setChatSearchQuery(e.target.value)}
              />
              {chatSearchQuery && (
                <button className="clear-search" onClick={() => setChatSearchQuery('')}>×</button>
              )}
            </div>
            
            <button className="new-chat-btn" onClick={startNewChat}>
              <span>✏️</span> New Chat
            </button>
            
            <div className="chat-suggestions">
              <span>Quick topics:</span>
              <button onClick={() => { setChatSearchQuery('focus'); setChatListOpen(false); setChatOpen(true); }}>Focus</button>
              <button onClick={() => { setChatSearchQuery('habits'); setChatListOpen(false); setChatOpen(true); }}>Habits</button>
              <button onClick={() => { setChatSearchQuery('routine'); setChatListOpen(false); setChatOpen(true); }}>Routine</button>
            </div>
            
            <div className="chat-list">
              {filteredChats.length === 0 ? (
                <div className="no-chats">
                  <p>{chatSearchQuery ? 'No chats found' : 'No chats yet'}</p>
                </div>
              ) : (
                filteredChats.map(chat => (
                  <div key={chat.id} className={`chat-list-item ${chat.id === currentChatId ? 'active' : ''}`} onClick={() => switchToChat(chat.id)}>
                    <div className="chat-list-info">
                      <strong>{chat.title || 'New Chat'}</strong>
                      <small>{chat.messages?.length || 0} messages • {chat.updatedAt ? new Date(chat.updatedAt).toLocaleDateString() : ''}</small>
                    </div>
                    <button className="chat-delete-btn" onClick={(e) => { e.stopPropagation(); deleteChatById(chat.id); }}>🗑️</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatOpen && (
        <div className="chat">
          <div className="chat-header">
            <div className="chat-header-left">
              <button className="chat-list-btn" onClick={() => setChatListOpen(true)}>☰</button>
              <div>
                <h3>{chats.find(c => c.id === currentChatId)?.title || 'Oracle'}</h3>
                <small>AI Assistant</small>
              </div>
            </div>
            <div className="chat-header-actions">
              <button className="chat-action-btn" onClick={startNewChat} title="New Chat">✏️</button>
              <button onClick={() => setChatOpen(false)}>×</button>
            </div>
          </div>
          <div className="chat-messages">
            {chatMessages.map((m, i) => (
              <div key={i} className={`message ${m.role}`}>
                <div dangerouslySetInnerHTML={{ __html: parseMarkdown(m.content) }} />
                {m.role === 'assistant' && i === chatMessages.length - 1 && pendingAction && (
                  <div className="action-buttons">
                    {pendingAction.type === 'add_task' && (
                      <button className="action-btn" onClick={() => applyPendingAction('add_task')}>
                        ➕ Add as Task
                      </button>
                    )}
                    {pendingAction.type === 'mark_complete' && (
                      <button className="action-btn success" onClick={() => applyPendingAction('mark_complete')}>
                        ✅ Mark Complete
                      </button>
                    )}
                  </div>
                )}
              </div>
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
              onKeyPress={e => e.key === 'Enter' && chatInput && !chatLoading && (sendChatMessage(), setChatInput(''))}
            />
            <button onClick={() => chatInput && !chatLoading && (sendChatMessage(), setChatInput(''))} disabled={chatLoading}>➤</button>
          </div>
        </div>
      )}

      {/* Task Preview Modal */}
      {taskPreviewOpen && taskPreviewData && (
        <div className="modal-overlay" onClick={() => setTaskPreviewOpen(false)}>
          <div className="task-preview-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{taskPreviewData.type === 'mark_complete' ? 'Log Completion' : 'Add Task'}</h2>
              <button onClick={() => setTaskPreviewOpen(false)}>×</button>
            </div>
            <div className="task-preview-content">
              <div className="task-preview-icon">{taskPreviewData.icon}</div>
              <h3>{taskPreviewData.title}</h3>
              
              <div className="task-preview-details">
                <div className="task-detail-row">
                  <span>Difficulty:</span>
                  <span className={`diff diff-${taskPreviewData.difficulty}`}>{taskPreviewData.difficulty?.toUpperCase() || 'NORMAL'}</span>
                </div>
                <div className="task-detail-row">
                  <span>XP Reward:</span>
                  <span className="xp-reward">+{taskPreviewData.xp} XP</span>
                </div>
                <div className="task-detail-row">
                  <span>Coin Reward:</span>
                  <span className="coin-reward">+{taskPreviewData.coins} 🪙</span>
                </div>
                <div className="task-detail-row">
                  <span>Primary Stat:</span>
                  <span>{getStatIcon(taskPreviewData.stat)} {getStatName(taskPreviewData.stat)}</span>
                </div>
              </div>
              
              {taskPreviewData.type === 'mark_complete' && taskPreviewData.hasExistingQuest && (
                <p className="task-preview-note">This will mark your existing quest as complete!</p>
              )}
            </div>
            <div className="task-preview-actions">
              <button className="btn-secondary" onClick={() => setTaskPreviewOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveTaskFromPreview}>
                {taskPreviewData.type === 'mark_complete' ? 'Log Completion' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="modal-overlay" onClick={() => setResetModalOpen(false)}>
          <div className="reset-modal" onClick={e => e.stopPropagation()}>
            <div className="reset-modal-icon">⚠️</div>
            <h2>Reset All Data?</h2>
            <p>This will permanently delete:</p>
            <ul className="reset-list">
              <li>Profile data & stats</li>
              <li>Levels, XP & rank progress</li>
              <li>All quests & habits</li>
              <li>Achievements & streaks</li>
              <li>Coins & inventory</li>
              <li>AI chat history</li>
            </ul>
            <p className="reset-warning">This action cannot be undone!</p>
            <input
              type="text"
              placeholder='Type "RESET MY DATA" to confirm'
              value={resetConfirmInput}
              onChange={e => setResetConfirmInput(e.target.value)}
              className="reset-input"
            />
            <div className="reset-actions">
              <button className="btn-secondary" onClick={() => { setResetModalOpen(false); setResetConfirmInput(''); }}>Cancel</button>
              <button className="btn-danger" onClick={handleFullReset} disabled={resetConfirmInput.toUpperCase() !== 'RESET MY DATA'}>
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Quest Modal */}
      {editModalOpen && editingQuest && (
        <div className="modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="edit-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Quest</h2>
              <button onClick={() => setEditModalOpen(false)}>×</button>
            </div>
            <div className="edit-modal-content">
              <div className="edit-field">
                <label>Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                  placeholder="Quest title..."
                />
              </div>
              
              <div className="edit-field">
                <label>Category</label>
                <div className="category-chips">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      className={`chip ${editForm.category === cat.id ? 'active' : ''}`}
                      onClick={() => setEditForm({ ...editForm, category: cat.id, stat: cat.stat })}
                    >
                      {cat.icon} {cat.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="edit-field">
                <label>Difficulty</label>
                <div className="diff-chips">
                  {['easy', 'normal', 'hard'].map(d => (
                    <button
                      key={d}
                      className={`chip ${editForm.difficulty === d ? 'active' : ''}`}
                      onClick={() => setEditForm({ ...editForm, difficulty: d })}
                    >
                      <span className={`diff-badge diff-${d}`}>{d[0].toUpperCase()}</span>
                      {DIFFICULTY_XP[d]} XP
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="edit-field">
                <label>Frequency</label>
                <div className="freq-chips">
                  {['daily', 'weekly', 'monthly'].map(f => (
                    <button
                      key={f}
                      className={`chip ${editForm.frequency === f ? 'active' : ''}`}
                      onClick={() => setEditForm({ ...editForm, frequency: f })}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="edit-field">
                <label className="toggle-label">
                  <span>Recurring</span>
                  <button
                    className={`toggle ${editForm.recurring ? 'on' : ''}`}
                    onClick={() => setEditForm({ ...editForm, recurring: !editForm.recurring })}
                  >
                    <span className="toggle-knob"></span>
                  </button>
                </label>
              </div>
              
              <div className="edit-preview">
                <span>Preview:</span>
                <div className="preview-card">
                  <span className="preview-icon">{getStatIcon(editForm.stat)}</span>
                  <div>
                    <strong>{editForm.title || 'Quest Title'}</strong>
                    <small>+{DIFFICULTY_XP[editForm.difficulty]} XP • {getStatName(editForm.stat)}</small>
                  </div>
                </div>
              </div>
            </div>
            <div className="edit-modal-actions">
              <button className="btn-secondary" onClick={() => setEditModalOpen(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveEditedQuest} disabled={!editForm.title.trim()}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmQuest && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmQuest(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">🗑️</div>
            <h2>Delete Quest?</h2>
            <p>Are you sure you want to delete "{deleteConfirmQuest.title}"?</p>
            <p className="confirm-warning">This cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-secondary" onClick={() => setDeleteConfirmQuest(null)}>Cancel</button>
              <button className="btn-danger" onClick={deleteQuest}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* More Menu Modal */}
      {moreMenuQuest && (
        <div className="modal-overlay" onClick={() => setMoreMenuQuest(null)}>
          <div className="more-menu" onClick={e => e.stopPropagation()}>
            <div className="more-menu-header">
              <h4>{moreMenuQuest.title}</h4>
              <button onClick={() => setMoreMenuQuest(null)}>×</button>
            </div>
            <div className="more-menu-actions">
              <button onClick={() => { pauseQuest(moreMenuQuest.id); setMoreMenuQuest(null); }}>
                <span>{moreMenuQuest.paused ? '▶️' : '⏸️'}</span>
                {moreMenuQuest.paused ? 'Resume Quest' : 'Pause Quest'}
              </button>
              <button onClick={() => { setEditForm({ ...editForm, recurring: !moreMenuQuest.recurring }); openEditModal(moreMenuQuest); setMoreMenuQuest(null); }}>
                <span>🔄</span>
                {moreMenuQuest.recurring ? 'Remove Recurring' : 'Make Recurring'}
              </button>
              <button className="danger" onClick={() => { confirmDeleteQuest(moreMenuQuest); setMoreMenuQuest(null); }}>
                <span>🗑️</span>
                Delete Quest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
