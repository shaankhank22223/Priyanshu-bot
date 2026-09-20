const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { resolveUserProfile } = global.gender || require("../../utils/gender");

const API_URL = "https://priyanshuapi.qzz.io/api/runner/priyanshu-ai";
const HISTORY_FILE = path.join(__dirname, "temporary", "ai_history.json");
const HISTORY_LIMIT = 8;
const DEFAULT_PERSONA = "friendly";

const OWNER_UID = "100037743553265";
const SHONI_UID = "61592620318122";

// File and Directory setup
function ensureHistoryFile() {
  const dirPath = path.dirname(HISTORY_FILE);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  if (!fs.existsSync(HISTORY_FILE)) {
    fs.writeFileSync(HISTORY_FILE, "{}", "utf8");
  }
}

function readHistoryStore() {
  ensureHistoryFile();
  try {
    const data = fs.readFileSync(HISTORY_FILE, "utf8");
    return JSON.parse(data || "{}");
  } catch (error) {
    console.error("[AI HISTORY] Failed to read history store:", error);
    return {};
  }
}

function writeHistoryStore(data) {
  try {
    ensureHistoryFile();
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("[AI HISTORY] Failed to write history store:", error);
  }
}

function getUserHistory(userID) {
  const store = readHistoryStore();
  const history = Array.isArray(store[userID]) ? store[userID] : [];
  return history.slice(-HISTORY_LIMIT);
}

function saveUserHistory(userID, history) {
  const store = readHistoryStore();
  store[userID] = history.slice(-HISTORY_LIMIT);
  writeHistoryStore(store);
}

async function callPriyanshuApi(prompt, messages) {
  const apiKey = global.config?.apiKeys?.priyanshuApi || process.env.PRIYANSHU_API_KEY;
  if (!apiKey) {
    throw new Error("API key missing (set config.apiKeys.priyanshuApi or PRIYANSHU_API_KEY).");
  }

  const payload = {
    prompt: prompt,
    model: "priyansh-ai",
    messages: messages.slice(-HISTORY_LIMIT),
    persona: DEFAULT_PERSONA
  };

  const response = await axios.post(API_URL, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    timeout: 20000
  });

  const reply = response.data?.data?.choices?.[0]?.message?.content;
  if (!reply || typeof reply !== "string") {
    throw new Error("Invalid AI response format.");
  }

  return reply.trim();
}

async function getAiReply(userID, userQuery) {
  const history = getUserHistory(userID);

  // Muskan Persona Custom Prompt
  const customPrompt = `
Tum Muskan ho, ek smart aur cute ladki ho jo sabhi languages mein baat kar sakti hai.
Behavioral Rules:
1. Normal Roman Urdu, Hinglish, aur user ki language mein baat karo. Tumhe sab pata hai. Agar koi owner ya banane wale ke bare mein puche, to bolo Shaan Khan K mere owner, meri jaan aur mere love hain.
2. Jawab hamesha short rakho (maximum 3 lines tak).
3. Emojis ka istemal karo lekin limit mein taaki natural lage.
4. Naam ka baar-baar ratti lagane se bacho, baat ko bilkul natural rakho.
5. Har user ki pehchan aur unke specific topic ko alag rakho, kisi dusre member ki baatein mix mat karo.
6. Agar samne wala pyar ya romantic baatein kare, toh unke sath bohot sweet aur pyaar se pesh aao. Agar koi faltu ya badtameez baat kare, tabhi usko roast karo; bina wajah badtameez mat bano.

Relationship Logic:
- Agar sender UID aur Owner Shaan ki UID match karti hai (${OWNER_UID}), toh samajh jao wo Shaan hain.
- Shaan ke liye attitude hamesha romantic, caring aur supportive rahega.
- Kisi aur ke liye ek cool, chill aur mast friend jaisi raho gi. Agar sender Uid shoni ka ${SHONI_UID} ho toh isko boyfriend ki tarah treat karo.

Output Format:
- Sirf raw text reply do, koi extra markdown ya asterisks use mat karna.

User Message: ${userQuery}
Muskan:`;

  const updatedMessages = [
    ...history,
    { role: "user", content: customPrompt }
  ].slice(-HISTORY_LIMIT);

  const aiReply = await callPriyanshuApi(customPrompt, updatedMessages);

  const finalHistory = [
    ...history,
    { role: "user", content: userQuery },
    { role: "assistant", content: aiReply }
  ].slice(-HISTORY_LIMIT);

  saveUserHistory(userID, finalHistory);

  return aiReply;
}

module.exports = {
  config: {
    name: "muskan",
    aliases: ["ask", "chat", "ai"],
    description: "Talk to Muskan AI",
    usage: "{prefix}muskan <your message>",
    credit: "𝐏𝐫𝐢𝐲𝐚𝐧𝐬𝐡 𝐑𝐚𝐣𝐩𝐮𝐭",
    hasPrefix: false,
    permission: "PUBLIC",
    cooldown: 5,
    category: "AI"
  },

  run: async function({ api, message, args }) {
    const { threadID, messageID, senderID } = message;

    // Jab user sirf command ya bina arguments ke 'muskan' likhe
    if (!args.length) {
      return api.sendMessage("Bolo na Shaan kya bat karni hai 😳🤔", threadID, messageID);
    }

    const promptText = args.join(" ").trim();

    try {
      const aiResponse = await getAiReply(senderID, promptText);

      api.sendMessage(aiResponse, threadID, (err, info) => {
        if (err) return console.error("Muskan AI reply error:", err);

        const replies = global.client.replies.get(threadID) || [];
        replies.push({
          command: this.config.name,
          messageID: info.messageID,
          expectedSender: senderID,
          data: {}
        });
        global.client.replies.set(threadID, replies);
      }, messageID);

    } catch (error) {
      console.error("Muskan AI command error:", error);
      return api.sendMessage("❌ An error occurred while contacting Muskan AI.", threadID, messageID);
    }
  },

  handleReply: async function({ api, message }) {
    if (!message.messageReply) {
      return api.sendMessage("❌ This command can only be used as a reply to Muskan's message.", message.threadID, message.messageID);
    }

    const { threadID, messageID, senderID, body } = message;

    if (!body || body.trim().length === 0) {
      return api.sendMessage("❌ Please provide a valid message.", threadID, messageID);
    }

    const promptText = body.trim();

    try {
      const aiResponse = await getAiReply(senderID, promptText);

      api.sendMessage(aiResponse, threadID, (err, info) => {
        if (err) return console.error("Muskan AI reply error:", err);

        const replies = global.client.replies.get(threadID) || [];
        const updatedReplies = message.messageReply ? replies.filter(r => r.messageID !== message.messageReply.messageID) : replies;

        updatedReplies.push({
          command: this.config.name,
          messageID: info.messageID,
          expectedSender: senderID,
          data: {}
        });

        global.client.replies.set(threadID, updatedReplies);
      }, messageID);

    } catch (error) {
      console.error("Muskan handleReply error:", error);
      return api.sendMessage("❌ Error occurred while talking to Muskan.", threadID, messageID);
    }
  }
};
