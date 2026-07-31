/**
 * FocusTube - Firebase & API Configuration
 * Supports dynamic configuration via localStorage or hardcoded credentials.
 */

// Default configuration - Replace these with your actual keys if you want to hardcode them.
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const DEFAULT_YOUTUBE_API_KEY = "";

// State to store active configurations
window.FocusTubeConfig = {
  firebase: null,
  youtubeApiKey: "",
  isMockMode: true,
  disablePlayerApi: false,
  firebaseApp: null,
  db: null,
  auth: null
};

// Load configuration from localStorage or defaults
function loadConfiguration() {
  let storedFirebase = localStorage.getItem("focustube_firebase_config");
  let storedYoutube = localStorage.getItem("focustube_youtube_api_key");
  let storedDisablePlayerApi = localStorage.getItem("focustube_disable_player_api") === "true";

  let firebaseConfig = null;
  let youtubeApiKey = "";

  if (storedFirebase) {
    try {
      firebaseConfig = JSON.parse(storedFirebase);
    } catch (e) {
      console.error("Error parsing stored Firebase config, using default", e);
    }
  }

  if (!firebaseConfig && DEFAULT_FIREBASE_CONFIG.apiKey) {
    firebaseConfig = DEFAULT_FIREBASE_CONFIG;
  }

  if (storedYoutube) {
    youtubeApiKey = storedYoutube;
  } else if (DEFAULT_YOUTUBE_API_KEY) {
    youtubeApiKey = DEFAULT_YOUTUBE_API_KEY;
  }

  window.FocusTubeConfig.firebase = firebaseConfig;
  window.FocusTubeConfig.youtubeApiKey = youtubeApiKey;
  window.FocusTubeConfig.disablePlayerApi = storedDisablePlayerApi;

  // If Firebase config is valid (has apiKey and projectId), we can disable Mock Mode for Firebase.
  // If YouTube API key is valid, we can fetch real YouTube data.
  const hasFirebase = firebaseConfig && 
                      firebaseConfig.apiKey && 
                      !firebaseConfig.apiKey.includes("PLACEHOLDER") && 
                      firebaseConfig.projectId && 
                      !firebaseConfig.projectId.includes("PLACEHOLDER");
  
  if (hasFirebase) {
    window.FocusTubeConfig.isMockMode = false;
  } else {
    window.FocusTubeConfig.isMockMode = true;
    console.warn("FocusTube: No Firebase configuration found. Running in local MOCK mode.");
  }

  // Filter placeholder YouTube key
  if (window.FocusTubeConfig.youtubeApiKey && window.FocusTubeConfig.youtubeApiKey.includes("PLACEHOLDER")) {
    window.FocusTubeConfig.youtubeApiKey = "";
  }
}

// Initialize Firebase if credentials exist
function initFirebase() {
  const config = window.FocusTubeConfig.firebase;
  if (window.FocusTubeConfig.isMockMode || !config) {
    setupMockFirebase();
    return;
  }

  try {
    // Initialize Firebase using the compat SDK loaded via CDN
    if (typeof firebase !== 'undefined') {
      const app = firebase.initializeApp(config);
      const db = firebase.firestore();
      const auth = firebase.auth();

      window.FocusTubeConfig.firebaseApp = app;
      window.FocusTubeConfig.db = db;
      window.FocusTubeConfig.auth = auth;

      console.log("FocusTube: Firebase initialized successfully.");

      // Silently sign in anonymously
      auth.signInAnonymously().catch((error) => {
        console.error("FocusTube: Anonymous authentication failed:", error);
      });
    } else {
      throw new Error("Firebase SDK not loaded from CDN.");
    }
  } catch (error) {
    console.error("FocusTube: Firebase initialization failed. Falling back to MOCK mode.", error);
    window.FocusTubeConfig.isMockMode = true;
    setupMockFirebase();
  }
}

// Mock Firestore / Auth interfaces for offline/no-credential usage
function setupMockFirebase() {
  console.log("FocusTube: Setting up local Mock Database.");
  
  // Mock auth state
  let mockCurrentUser = { uid: "mock_user_" + Math.random().toString(36).substr(2, 9) };
  
  // Local storage lists to simulate Firestore collections
  if (!localStorage.getItem("focustube_mock_chats")) {
    localStorage.setItem("focustube_mock_chats", JSON.stringify([
      { id: "1", username: "@StudyGuide", message: "Welcome to FocusTube Study Room! 📚 Claim your permanent handle to start chatting.", timestamp: Date.now() - 3600000 },
      { id: "2", username: "@AuraLearner", message: "Hey everyone! Anyone preparing for the data structures exam today?", timestamp: Date.now() - 1800000 },
      { id: "3", username: "@Pankaj_Study", message: "Yes! Working on Binary Search Trees right now. Let's study together!", timestamp: Date.now() - 600000 }
    ]));
  }
  
  if (!localStorage.getItem("focustube_mock_doubts")) {
    localStorage.setItem("focustube_mock_doubts", JSON.stringify([
      { id: "d1", videoId: "mock_bst", username: "@AuraLearner", timestamp: 125, message: "Why do we check if root is null here?", date: Date.now() - 7200000, replies: [{ username: "@StudyGuide", message: "Because if the tree is empty, we cannot traverse or search further! It stops recursion." }] },
      { id: "d2", videoId: "mock_bst", username: "@Pankaj_Study", timestamp: 340, message: "This explanation of tree balance factor is so clear.", date: Date.now() - 3600000, replies: [] }
    ]));
  }

  if (!localStorage.getItem("focustube_mock_handles")) {
    localStorage.setItem("focustube_mock_handles", JSON.stringify(["StudyGuide", "AuraLearner", "Pankaj_Study"]));
  }

  // Create mock API client
  window.FocusTubeConfig.db = {
    // Check if handle is taken in mock system
    isHandleTaken: async (handle) => {
      const handles = JSON.parse(localStorage.getItem("focustube_mock_handles") || "[]");
      return handles.map(h => h.toLowerCase()).includes(handle.toLowerCase());
    },
    
    // Register handle
    reserveHandle: async (handle) => {
      const handles = JSON.parse(localStorage.getItem("focustube_mock_handles") || "[]");
      if (handles.map(h => h.toLowerCase()).includes(handle.toLowerCase())) {
        throw new Error("Handle already taken");
      }
      handles.push(handle);
      localStorage.setItem("focustube_mock_handles", JSON.stringify(handles));
      return true;
    },

    // Global Chat mock subscription
    subscribeToChat: (callback) => {
      const loadChats = () => {
        const chats = JSON.parse(localStorage.getItem("focustube_mock_chats") || "[]");
        callback(chats.sort((a, b) => a.timestamp - b.timestamp));
      };
      
      loadChats();
      // Listen to changes in localStorage from other tabs, or set interval to simulate
      const interval = setInterval(loadChats, 2000);
      return () => clearInterval(interval);
    },

    // Send chat message
    sendChatMessage: async (username, message) => {
      const chats = JSON.parse(localStorage.getItem("focustube_mock_chats") || "[]");
      const newMsg = {
        id: "msg_" + Math.random().toString(36).substr(2, 9),
        username,
        message,
        timestamp: Date.now()
      };
      chats.push(newMsg);
      localStorage.setItem("focustube_mock_chats", JSON.stringify(chats));
      return newMsg;
    },

    // Subscribe to video doubts mock
    subscribeToDoubts: (videoId, callback) => {
      const loadDoubts = () => {
        const allDoubts = JSON.parse(localStorage.getItem("focustube_mock_doubts") || "[]");
        const filtered = allDoubts.filter(d => d.videoId === videoId);
        callback(filtered.sort((a, b) => a.timestamp - b.timestamp));
      };

      loadDoubts();
      const interval = setInterval(loadDoubts, 2000);
      return () => clearInterval(interval);
    },

    // Add video doubt
    addVideoDoubt: async (videoId, username, timestamp, message) => {
      const allDoubts = JSON.parse(localStorage.getItem("focustube_mock_doubts") || "[]");
      const newDoubt = {
        id: "doubt_" + Math.random().toString(36).substr(2, 9),
        videoId,
        username,
        timestamp,
        message,
        date: Date.now(),
        replies: []
      };
      allDoubts.push(newDoubt);
      localStorage.setItem("focustube_mock_doubts", JSON.stringify(allDoubts));
      return newDoubt;
    },

    // Reply to video doubt
    replyToDoubt: async (doubtId, username, replyMessage) => {
      const allDoubts = JSON.parse(localStorage.getItem("focustube_mock_doubts") || "[]");
      const doubtIndex = allDoubts.findIndex(d => d.id === doubtId);
      if (doubtIndex !== -1) {
        if (!allDoubts[doubtIndex].replies) {
          allDoubts[doubtIndex].replies = [];
        }
        allDoubts[doubtIndex].replies.push({
          username,
          message: replyMessage,
          date: Date.now()
        });
        localStorage.setItem("focustube_mock_doubts", JSON.stringify(allDoubts));
        return true;
      }
      throw new Error("Doubt not found");
    }
  };

  window.FocusTubeConfig.auth = {
    currentUser: mockCurrentUser
  };
}

// Function to update configuration dynamically and refresh
function updateCredentials(firebaseConfigObj, youtubeKey, disablePlayerApi) {
  if (firebaseConfigObj) {
    localStorage.setItem("focustube_firebase_config", JSON.stringify(firebaseConfigObj));
  } else {
    localStorage.removeItem("focustube_firebase_config");
  }

  if (youtubeKey !== undefined) {
    if (youtubeKey) {
      localStorage.setItem("focustube_youtube_api_key", youtubeKey);
    } else {
      localStorage.removeItem("focustube_youtube_api_key");
    }
  }

  if (disablePlayerApi !== undefined) {
    localStorage.setItem("focustube_disable_player_api", disablePlayerApi ? "true" : "false");
  }

  // Reload page to apply new config
  window.location.reload();
}

// Initialize config on script load
loadConfiguration();
document.addEventListener("DOMContentLoaded", initFirebase);
