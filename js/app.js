/**
 * FocusTube - Core Application Logic
 * Integrates YouTube Data API v3, IFrame Player, Pomodoro, Notepad, and UI controls.
 */

// Global State
const FocusTubeApp = {
  currentVideo: null,
  activeTab: "video-notes",
  pomodoro: {
    timerId: null,
    timeLeft: 1500, // 25 minutes default
    totalDuration: 1500,
    isActive: false,
    mode: "study", // study, short-break, long-break
    sessionsCompleted: 0
  },
  searchFilters: {
    injectEducational: true,
    filterShorts: true
  },
  mockVideos: [
    {
      id: "hWtNP8mYuyw",
      title: "Binary Search Trees | Data Structures & Algorithms",
      channelTitle: "mycodeschool",
      description: "Introduction to Binary Search Tree (BST) data structure. Learn what is a BST, its properties, and look at some insert and search operations.",
      publishedAt: "2026-01-15T00:00:00Z",
      duration: "18:24",
      viewCount: "1,240,500",
      thumbnail: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=480&auto=format&fit=crop&q=60"
    },
    {
      id: "rfscVS0vtbw",
      title: "Learn Python - Full Course for Beginners [Tutorial]",
      channelTitle: "freeCodeCamp.org",
      description: "This course will give you a full introduction into all of the core concepts in Python. Follow along with the video to get started.",
      publishedAt: "2025-11-20T00:00:00Z",
      duration: "4:26:52",
      viewCount: "35,100,000",
      thumbnail: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=480&auto=format&fit=crop&q=60"
    },
    {
      id: "2Vf1D-yiUM0",
      title: "Firebase Firestore Tutorial - Real-time Database Setup",
      channelTitle: "The Net Ninja",
      description: "In this tutorial we'll look at the Cloud Firestore - a real-time, flexible database from Firebase. We will learn how to setup, query, and subscribe to data.",
      publishedAt: "2026-03-02T00:00:00Z",
      duration: "25:40",
      viewCount: "420,000",
      thumbnail: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=480&auto=format&fit=crop&q=60"
    },
    {
      id: "rg7Fvvl3taU",
      title: "CSS Grid & Flexbox - The Ultimate Layout Guide",
      channelTitle: "Web Dev Simplified",
      description: "Learn how to build modern, responsive layouts using CSS Grid and Flexbox. We go over all the properties and use cases in deep detail.",
      publishedAt: "2026-02-10T00:00:00Z",
      duration: "45:15",
      viewCount: "980,000",
      thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=480&auto=format&fit=crop&q=60"
    },
    {
      id: "386_WnL9Hw4",
      title: "How to Build Unshakeable Focus for Study & Deep Work",
      channelTitle: "Thomas Frank",
      description: "Struggling with distractions? Here are 5 practical, science-backed strategies to help you focus longer, eliminate phone distraction, and study effectively.",
      publishedAt: "2026-05-18T00:00:00Z",
      duration: "12:08",
      viewCount: "2,350,000",
      thumbnail: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=480&auto=format&fit=crop&q=60"
    },
    {
      id: "tWVWeJyCoFM",
      title: "Algorithms Course - Graph Traversals Explained (BFS & DFS)",
      channelTitle: "Algorithms Explained",
      description: "Understand the core concepts of Breadth-First Search (BFS) and Depth-First Search (DFS) with clear animations, step-by-step trace, and code examples.",
      publishedAt: "2026-04-05T00:00:00Z",
      duration: "30:45",
      viewCount: "185,000",
      thumbnail: "https://images.unsplash.com/photo-1618401471353-b98aedd07871?w=480&auto=format&fit=crop&q=60"
    }
  ]
};

// YouTube Iframe Player reference
let ytPlayer = null;
let currentDoubtUnsubscribe = null;

// Initialize on Load
document.addEventListener("DOMContentLoaded", () => {
  initApp();
  initPomodoro();
  initNotepad();
  initTheme();
  setupEventListeners();
  checkHandleIdentity();
});

// App Initialization
function initApp() {
  const hasYoutube = !!window.FocusTubeConfig.youtubeApiKey;
  const isMockFirebase = window.FocusTubeConfig.isMockMode;

  if (isMockFirebase) {
    console.warn("FocusTube: Firestore is running in offline simulation mode.");
  } else {
    console.log("FocusTube: Firestore is connected in live production mode.");
  }

  if (hasYoutube) {
    console.log("FocusTube: YouTube API search is running in live mode.");
  } else {
    console.warn("FocusTube: YouTube API search is running in mock mode.");
  }

  // Load default search results
  performSearch("");
}

// Check if user has claimed a handle. If not, open handle registration modal
function checkHandleIdentity() {
  const handle = window.ChatManager.getUserHandle();
  if (handle) {
    document.getElementById("nav-user-handle").textContent = handle;
    document.getElementById("profile-handle-display").textContent = handle;
    initChatAndDoubts();
  } else {
    // Show registration modal, disable closing until handle claimed
    const modal = document.getElementById("handle-modal");
    modal.classList.add("active");
  }
}

// Initialize Chat subscriptions once identity is confirmed
function initChatAndDoubts() {
  const chatMessagesContainer = document.getElementById("chat-messages");
  
  // Subscribe to real-time chat
  window.ChatManager.subscribeToGlobalChat((messages) => {
    chatMessagesContainer.innerHTML = "";
    const userHandle = window.ChatManager.getUserHandle();
    
    messages.forEach(msg => {
      const msgEl = document.createElement("div");
      const isSelf = msg.username === userHandle;
      msgEl.className = `chat-message ${isSelf ? 'self' : ''}`;
      
      const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      
      msgEl.innerHTML = `
        <div class="message-header">
          <span class="message-username">${msg.username}</span>
          <span class="message-time">${timeStr}</span>
        </div>
        <div class="message-bubble">${escapeHTML(msg.message)}</div>
      `;
      chatMessagesContainer.appendChild(msgEl);
    });
    
    // Scroll to bottom of chat
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  });
}

// Load Video and subscribe to its Doubts
function loadWatchVideo(video, triggerAutoplay = true) {
  FocusTubeApp.currentVideo = video;
  
  // Scroll the screen container to the top immediately (if user triggered playback)
  if (triggerAutoplay) {
    document.getElementById("screen-study").scrollTop = 0;
  }
  
  // Set details
  document.getElementById("watch-title").textContent = video.title;
  document.getElementById("watch-channel").textContent = video.channelTitle;
  
  // Load notes for this specific video
  loadVideoNotes(video.id);

  // Initialize/Update iframe player
  const playerContainer = document.getElementById("video-player-container");
  
  // Destroy old API instance if exists
  if (ytPlayer) {
    try {
      ytPlayer.destroy();
    } catch(e) {}
    ytPlayer = null;
  }
  
  playerContainer.innerHTML = "";
  
  // Create YouTube Iframe manually to apply strict-origin policies and use youtube-nocookie
  const iframe = document.createElement("iframe");
  iframe.id = "yt-player-iframe";
  
  iframe.style.width = "100%";
  iframe.style.height = "100%";
  iframe.style.border = "none";
  iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
  iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share");
  iframe.setAttribute("allowfullscreen", "true");

  const autoplayVal = triggerAutoplay ? "1" : "0";

  if (window.FocusTubeConfig.disablePlayerApi) {
    // Loaded without enablejsapi=1 or origin validation query params to bypass Error 153 sandbox restrictions
    iframe.src = `https://www.youtube-nocookie.com/embed/${video.id}?rel=0&autoplay=${autoplayVal}&modestbranding=1&iv_load_policy=3&fs=1`;
    playerContainer.appendChild(iframe);
    
    // Create simple mock player interface for doubt seeks
    ytPlayer = {
      seekTo: (seconds) => {
        iframe.src = `https://www.youtube-nocookie.com/embed/${video.id}?rel=0&autoplay=1&modestbranding=1&iv_load_policy=3&fs=1&start=${seconds}`;
      },
      destroy: () => {}
    };
    console.log("FocusTube: Player API disabled. Video loaded in sandbox-safe playback mode.");
  } else {
    // Calculate dynamic origin to prevent cross-origin message validation failures
    const originVal = window.location.protocol === 'file:' ? 'http://localhost' : window.location.origin;
    iframe.src = `https://www.youtube-nocookie.com/embed/${video.id}?enablejsapi=1&rel=0&autoplay=${autoplayVal}&modestbranding=1&iv_load_policy=3&fs=1&origin=${encodeURIComponent(originVal)}`;
    playerContainer.appendChild(iframe);
    
    // Initialize YT Player on the created iframe node
    ytPlayer = new YT.Player(iframe, {
      events: {
        'onReady': onPlayerReady
      }
    });
  }

  // Subscribe to doubts for this video
  if (currentDoubtUnsubscribe) {
    currentDoubtUnsubscribe();
  }

  const doubtsList = document.getElementById("doubts-list");
  doubtsList.innerHTML = `<div class="loading-doubts">Loading doubt queries...</div>`;

  currentDoubtUnsubscribe = window.ChatManager.subscribeToVideoDoubts(video.id, (doubts) => {
    renderDoubts(doubts);
  });
}

function onPlayerReady(event) {
  console.log("YouTube Player is ready");
}

// Render Video Doubts (Tied to Timestamps)
function renderDoubts(doubts) {
  const doubtsList = document.getElementById("doubts-list");
  doubtsList.innerHTML = "";

  if (doubts.length === 0) {
    doubtsList.innerHTML = `
      <div class="empty-state">
        <p>No study doubts asked for this lecture yet. Be the first to ask!</p>
      </div>
    `;
    return;
  }

  doubts.forEach(doubt => {
    const doubtEl = document.createElement("div");
    doubtEl.className = "doubt-card";
    doubtEl.dataset.id = doubt.id;

    const timeStr = formatTime(doubt.timestamp);
    const dateStr = new Date(doubt.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    let repliesHtml = "";
    if (doubt.replies && doubt.replies.length > 0) {
      repliesHtml = `
        <div class="doubt-replies">
          ${doubt.replies.map(reply => `
            <div class="reply-item">
              <div class="reply-meta">
                <span class="reply-username">${reply.username}</span>
                <span class="reply-date">${new Date(reply.date || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div class="reply-text">${escapeHTML(reply.message)}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    doubtEl.innerHTML = `
      <div class="doubt-main">
        <div class="doubt-meta">
          <span class="doubt-username">${doubt.username}</span>
          <span class="doubt-timestamp" onclick="seekPlayerTo(${doubt.timestamp})">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
            ${timeStr}
          </span>
          <span class="doubt-date">${dateStr}</span>
        </div>
        <div class="doubt-message">${escapeHTML(doubt.message)}</div>
        <button class="reply-btn btn-text" onclick="showReplyInput('${doubt.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Reply
        </button>
        
        <div class="reply-input-box hidden" id="reply-box-${doubt.id}">
          <input type="text" placeholder="Type clarification..." id="reply-input-${doubt.id}" onkeypress="handleReplyKeyPress(event, '${doubt.id}')">
          <button class="btn btn-primary btn-xs" onclick="submitDoubtReply('${doubt.id}')">Send</button>
        </div>
      </div>
      ${repliesHtml}
    `;
    doubtsList.appendChild(doubtEl);
  });
}

// Seek YouTube Player to a specific timestamp
function seekPlayerTo(seconds) {
  switchMobileTab("study");
  if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
    ytPlayer.seekTo(seconds, true);
    // Smooth scroll watch section back to top of video
    document.getElementById("video-player-container").scrollIntoView({ behavior: 'smooth' });
  }
}

// Show reply field
window.showReplyInput = function(doubtId) {
  const box = document.getElementById(`reply-box-${doubtId}`);
  box.classList.toggle("hidden");
  if (!box.classList.contains("hidden")) {
    document.getElementById(`reply-input-${doubtId}`).focus();
  }
};

// Handle key press inside reply inputs
window.handleReplyKeyPress = function(e, doubtId) {
  if (e.key === "Enter") {
    submitDoubtReply(doubtId);
  }
};

// Submit doubt reply
window.submitDoubtReply = async function(doubtId) {
  const input = document.getElementById(`reply-input-${doubtId}`);
  const text = input.value.trim();
  if (!text) return;

  try {
    input.disabled = true;
    await window.ChatManager.replyToDoubt(doubtId, text);
    input.value = "";
    input.disabled = false;
    document.getElementById(`reply-box-${doubtId}`).classList.add("hidden");
  } catch (err) {
    alert("Could not send reply: " + err.message);
    input.disabled = false;
  }
};

// Search Logic
async function performSearch(query) {
  const searchResultsGrid = document.getElementById("search-results-grid");
  searchResultsGrid.innerHTML = `
    <div class="searching-state">
      <div class="spinner"></div>
      <p>Filtering algorithms and indexing lectures...</p>
    </div>
  `;

  // Go to search view if not already there
  document.getElementById("search-results-section").classList.remove("hidden");
  document.getElementById("watch-section").classList.add("hidden");
  if (ytPlayer) {
    try { ytPlayer.stopVideo(); } catch(e) {}
  }

  // If no YouTube API Key is provided, use mock search results
  if (!window.FocusTubeConfig.youtubeApiKey) {
    setTimeout(() => {
      let filtered = FocusTubeApp.mockVideos;
      if (query.trim()) {
        const qLower = query.toLowerCase();
        filtered = FocusTubeApp.mockVideos.filter(v => 
          v.title.toLowerCase().includes(qLower) || 
          v.description.toLowerCase().includes(qLower) ||
          v.channelTitle.toLowerCase().includes(qLower)
        );
      }
      renderSearchResults(filtered);
    }, 600);
    return;
  }

  let searchQuery = query.trim();
  if (!searchQuery) {
    // If search is blank, pick a random high-quality college study topic
    const defaultTopics = [
      "computer science lecture",
      "data structures and algorithms",
      "mit open courseware physics",
      "linear algebra lecture",
      "organic chemistry course",
      "web development tutorial",
      "world history crash course"
    ];
    searchQuery = defaultTopics[Math.floor(Math.random() * defaultTopics.length)];
  }

  // Live YouTube API call
  try {
    const apiKey = window.FocusTubeConfig.youtubeApiKey;
    let finalQuery = searchQuery;

    // 1. Search Keyword Injection: Appends educational filters & negative exclusions
    if (FocusTubeApp.searchFilters.injectEducational) {
      finalQuery = `${searchQuery} (tutorial OR lecture OR course OR college OR explained) -marvel -dc -movie -entertainment -gaming -vlog -trailer -teaser -music -song -clips -reaction -meme`;
    }

    // Call YouTube search list
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(finalQuery)}&type=video&maxResults=15&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();

    if (searchData.error) {
      throw new Error(searchData.error.message);
    }

    const items = searchData.items || [];
    if (items.length === 0) {
      renderSearchResults([]);
      return;
    }

    // Extract video IDs to load contentDetails (duration details)
    const videoIds = items.map(item => item.id.videoId).join(",");
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics,snippet&id=${videoIds}&key=${apiKey}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData = await detailsRes.json();

    // Map responses to standard format
    let videos = (detailsData.items || []).map(item => {
      const parsedDuration = parseISO8601Duration(item.contentDetails.duration);
      return {
        id: item.id,
        title: item.snippet.title,
        channelTitle: item.snippet.channelTitle,
        description: item.snippet.description,
        publishedAt: item.snippet.publishedAt,
        duration: parsedDuration.formatted,
        durationSeconds: parsedDuration.totalSeconds,
        viewCount: parseInt(item.statistics.viewCount, 10).toLocaleString(),
        thumbnail: item.snippet.thumbnails.medium ? item.snippet.thumbnails.medium.url : item.snippet.thumbnails.default.url
      };
    });

    // 2. Shorts Filtering: Remove videos under 60 seconds
    if (FocusTubeApp.searchFilters.filterShorts) {
      videos = videos.filter(video => video.durationSeconds >= 60);
    }

    renderSearchResults(videos);
  } catch (error) {
    console.error("YouTube search API failed:", error);
    searchResultsGrid.innerHTML = `
      <div class="error-state">
        <p>API Call failed: ${error.message}</p>
        <p class="subtext">Make sure your YouTube API key is correct and has search quota, or switch back to Mock Mode in Settings.</p>
        <button class="btn btn-secondary btn-sm" onclick="openSettingsModal()">Open Credentials Settings</button>
      </div>
    `;
  }
}

// Render video cards
function renderSearchResults(videos) {
  const searchResultsGrid = document.getElementById("search-results-grid");
  searchResultsGrid.innerHTML = "";

  if (videos.length === 0) {
    searchResultsGrid.innerHTML = `
      <div class="empty-state">
        <h3>No Distraction-Free Lectures Found</h3>
        <p>Try searching for core topics like 'data structures', 'algorithms', or 'javascript'.</p>
      </div>
    `;
    return;
  }

  videos.forEach(video => {
    const card = document.createElement("div");
    card.className = "video-card";
    
    // Safely parse date
    const dateStr = new Date(video.publishedAt).toLocaleDateString([], { year: 'numeric', month: 'short' });

    card.innerHTML = `
      <div class="video-thumbnail-wrapper">
        <img src="${video.thumbnail}" alt="${escapeHTML(video.title)}" class="video-thumbnail" loading="lazy">
        <span class="video-duration">${video.duration}</span>
      </div>
      <div class="video-details">
        <h4 class="video-title" title="${escapeHTML(video.title)}">${escapeHTML(video.title)}</h4>
        <div class="video-channel">${escapeHTML(video.channelTitle)}</div>
        <div class="video-meta">
          <span>${video.viewCount} views</span> • <span>${dateStr}</span>
        </div>
      </div>
    `;

    card.addEventListener("click", () => {
      loadWatchVideo(video, true);
    });

    searchResultsGrid.appendChild(card);
  });

  // Pre-load the first search result into the player without auto-playing
  if (!FocusTubeApp.currentVideo && videos.length > 0) {
    loadWatchVideo(videos[0], false);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Search submit
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");

  const triggerSearch = () => {
    const query = searchInput.value.trim();
    performSearch(query);
  };

  searchBtn.addEventListener("click", triggerSearch);
  searchInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") triggerSearch();
  });

  // Bottom Tab Navigation switching
  const navItems = document.querySelectorAll(".bottom-nav .nav-item");
  navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tabId = item.getAttribute("data-tab");
      switchMobileTab(tabId);
    });
  });

  // Handle identity form submit
  document.getElementById("handle-form").addEventListener("submit", handleRegistrationSubmit);

  // Check unique handle dynamically on input (with debounce)
  let checkTimeout;
  const handleInput = document.getElementById("modal-handle-input");
  const statusEl = document.getElementById("handle-availability-status");

  handleInput.addEventListener("input", () => {
    clearTimeout(checkTimeout);
    const rawVal = handleInput.value.trim();
    const handle = rawVal.replace(/^@/, "");

    if (!handle) {
      statusEl.textContent = "";
      statusEl.className = "availability-status";
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,15}$/.test(handle)) {
      statusEl.textContent = "Requires 3-15 alphanumeric/underscore letters";
      statusEl.className = "availability-status unavailable";
      return;
    }

    statusEl.textContent = "Checking availability...";
    statusEl.className = "availability-status checking";

    checkTimeout = setTimeout(async () => {
      const taken = await window.ChatManager.checkHandleTaken(handle);
      if (taken) {
        statusEl.textContent = `Handle @${handle} is already claimed!`;
        statusEl.className = "availability-status unavailable";
      } else {
        statusEl.textContent = `Handle @${handle} is available!`;
        statusEl.className = "availability-status available";
      }
    }, 450);
  });

  // Chat message submit
  const chatInput = document.getElementById("chat-input-box");
  const chatSendBtn = document.getElementById("chat-send-btn");

  const sendChatMsg = async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    try {
      chatInput.disabled = true;
      await window.ChatManager.sendChatMessage(text);
      chatInput.value = "";
    } catch(e) {
      alert("Error sending message: " + e.message);
    } finally {
      chatInput.disabled = false;
      chatInput.focus();
    }
  };

  chatSendBtn.addEventListener("click", sendChatMsg);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendChatMsg();
  });

  // Video doubt query submit
  const doubtInput = document.getElementById("doubt-input-box");
  const doubtSubmitBtn = document.getElementById("doubt-submit-btn");
  const captureTimeBtn = document.getElementById("capture-time-btn");
  const timeInput = document.getElementById("doubt-time-input");

  captureTimeBtn.addEventListener("click", () => {
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      const curTime = ytPlayer.getCurrentTime();
      timeInput.value = formatTime(Math.floor(curTime));
    } else {
      timeInput.value = "0:00";
    }
  });

  doubtSubmitBtn.addEventListener("click", async () => {
    if (!FocusTubeApp.currentVideo) return;
    
    const message = doubtInput.value.trim();
    const timeRaw = timeInput.value.trim();

    if (!message) {
      alert("Please enter a question or doubt.");
      return;
    }

    let seconds = 0;
    if (timeRaw) {
      seconds = parseTimeString(timeRaw);
    } else if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      seconds = Math.floor(ytPlayer.getCurrentTime());
    }

    try {
      doubtSubmitBtn.disabled = true;
      await window.ChatManager.addVideoDoubt(FocusTubeApp.currentVideo.id, seconds, message);
      doubtInput.value = "";
      timeInput.value = "";
    } catch(e) {
      alert("Could not post study query: " + e.message);
    } finally {
      doubtSubmitBtn.disabled = false;
    }
  });

  // Focus mode light toggle
  const focusLightBtn = document.getElementById("focus-light-toggle");
  focusLightBtn.addEventListener("click", () => {
    document.body.classList.toggle("focus-mode-active");
    if (document.body.classList.contains("focus-mode-active")) {
      focusLightBtn.classList.add("active");
      focusLightBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        <span>Lights On</span>
      `;
    } else {
      focusLightBtn.classList.remove("active");
      focusLightBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        <span>Focus Lights</span>
      `;
    }
  });

  // Logo click scrolls down to search box
  document.getElementById("app-logo-link").addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelector(".screen-search-box").scrollIntoView({ behavior: 'smooth' });
  });
}

// Handle study handle modal submission
async function handleRegistrationSubmit(e) {
  e.preventDefault();
  const handleInput = document.getElementById("modal-handle-input");
  const handleVal = handleInput.value.trim().replace(/^@/, "");
  const submitBtn = document.getElementById("claim-handle-btn");
  const errorEl = document.getElementById("handle-modal-error");

  if (!handleVal) return;

  if (!/^[a-zA-Z0-9_]{3,15}$/.test(handleVal)) {
    errorEl.textContent = "Handles must be 3-15 alphanumeric characters.";
    return;
  }

  try {
    submitBtn.disabled = true;
    submitBtn.textContent = "Reserving Handle...";
    errorEl.textContent = "";

    const taken = await window.ChatManager.checkHandleTaken(handleVal);
    if (taken) {
      throw new Error("This study handle is already registered to another device.");
    }

    const savedHandle = await window.ChatManager.registerHandle(handleVal);
    
    // Success, close modal and init
    document.getElementById("handle-modal").classList.remove("active");
    document.getElementById("nav-user-handle").textContent = savedHandle;
    document.getElementById("profile-handle-display").textContent = savedHandle;
    
    initChatAndDoubts();
  } catch (error) {
    errorEl.textContent = error.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Reserve Permanent Handle";
  }
}

// Theme Engine (Dark Mode / Light Mode toggle)
function initTheme() {
  const savedTheme = localStorage.getItem("focustube_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);

  document.getElementById("nav-theme-btn").addEventListener("click", () => {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("focustube_theme", newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  const btn = document.getElementById("nav-theme-btn");
  if (theme === "dark") {
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
    `;
    btn.title = "Switch to Light Mode";
  } else {
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
    `;
    btn.title = "Switch to Dark Mode";
  }
}

// Bottom Navigation Tab Switching
function switchMobileTab(tabId) {
  // Update nav item active state
  document.querySelectorAll(".bottom-nav .nav-item").forEach(item => {
    if (item.getAttribute("data-tab") === tabId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });

  // Update active screen visibility
  document.querySelectorAll(".app-workspace .tab-screen").forEach(screen => {
    if (screen.id === `screen-${tabId}`) {
      screen.classList.add("active-screen");
    } else {
      screen.classList.remove("active-screen");
    }
  });
}
window.switchMobileTab = switchMobileTab;

// Pomodoro Timer Widget
function initPomodoro() {
  const timerCircle = document.querySelector(".timer-progress-ring");
  const playBtn = document.getElementById("pomodoro-play");
  const resetBtn = document.getElementById("pomodoro-reset");
  const skipBtn = document.getElementById("pomodoro-skip");
  
  const studyTab = document.getElementById("tab-study");
  const shortBreakTab = document.getElementById("tab-short-break");
  const longBreakTab = document.getElementById("tab-long-break");

  const durationMap = {
    study: 1500, // 25 min
    "short-break": 300, // 5 min
    "long-break": 900 // 15 min
  };

  const setTimerMode = (mode) => {
    FocusTubeApp.pomodoro.mode = mode;
    FocusTubeApp.pomodoro.timeLeft = durationMap[mode];
    FocusTubeApp.pomodoro.totalDuration = durationMap[mode];
    
    // Toggle active classes on tabs
    [studyTab, shortBreakTab, longBreakTab].forEach(t => t.classList.remove("active"));
    document.getElementById(`tab-${mode}`).classList.add("active");

    updateTimerDisplay();
    if (FocusTubeApp.pomodoro.isActive) {
      pauseTimer();
    }
  };

  studyTab.addEventListener("click", () => setTimerMode("study"));
  shortBreakTab.addEventListener("click", () => setTimerMode("short-break"));
  longBreakTab.addEventListener("click", () => setTimerMode("long-break"));

  playBtn.addEventListener("click", () => {
    if (FocusTubeApp.pomodoro.isActive) {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  resetBtn.addEventListener("click", () => {
    pauseTimer();
    FocusTubeApp.pomodoro.timeLeft = FocusTubeApp.pomodoro.totalDuration;
    updateTimerDisplay();
  });

  skipBtn.addEventListener("click", () => {
    handleTimerComplete();
  });

  function startTimer() {
    FocusTubeApp.pomodoro.isActive = true;
    playBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
    `;
    playBtn.title = "Pause Study Session";

    FocusTubeApp.pomodoro.timerId = setInterval(() => {
      FocusTubeApp.pomodoro.timeLeft--;
      updateTimerDisplay();

      if (FocusTubeApp.pomodoro.timeLeft <= 0) {
        handleTimerComplete();
      }
    }, 1000);
  }

  function pauseTimer() {
    FocusTubeApp.pomodoro.isActive = false;
    clearInterval(FocusTubeApp.pomodoro.timerId);
    playBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    `;
    playBtn.title = "Start Study Session";
  }

  function handleTimerComplete() {
    pauseTimer();
    playBeepSound();

    if (FocusTubeApp.pomodoro.mode === "study") {
      FocusTubeApp.pomodoro.sessionsCompleted++;
      document.getElementById("pomodoro-session-count").textContent = FocusTubeApp.pomodoro.sessionsCompleted;
      
      // Auto toggle to break
      if (FocusTubeApp.pomodoro.sessionsCompleted % 4 === 0) {
        setTimerMode("long-break");
        alert("Fantastic deep study session completed! Time for a well-deserved 15-minute long break. 🍵");
      } else {
        setTimerMode("short-break");
        alert("25-minute study block completed! Step away, stretch, and take a 5-minute break.");
      }
    } else {
      // Break completed, go back to study
      setTimerMode("study");
      alert("Break is over! Ready to lock back into deep focus study? Let's start!");
    }
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(FocusTubeApp.pomodoro.timeLeft / 60);
    const seconds = FocusTubeApp.pomodoro.timeLeft % 60;
    
    document.getElementById("timer-minutes").textContent = String(minutes).padStart(2, '0');
    document.getElementById("timer-seconds").textContent = String(seconds).padStart(2, '0');

    // Update circular SVG progress
    const radius = 90; // matching css r=90
    const circumference = 2 * Math.PI * radius;
    const progress = FocusTubeApp.pomodoro.timeLeft / FocusTubeApp.pomodoro.totalDuration;
    const offset = circumference - (progress * circumference);
    
    timerCircle.style.strokeDashoffset = offset;
  }

  // Initial call
  updateTimerDisplay();
}

// Generate premium chime/alarm via Web Audio API (Zero external assets needed)
function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    
    // Play double chime
    const playChimeNode = (time, pitch) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, time);
      
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(0.5, time + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(time);
      osc.stop(time + 0.8);
    };

    const now = ctx.currentTime;
    playChimeNode(now, 523.25); // C5
    playChimeNode(now + 0.25, 659.25); // E5
    playChimeNode(now + 0.5, 783.99); // G5
  } catch (error) {
    console.error("Audio Context playback failed:", error);
  }
}

// Notepad Logic
function initNotepad() {
  const generalNotesArea = document.getElementById("notepad-general-text");
  const videoNotesArea = document.getElementById("notepad-video-text");
  
  const tabGeneral = document.getElementById("notepad-tab-general");
  const tabVideo = document.getElementById("notepad-tab-video");
  
  const saveIndicator = document.getElementById("notepad-save-status");
  const exportBtn = document.getElementById("export-notes-btn");
  const clearBtn = document.getElementById("clear-notes-btn");

  // Load General Notes from LocalStorage
  generalNotesArea.value = localStorage.getItem("focustube_general_notes") || "";

  // Tabs Switch
  tabGeneral.addEventListener("click", () => {
    FocusTubeApp.activeTab = "general-notes";
    tabGeneral.classList.add("active");
    tabVideo.classList.remove("active");
    
    document.getElementById("notepad-general-wrapper").classList.remove("hidden");
    document.getElementById("notepad-video-wrapper").classList.add("hidden");
  });

  tabVideo.addEventListener("click", () => {
    FocusTubeApp.activeTab = "video-notes";
    tabVideo.classList.add("active");
    tabGeneral.classList.remove("active");
    
    document.getElementById("notepad-video-wrapper").classList.remove("hidden");
    document.getElementById("notepad-general-wrapper").classList.add("hidden");
  });

  // Debounced auto-save function
  let saveTimeout;
  const triggerAutoSave = (key, content) => {
    saveIndicator.classList.add("saving");
    saveIndicator.textContent = "Saving to browser storage...";
    
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      localStorage.setItem(key, content);
      saveIndicator.classList.remove("saving");
      saveIndicator.classList.add("saved");
      saveIndicator.textContent = "All changes saved locally";
      
      setTimeout(() => {
        if (!saveIndicator.classList.contains("saving")) {
          saveIndicator.classList.remove("saved");
        }
      }, 1500);
    }, 500);
  };

  generalNotesArea.addEventListener("input", () => {
    triggerAutoSave("focustube_general_notes", generalNotesArea.value);
  });

  videoNotesArea.addEventListener("input", () => {
    if (FocusTubeApp.currentVideo) {
      triggerAutoSave(`focustube_notes_${FocusTubeApp.currentVideo.id}`, videoNotesArea.value);
    }
  });

  // Clear notes
  clearBtn.addEventListener("click", () => {
    const activeText = FocusTubeApp.activeTab === "general-notes" ? generalNotesArea : videoNotesArea;
    if (confirm("Are you sure you want to erase all notes in this section? This cannot be undone.")) {
      activeText.value = "";
      if (FocusTubeApp.activeTab === "general-notes") {
        localStorage.removeItem("focustube_general_notes");
      } else if (FocusTubeApp.currentVideo) {
        localStorage.removeItem(`focustube_notes_${FocusTubeApp.currentVideo.id}`);
      }
      saveIndicator.textContent = "Cleared notes.";
      setTimeout(() => saveIndicator.textContent = "", 1500);
    }
  });

  // Export Notes to Text File
  exportBtn.addEventListener("click", () => {
    const isGeneral = FocusTubeApp.activeTab === "general-notes";
    const content = isGeneral ? generalNotesArea.value : videoNotesArea.value;
    const title = isGeneral ? "FocusTube General Study Notes" : `FocusTube Notes - ${FocusTubeApp.currentVideo.title}`;
    
    if (!content.trim()) {
      alert("Cannot export empty notes.");
      return;
    }

    const fileContent = `=========================================\n${title}\nGenerated on: ${new Date().toLocaleString()}\n=========================================\n\n${content}`;
    const blob = new Blob([fileContent], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = isGeneral ? "focustube_general_notes.txt" : `focustube_notes_${FocusTubeApp.currentVideo.id}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

function loadVideoNotes(videoId) {
  const notesArea = document.getElementById("notepad-video-text");
  const titleDisplay = document.getElementById("notepad-video-title");
  
  notesArea.value = localStorage.getItem(`focustube_notes_${videoId}`) || "";
  notesArea.disabled = false;
  
  // Set note header to video name truncated
  if (FocusTubeApp.currentVideo) {
    titleDisplay.textContent = `Lecture Notes: ${FocusTubeApp.currentVideo.title}`;
  }
}

// Helpers
function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseTimeString(timeStr) {
  const parts = timeStr.split(":").map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return parseInt(timeStr, 10) || 0;
}

// Parse ISO 8601 Durations (e.g. PT1H15M30S or PT5M12S)
function parseISO8601Duration(duration) {
  const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) {
    return { formatted: "0:00", totalSeconds: 0 };
  }

  const hours = parseInt(matches[1] || 0, 10);
  const minutes = parseInt(matches[2] || 0, 10);
  const seconds = parseInt(matches[3] || 0, 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  let formatted = "";

  if (hours > 0) {
    formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  } else {
    formatted = `${minutes}:${String(seconds).padStart(2, '0')}`;
  }

  return { formatted, totalSeconds };
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}
