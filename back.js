// keep your API key and model
const API_KEY = "AIzaSyCSaSpWMx-H4dXvcmHwwt0hH0wC4DRXdQU";
const MODEL = "gemini-2.0-flash";

// --- selectors (match your HTML) ---
const chatArea = document.getElementById("chat-area");
const inputField = document.getElementById("chat-input-box");
const sendButton = document.getElementById("send-btn");
const greetingDiv = document.getElementById("greeting");

const undoBtn = document.getElementById("undo-btn");
const redoBtn = document.getElementById("redo-btn");
const voiceBtn = document.getElementById("voice-btn");
const historyBtn = document.getElementById("history-btn");
const historyModal = document.getElementById("history-modal");
const historyContent = document.getElementById("history-content");
const closeHistoryBtn = document.getElementById("close-history");
const clearHistoryBtn = document.getElementById("clear-history");
const toggleViewBtn = document.getElementById("toggle-view-btn");
const chatContainer = document.getElementById("chat-container");

const minimizeBtn = document.getElementById("minimize-btn");
const maximizeBtn = document.getElementById("maximize-btn");
const closeBtn = document.getElementById("close-btn");

// --- state ---
let redoStack = [];
let isSpeaking = false;
let isMinimized = false;
let isMaximized = false;

// --- greeting ---
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning! How can I assist you today?";
  if (hour >= 12 && hour < 17) return "Good afternoon! How can I assist you today?";
  return "Good evening! How can I assist you today?";
}
greetingDiv.textContent = getGreeting();

// --- persistence: save/load chat area HTML to localStorage ---
function saveHistory() {
  try {
    localStorage.setItem("chat_history_html", chatArea.innerHTML);
  } catch (e) { /* ignore */ }
}
function loadHistory() {
  try {
    const saved = localStorage.getItem("chat_history_html");
    if (saved) chatArea.innerHTML = saved;
  } catch (e) {}
}
loadHistory();

// --- helper: create message element (keeps "Bot:" and "You:" prefixes as you had) ---
function addMessageElement(sender, text) {
  const div = document.createElement("div");
  div.classList.add(sender === "bot" ? "bot-message" : "user-message");
  div.textContent = (sender === "bot" ? "Bot: " : "You: ") + text;
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
  saveHistory();
}

// --- date/time quick handler ---
function checkDateTimeQuery(msg) {
  const lowerMsg = msg.toLowerCase();
  const now = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  if (lowerMsg.includes("time")) return `Current time is ${now.getHours()}:${now.getMinutes().toString().padStart(2,'0')}`;
  if (lowerMsg.includes("date")) return `Today's date is ${now.getDate()}-${now.getMonth()+1}-${now.getFullYear()}`;
  if (lowerMsg.includes("day")) return `Today is ${days[now.getDay()]}`;
  if (lowerMsg.includes("month")) return `Current month is ${months[now.getMonth()]}`;
  return null;
}

// --- Gemini API call (note: CORS may block direct browser calls; if so use a server proxy) ---
async function getGeminiResponse(userMsg) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": API_KEY },
        body: JSON.stringify({ contents: [{ parts: [{ text: userMsg }] }] })
      }
    );
    const data = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    } else {
      console.error("Gemini returned unexpected:", data);
      return "⚠️ Sorry, I couldn’t fetch a proper response.";
    }
  } catch (err) {
    console.error("Network/Gemini error:", err);
    return "⚠️ Network error. Please try again later.";
  }
}

// --- send message flow ---
async function sendMessage() {
  const msg = inputField.value.trim();
  if (!msg) return;
  // add user message
  addMessageElement("user", msg);
  inputField.value = "";

  // quick date/time handled locally
  const dateReply = checkDateTimeQuery(msg);
  if (dateReply) {
    addMessageElement("bot", dateReply);
    return;
  }

  // show typing indicator
  const typing = document.createElement("div");
  typing.classList.add("bot-message");
  typing.textContent = "Bot: typing...";
  chatArea.appendChild(typing);
  chatArea.scrollTop = chatArea.scrollHeight;

  // get response
  const botReply = await getGeminiResponse(msg);

  // remove typing
  typing.remove();

  addMessageElement("bot", botReply);
}

// --- event listeners for send ---
sendButton.addEventListener("click", sendMessage);
inputField.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

// --- UNDO: remove last non-greeting message and push to redoStack ---
undoBtn.addEventListener("click", () => {
  const messages = Array.from(chatArea.querySelectorAll(".user-message, .bot-message"));
  // skip greeting if id == greeting
  // remove last message that is not the greeting element
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.id === "greeting") continue;
    redoStack.push(m.outerHTML);
    m.remove();
    saveHistory();
    return;
  }
  alert("Nothing to undo!");
});

// --- REDO: pop from redoStack and insert at end ---
redoBtn.addEventListener("click", () => {
  if (redoStack.length === 0) {
    alert("Nothing to redo!");
    return;
  }
  const html = redoStack.pop();
  chatArea.insertAdjacentHTML("beforeend", html);
  chatArea.scrollTop = chatArea.scrollHeight;
  saveHistory();
});

// --- VOICE: read last bot message aloud ---
voiceBtn.addEventListener("click", () => {
  const botMessages = chatArea.querySelectorAll(".bot-message");
  if (!botMessages || botMessages.length === 0) { alert("No bot message to read!"); return; }
  const last = botMessages[botMessages.length - 1].textContent.replace(/^Bot:\s*/i, "");
  if (isSpeaking) {
    speechSynthesis.cancel();
    isSpeaking = false;
    voiceBtn.textContent = "🔊";
  } else {
    const u = new SpeechSynthesisUtterance(last);
    u.lang = "en-IN";
    u.rate = 1;
    speechSynthesis.speak(u);
    isSpeaking = true;
    voiceBtn.textContent = "⏸";
    u.onend = () => { isSpeaking = false; voiceBtn.textContent = "🔊"; };
  }
});

// --- HISTORY modal ---
historyBtn.addEventListener("click", () => {
  const messages = chatArea.querySelectorAll(".bot-message, .user-message");
  historyContent.innerHTML = "";
  messages.forEach((m) => {
    const item = document.createElement("div");
    item.textContent = m.textContent;
    item.style.marginBottom = "6px";
    historyContent.appendChild(item);
  });
  historyModal.style.display = "flex";
  historyModal.setAttribute("aria-hidden", "false");
});
closeHistoryBtn.addEventListener("click", () => {
  historyModal.style.display = "none";
  historyModal.setAttribute("aria-hidden", "true");
});
clearHistoryBtn.addEventListener("click", () => {
  if (!confirm("Clear chat history?")) return;
  // keep greeting element
  const greeting = document.getElementById("greeting");
  chatArea.innerHTML = "";
  if (greeting) chatArea.appendChild(greeting);
  historyContent.innerHTML = "";
  saveHistory();
});

// --- TOGGLE MOBILE VIEW ---
toggleViewBtn.addEventListener("click", () => {
  chatContainer.classList.toggle("mobile-view");
  if (chatContainer.classList.contains("mobile-view")) {
    toggleViewBtn.textContent = "💻 Laptop View";
    // small adjustments (no permanent CSS changes done)
    chatContainer.style.maxWidth = "420px";
  } else {
    toggleViewBtn.textContent = "📱 Mobile View";
    chatContainer.style.maxWidth = "";
  }
});

// --- WINDOW CONTROLS ---
// Minimize: hide chat area + input (keeps header visible)
minimizeBtn.addEventListener("click", () => {
  if (!isMinimized) {
    document.querySelector(".chat-area").style.display = "none";
    document.querySelector(".chat-input").style.display = "none";
    minimizeBtn.textContent = "🔼";
    isMinimized = true;
  } else {
    document.querySelector(".chat-area").style.display = "flex";
    document.querySelector(".chat-input").style.display = "flex";
    minimizeBtn.textContent = "−";
    isMinimized = false;
  }
});

// Maximize / Restore
maximizeBtn.addEventListener("click", () => {
  if (!isMaximized) {
    chatContainer.style.position = "fixed";
    chatContainer.style.top = "2%";
    chatContainer.style.left = "2%";
    chatContainer.style.width = "96vw";
    chatContainer.style.height = "96vh";
    chatContainer.style.zIndex = "9999";
    maximizeBtn.textContent = "🗗";
    isMaximized = true;
  } else {
    chatContainer.style.position = "";
    chatContainer.style.top = "";
    chatContainer.style.left = "";
    chatContainer.style.width = "";
    chatContainer.style.height = "";
    chatContainer.style.zIndex = "";
    maximizeBtn.textContent = "☐";
    isMaximized = false;
  }
});

// Close: hide entire chat wrapper
closeBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to close the chatbot?")) {
    const wrapper = document.querySelector(".chat-wrapper");
    if (wrapper) wrapper.style.display = "none";
  }
});
