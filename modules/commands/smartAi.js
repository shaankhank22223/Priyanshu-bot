const axios = require("axios");
const yts = require("yt-search");
const fs = require("fs-extra");
const path = require("path");

module.exports = {
  config: {
    name: "muskan",
    version: "18.6.2",
    hasPermssion: 0,
    credits: "𝐏𝐫𝐢𝐲𝐚𝐧𝐬𝐡 𝐑𝐚𝐣𝐩𝐮𝐭",
    description: "Muskan AI + Priyanshu API Media Downloader",
    commandCategory: "ai",
    usages: "{prefix}muskan <baat karein ya gaana maangein>",
    cooldowns: 5,
    hasPrefix: false
  },

  run: async function ({ api, event, args }) {
    const { threadID, messageID, senderID, body } = event;
    let cleanedMsg = (args.join(" ") || body || "").replace(/^muskan[\s,!.?:-]*/i, "").trim();

    if (!cleanedMsg) {
      return api.sendMessage("Bolo na Shaan, kya baat karni hai? 😘", threadID, messageID);
    }

    const isVideoReq = /\b(video|vdo|mp4|film|movie)\b/i.test(cleanedMsg);
    const isAudioReq = /\b(song|music|audio|mp3|play|gaana|gane|ghana)\b/i.test(cleanedMsg);
    const isUrl = /(youtube\.com|youtu\.be)/i.test(cleanedMsg);

    // Media Downloader Section
    if (isVideoReq || isAudioReq || isUrl) {
      try {
        if (api.setMessageReaction) api.setMessageReaction("⌛", messageID, () => {}, true);

        let query = cleanedMsg.replace(/video|vdo|mp4|song|music|audio|mp3|play|gaana|gane|ghana/gi, "").trim();
        if (isUrl) query = cleanedMsg;

        if (!query) {
          return api.sendMessage("Naam to batao kya download karun? 🥺", threadID, messageID);
        }

        const searchResult = await yts(query);
        if (!searchResult || !searchResult.videos.length) {
          if (api.setMessageReaction) api.setMessageReaction("❌", messageID, () => {}, true);
          return api.sendMessage("Maafi, ye video ya song nahi mila 🥺💔", threadID, messageID);
        }

        const video = searchResult.videos[0];
        const videoUrl = video.url;
        const format = isVideoReq ? "mp4" : "mp3";

        const PRIYANSHU_API_KEY = "apim_31D5362qQAISxZ-fH32wmaCW4mpKWS0HjncF1myUjQ8";
        const OWNER_TAG = "»»𝑶𝑾𝑵𝑬𝑹««★™  »»𝑺𝑯𝑨𝑨𝑵 𝑲𝑯𝑨𝑵««";

        const apiUrl = `https://priyanshuapi.qzz.io/api/runner/youtube-downloader-v2/download`;
        const response = await axios.post(apiUrl, {
          url: videoUrl,
          format: format,
          quality: isVideoReq ? "360" : "320"
        }, {
          headers: {
            'Authorization': `Bearer ${PRIYANSHU_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        });

        const downloadUrl = response.data?.data?.downloadUrl;
        if (!downloadUrl) throw new Error("Link not found");

        const cacheDir = path.join(__dirname, "cache");
        if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

        const fileName = `${Date.now()}.${format}`;
        const cachePath = path.join(cacheDir, fileName);

        const infoMsg = `🖤 𝗧𝗶𝘁𝗹𝗲: ${video.title}\n\n👤 𝗔𝗿𝘁𝗶𝘀𝘁: ${video.author.name}\n\n${OWNER_TAG}\n🥀𝒀𝑬 𝑳𝑶 𝑨𝑷𝑲𝑰 👉 ${format.toUpperCase()}`;

        const writer = fs.createWriteStream(cachePath);
        const streamResponse = await axios({ url: downloadUrl, method: 'GET', responseType: 'stream' });
        streamResponse.data.pipe(writer);

        writer.on("finish", async () => {
          const stats = fs.statSync(cachePath);
          if (stats.size / (1024 * 1024) > 48) {
            if (api.setMessageReaction) api.setMessageReaction("❌", messageID, () => {}, true);
            if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
            return api.sendMessage("⚠️ Maafi, file bahut badi hai!", threadID, messageID);
          }

          if (api.setMessageReaction) api.setMessageReaction("✅", messageID, () => {}, true);

          if (isVideoReq) {
            api.sendMessage({ body: infoMsg, attachment: fs.createReadStream(cachePath) }, threadID, () => fs.unlinkSync(cachePath));
          } else {
            await api.sendMessage(infoMsg, threadID);
            api.sendMessage({ attachment: fs.createReadStream(cachePath) }, threadID, () => fs.unlinkSync(cachePath));
          }
        });
        return;
      } catch (err) {
        if (api.setMessageReaction) api.setMessageReaction("❌", messageID, () => {}, true);
        return api.sendMessage("Server thoda thak gaya hai, baad mein try karo 🥺", threadID, messageID);
      }
    }

    // AI Chat Section
    let userName = "User";
    try {
      const userInfo = await api.getUserInfo(senderID);
      if (userInfo && userInfo[senderID]) {
        userName = userInfo[senderID].name || "User";
      }
    } catch (err) {}

    global.muskanHistory = global.muskanHistory || {};
    global.muskanHistory[threadID] = global.muskanHistory[threadID] || [];
    global.muskanHistory[threadID].push(`${userName}: ${cleanedMsg}`);
    if (global.muskanHistory[threadID].length > 5) global.muskanHistory[threadID].shift();

    const OWNER_UID = "100016828397863";
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
- Kisi aur ke liye ek cool, chill aur mast friend jaisi raho gi. Agar sender Uid shoni ka 61592620318122 ho toh isko boyfriend ki tarah treat karo.

Output Format:
- Sirf raw text reply do, koi extra markdown ya asterisks use mat karna.

Chat history:
${global.muskanHistory[threadID].join("\n")}
Muskan:`;

    try {
      const AI_API = "https://uzairrajputapis.qzz.io/api/ai/gemini";
      const res = await axios.post(AI_API, { prompt });
      let reply = res.data?.result?.answer || "Hmmm... 🥺";

      const lines = reply.split('\n').filter(line => line.trim() !== '');
      if (lines.length > 4) {
        reply = lines.slice(0, 3).join('\n') + " ✨";
      }

      return api.sendMessage(reply, threadID, (err, info) => {
        if (err) return;
        if (global.client && global.client.replies) {
          const repliesList = global.client.replies.get(threadID) || [];
          repliesList.push({
            command: this.config.name,
            messageID: info.messageID,
            expectedSender: senderID,
            data: {}
          });
          global.client.replies.set(threadID, repliesList);
        }
      }, messageID);

    } catch (e) {
      return api.sendMessage("Mera net thoda slow chal raha hai, baad mein baat karte hain 🥺", threadID, messageID);
    }
  },

  handleReply: async function ({ api, event, handleReply }) {
    const { body, senderID } = event;
    if (!body) return;
    return this.run({ api, event, args: [body] });
  },

  handleEvent: async function ({ api, event }) {
    const { body, senderID, messageReply } = event;
    if (!body || senderID == api.getCurrentUserID()) return;

    if ((messageReply && messageReply.senderID == api.getCurrentUserID()) || body.toLowerCase().startsWith("muskan")) {
      this.run({ api, event, args: [body] });
    }
  }
};
