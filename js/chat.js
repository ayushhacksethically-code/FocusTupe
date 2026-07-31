/**
 * FocusTube - Chat & Database Interface
 * Manages handle registration, global study chat, and video doubt queries.
 * Interacts with Firebase Firestore or falls back to simulated database storage.
 */

const ChatManager = {
  // Check if a handle is already claimed
  async checkHandleTaken(handle) {
    const cleanHandle = handle.replace(/^@/, "").trim();
    if (!cleanHandle) return true;

    if (window.FocusTubeConfig.isMockMode) {
      return await window.FocusTubeConfig.db.isHandleTaken(cleanHandle);
    }

    try {
      const db = window.FocusTubeConfig.db;
      const docRef = db.collection("handles").doc(cleanHandle.toLowerCase());
      const docSnap = await docRef.get();
      return docSnap.exists;
    } catch (error) {
      console.error("Error checking handle status:", error);
      // Fallback check on mock system if Firestore permissions fail
      return await window.FocusTubeConfig.db.isHandleTaken(cleanHandle);
    }
  },

  // Register handle to device and database
  async registerHandle(handle) {
    const cleanHandle = "@" + handle.replace(/^@/, "").trim();
    const cleanId = handle.replace(/^@/, "").trim().toLowerCase();

    if (window.FocusTubeConfig.isMockMode) {
      await window.FocusTubeConfig.db.reserveHandle(cleanId);
      localStorage.setItem("focustube_user_handle", cleanHandle);
      return cleanHandle;
    }

    try {
      const db = window.FocusTubeConfig.db;
      const docRef = db.collection("handles").doc(cleanId);
      
      // Perform write-once handle lock
      await docRef.set({
        originalHandle: cleanHandle,
        uid: window.FocusTubeConfig.auth.currentUser ? window.FocusTubeConfig.auth.currentUser.uid : "anon",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      localStorage.setItem("focustube_user_handle", cleanHandle);
      return cleanHandle;
    } catch (error) {
      console.error("Error registering handle in database:", error);
      throw new Error("Could not reserve handle. It might have just been taken or server is offline.");
    }
  },

  // Get current user's registered handle from localStorage
  getUserHandle() {
    return localStorage.getItem("focustube_user_handle");
  },

  // Listen to study room global chat messages
  subscribeToGlobalChat(onUpdateCallback) {
    if (window.FocusTubeConfig.isMockMode) {
      return window.FocusTubeConfig.db.subscribeToChat(onUpdateCallback);
    }

    try {
      const db = window.FocusTubeConfig.db;
      // Get the last 100 messages ordered by timestamp
      const unsubscribe = db.collection("chats")
        .orderBy("timestamp", "asc")
        .limitToLast(100)
        .onSnapshot((snapshot) => {
          const messages = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            messages.push({
              id: doc.id,
              username: data.username,
              message: data.message,
              timestamp: data.timestamp ? (data.timestamp.toMillis ? data.timestamp.toMillis() : data.timestamp) : Date.now()
            });
          });
          onUpdateCallback(messages);
        }, (error) => {
          console.error("Firestore chat subscription failed. Falling back to local simulated chat:", error);
          // If Firestore fails (e.g. permission error, index not created yet), fall back to Mock simulation
          window.FocusTubeConfig.db.subscribeToChat(onUpdateCallback);
        });

      return unsubscribe;
    } catch (e) {
      console.error("Error subscribing to global chat, using mock fallback", e);
      return window.FocusTubeConfig.db.subscribeToChat(onUpdateCallback);
    }
  },

  // Send message to study room chat
  async sendChatMessage(message) {
    const handle = this.getUserHandle();
    if (!handle) throw new Error("Register a study handle first.");

    if (window.FocusTubeConfig.isMockMode) {
      return await window.FocusTubeConfig.db.sendChatMessage(handle, message);
    }

    try {
      const db = window.FocusTubeConfig.db;
      await db.collection("chats").add({
        username: handle,
        message: message,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        uid: window.FocusTubeConfig.auth.currentUser ? window.FocusTubeConfig.auth.currentUser.uid : "anon"
      });
    } catch (error) {
      console.error("Error sending message to Firebase, saving locally:", error);
      // Fallback
      return await window.FocusTubeConfig.db.sendChatMessage(handle, message);
    }
  },

  // Listen to doubts for a specific video
  subscribeToVideoDoubts(videoId, onUpdateCallback) {
    if (window.FocusTubeConfig.isMockMode || videoId.startsWith("mock_")) {
      return window.FocusTubeConfig.db.subscribeToDoubts(videoId, onUpdateCallback);
    }

    try {
      const db = window.FocusTubeConfig.db;
      const unsubscribe = db.collection("doubts")
        .where("videoId", "==", videoId)
        .onSnapshot((snapshot) => {
          const doubts = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            doubts.push({
              id: doc.id,
              videoId: data.videoId,
              username: data.username,
              timestamp: data.timestamp, // in seconds
              message: data.message,
              date: data.date ? (data.date.toMillis ? data.date.toMillis() : data.date) : Date.now(),
              replies: data.replies || []
            });
          });
          // Sort client-side by timestamp in seconds, then date
          doubts.sort((a, b) => a.timestamp - b.timestamp || a.date - b.date);
          onUpdateCallback(doubts);
        }, (error) => {
          console.error("Firestore doubts subscription failed:", error);
          window.FocusTubeConfig.db.subscribeToDoubts(videoId, onUpdateCallback);
        });

      return unsubscribe;
    } catch (e) {
      console.error("Error subscribing to doubts:", e);
      return window.FocusTubeConfig.db.subscribeToDoubts(videoId, onUpdateCallback);
    }
  },

  // Add doubt connected to a specific video second
  async addVideoDoubt(videoId, timestampSeconds, message) {
    const handle = this.getUserHandle();
    if (!handle) throw new Error("Register a study handle first.");

    if (window.FocusTubeConfig.isMockMode || videoId.startsWith("mock_")) {
      return await window.FocusTubeConfig.db.addVideoDoubt(videoId, handle, timestampSeconds, message);
    }

    try {
      const db = window.FocusTubeConfig.db;
      await db.collection("doubts").add({
        videoId,
        username: handle,
        timestamp: parseInt(timestampSeconds, 10),
        message: message,
        date: Date.now(),
        replies: []
      });
    } catch (error) {
      console.error("Error creating video doubt:", error);
      return await window.FocusTubeConfig.db.addVideoDoubt(videoId, handle, timestampSeconds, message);
    }
  },

  // Reply to an existing video doubt
  async replyToDoubt(doubtId, replyMessage) {
    const handle = this.getUserHandle();
    if (!handle) throw new Error("Register a study handle first.");

    if (window.FocusTubeConfig.isMockMode || doubtId.startsWith("doubt_")) {
      return await window.FocusTubeConfig.db.replyToDoubt(doubtId, handle, replyMessage);
    }

    try {
      const db = window.FocusTubeConfig.db;
      const docRef = db.collection("doubts").doc(doubtId);
      
      await docRef.update({
        replies: firebase.firestore.FieldValue.arrayUnion({
          username: handle,
          message: replyMessage,
          date: Date.now()
        })
      });
    } catch (error) {
      console.error("Error adding reply to doubt:", error);
      return await window.FocusTubeConfig.db.replyToDoubt(doubtId, handle, replyMessage);
    }
  }
};

window.ChatManager = ChatManager;
