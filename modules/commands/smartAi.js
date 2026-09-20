const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { resolveUserProfile } = global.gender || require("../../utils/gender");

const AI_API = "https://uzairrajputapis.qzz.io/api/ai/gemini";

const OWNER_UID = "100037743553265";
const SHONI_UID = "61592620318122";

// Global Chat Memory for Thread History
global.chatMemory = global.chatMemory || { history: {} };

async function getAiReply(threadID, userName, userQuery) {
  // Initialize and maintain last 5 messages per thread
  global.chatMemory.history[threadID] = global.chatMemory.history[threadID] || [];
  global.chatMemory.history[threadID].push(`${userName}: ${userQuery}`);
  if (global.chatMemory.history[threadID].length > 5) {
    global.chatMemory.history[threadID].shift();
  }

  const conversationContext = global.chatMemory.history[threadID].join("\n");

  // Muskan Persona Custom Prompt
  const prompt = `
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

Conversation History:
${conversationContext}

Muskan:`;

  try {
    const response = await axios.get(AI_API, {
      params: { prompt: prompt },
      timeout: 20000
    });

    const reply = response.data?.reply || response.data?.response || response.data?.message || response.data;
    
    if (!reply || typeof reply !== "string") {
      throw new Error("Invalid response format from Gemini API.");
    }

    const cleanedReply = reply.trim();
    
    // Save Muskan's reply in memory
    global.chatMemory.history[threadID].push(`Muskan: ${cleanedReply}`);
    if (global.chatMemory.history[threadID].length > 5) {
      global.chatMemory.history[threadID].shift();
    }

    return cleanedReply;
  } catch (error) {
    console.error("Gemini AI API Error:", error);
    throw error;
  }
}

module.exports = {
  config: {
    name: "muskan",
    aliases: ["ask", "chat", "ai"],
    description: "Talk to Muskan AI (Gemini Powered)",
    usage: "{prefix}muskan <your message>",
    credit: "Shaan Khan",
    hasPrefix: false,
    permission: "PUBLIC",
    cooldown: 5,
    category: "AI"
  },

  run: async function({ api, message, args }) {
    const { threadID, messageID, senderID } = message;

    // Fast resolution for user name
    let userName = "User";
    try {
      const profile = await resolveUserProfile({ userID: senderID, threadID, api });
      if (profile && profile.name) userName = profile.name;
    } catch (e) {
      // Fallback if profile fails
    }

    // Command without prompt text triggers default message
    if (!args.length) {
      return api.sendMessage("Bolo na Shaan kya bat karni hai 😳🤔", threadID, messageID);
    }

    const promptText = args.join(" ").trim();

    try {
      const aiResponse = await getAiReply(threadID, userName, promptText);

      api.sendMessage(aiResponse, threadID, (err, info) => {
        if (err) return console.error("Muskan reply send error:", err);

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
      return api.sendMessage("❌ An error occurred while contacting Muskan AI API.", threadID, messageID);
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

    let userName = "User";
    try {
      const profile = await resolveUserProfile({ userID: senderID, threadID, api });
      if (profile && profile.name) userName = profile.name;
    } catch (e) {}

    const promptText = body.trim();

    try {
      const aiResponse = await getAiReply(threadID, userName, promptText);

      api.sendMessage(aiResponse, threadID, (err, info) => {
        if (err) return console.error("Muskan handleReply error:", err);

        const replies = global.client.replies.get(threadID) || [];
        const updatedReplies = message.messageReply 
          ? replies.filter(r => r.messageID !== message.messageReply.messageID) 
          : replies;

        updatedReplies.push({
          command: this.config.name,
          messageID: info.messageID,
          expectedSender: senderID,
          data: {}
        });

        global.client.replies.set(threadID, updatedReplies);
      }, messageID);

    } catch (error) {
      return api.sendMessage("❌ Error occurred while talking to Muskan.", threadID, messageID);
    }
  }
};
