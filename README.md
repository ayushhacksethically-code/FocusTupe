# 📚 FocusTube — Distraction-Free Study Portal & Peer Community

FocusTube is a lightweight, high-performance static web application built using **Vanilla HTML5, CSS3, JavaScript, YouTube Data API v3, and Firebase Firestore**. It eliminates YouTube's home feed algorithms, viral videos, Shorts, and clickbait recommendations, replacing them with a custom interface optimized for deep learning, local note-taking, Pomodoro study sessions, and global study room chat.

---

## 🎯 Core Features

1. **Permanent Device Identity (Study Handles)**
   - Claim a unique handle (e.g. `@Pankaj_Study`) on first visit.
   - Globally reserved in Firestore (ensures handle uniqueness).
   - Locked locally to the browser's `localStorage` and permanently attached to chat messages and doubt queries.

2. **Clean Watch Mode & Focus Light Toggle**
   - Embedded minimal watch player via lightweight HTML `<iframe>` with zero related sidebars or recommended clickbait.
   - **Focus Lights Dimming**: Dim headers and sidebars with a single click during long lectures. Interactive sidebars fade back in smoothly only when hovered.

3. **Timestamped Lecture Doubts**
   - Click "Get Current Time" to capture the player's exact playback position.
   - Post study doubts locked to that second (e.g., *Doubt at 12:45 regarding binary search trees*).
   - Clicking a doubt's timestamp seeks the player directly to that time.
   - Reply directly to other peers' doubts in nested comment threads.

4. **Live Virtual Study Room (Global Chat)**
   - Real-time synchronization across all active students using Firestore `onSnapshot`.
   - Share questions, bookmarks, and timestamps instantly with peers.

5. **Integrated Productivity Suite**
   - **Pomodoro Widget**: 25-minute study / 5-minute break timer with an active SVG progress ring. Emits a clean synthesized sound chime via Web Audio API upon session completion.
   - **Ruled In-App Notepad**: Auto-saves text drafts locally to browser `localStorage` per video (so notes are locked to specific lectures). Supports exporting notes as `.txt` files.

---

## 📂 Project Directory Structure

```plaintext
focustube/
├── index.html          # App shell (Header, Player, QA Feed, Notepad, Chat, Modals)
├── css/
│   └── style.css       # Naver UI layout styling, dark/light themes, focus states
├── js/
│   ├── firebase-config.js # Firebase App init, API configs, and Offline Mock Mode
│   ├── chat.js         # Unique handle claim interface, Firestore chat & doubts
│   └── app.js          # Video search control, YouTube Player API, Pomodoro, Notepad
└── README.md           # Project documentation & instructions
```

---

## ⚡ Zero-Configuration Offline Preview

FocusTube is built with a **Mock Mode** fallback mechanism. If you load `index.html` without API keys, the app detects the lack of configuration and launches a local simulated database utilizing browser `localStorage`. 

- Mock search results represent a curated index of actual, high-quality public educational lectures (such as CS50, freeCodeCamp, Net Ninja).
- Clicking any video card plays the real course material in the player.
- Chat, doubts, and handles will operate dynamically within the local browser sandbox.

---

## 🚀 Live Production Setup

To connect FocusTube to live databases and Google APIs:

### 1. YouTube Data API v3 Key
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project, navigate to **APIs & Services** -> **Library**, search for **YouTube Data API v3**, and click **Enable**.
3. Go to **Credentials**, click **Create Credentials**, select **API Key**.
4. *(Recommended)* Restrict the API key usage to HTTP Referrers accepting requests from your domain: `https://your-username.github.io/*`.

### 2. Firebase App & Firestore
1. Create a project on the [Firebase Console](https://console.firebase.google.com/).
2. Add a new **Web App** to your project to obtain your configuration object:
   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "your-project.firebaseapp.com",
     "projectId": "your-project",
     "storageBucket": "your-project.appspot.com",
     "messagingSenderId": "...",
     "appId": "..."
   }
   ```
3. Enable **Anonymous Authentication** under *Authentication* -> *Sign-in method*.
4. Create a **Cloud Firestore** database.

### 3. Firestore Security Rules
Go to Cloud Firestore -> **Rules** and deploy the following configuration to ensure handle uniqueness and prevent data deletion:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Handle reservation rules: write-once, permanent lock
    match /handles/{handle} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
    
    // Global chat rules: create messages, read feed
    match /chats/{chatId} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.username != null;
      allow update, delete: if false;
    }
    
    // Doubt queries and nested reply rules
    match /doubts/{doubtId} {
      allow read: if true;
      allow create: if request.auth != null && request.resource.data.username != null;
      allow update: if request.auth != null && request.resource.data.replies != null;
      allow delete: if false;
    }
  }
}
```

### 4. Register Credentials
Open FocusTube in your browser, click the **Settings icon (⚙️)** in the top right navbar, **uncheck "Enable Local Mock Mode"**, paste your Firebase Config JSON and YouTube API key, and click **Apply Settings & Reload**. Alternatively, you can paste your credentials directly into `DEFAULT_FIREBASE_CONFIG` and `DEFAULT_YOUTUBE_API_KEY` within `js/firebase-config.js` to ship them preconfigured.

---

## 🎨 Theme & Layout Customization
- **Light Theme**: Traditional portal palette styled with Naver portal accents: clean gray frames, white grids, and crisp green actions (`#03C75A`).
- **Dark Theme**: Eye-strain-reducing deep space interface with vibrant highlights.
- **Focus Lights Toggle**: Ideal for full-screen study blocks. Toggles dim overlays on secondary widgets so that only the lecture and your timestamped doubt logs remain highlighted.
