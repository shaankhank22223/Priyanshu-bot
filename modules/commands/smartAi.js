const fs = require("fs");
const path = require("path");
const axios = require("axios");
const ytSearch = require("yt-search");
const mongoose = require("mongoose");

// --- MongoDB Setup ---
const MONGO_URI = "Aapka_MongoDB_Connection_String_Yahan_Lagega"; 

if (mongoose.connection.readyState === 0) {
  mongoose.connect(MONGO_URI)
    .then(() => console.log("MongoDB connected successfully!"))
    .catch((err) => console.error("MongoDB connection error:", err));
}

// Chat History Schema
const chatSchema = new mongoose.Schema({
  threadID: { type: String, required: true, unique: true },
  history: { type: [String], default: [] }
});

const ChatModel = mongoose.models.MuskanChatHistory || mongoose.model("MuskanChatHistory", chatSchema);

module.exports.config = {
    name: "muskan",
    aliases: ["songs", "song"],
    version: "18.7.0",
    hasPermssion: 0,
    credits: "𝐏𝐫𝐢𝐲𝐚𝐧𝐬𝐡 𝐑𝐚𝐣𝐩𝐮𝐭",
    description: "Muskan AI + YouTube Music/Video Search & Downloader (MongoDB Supported)",
    commandCategory: "ai",
    usages: "muskan <baat karein ya gaana/video maangein>",
    cooldowns: 5
};

const AI_API = "https://uzairrajputapis.qzz.io/api/ai/gemini";
const PRIYANSHU_API_KEY = "apim_31D5362qQAISxZ-fH32wmaCW4mpKWS0HjncF1myUjQ8";
const OWNER_TAG = "»»𝑶𝑾𝑵𝑬𝑹««★™  »»𝑺𝑯𝑨𝑨𝑵 𝑲𝑯𝑨𝑵««";
const OWNER_UID = "100016828397863"; // Shaan ka UID

module.exports.run = async function ({ api, event, args }) {
    const { threadID, messageID, senderID } = event;
    const input = args.join(" ").trim();
    let cleanedMsg = (event.body || "").replace(/^muskan[\s,!.?:-]*/i, "").trim();

    if (!cleanedMsg && !input) {
        return api.sendMessage("Bolo na Shaan, kya baat karni hai ya kaun sa gaana maang rahe ho? 😘", threadID, messageID);
    }

    const queryMsg = input || cleanedMsg;
    const isVideoReq = /\b(video|vdo|mp4|film|movie)\b/i.test(queryMsg);
    const isAudioReq = /\b(song|music|audio|mp3|play|gaana|gane|ghana)\b/i.test(queryMsg);
    const isUrl = /(youtube\.com|youtu\.be)/i.test(queryMsg);

    // --- Direct Video / Audio Link / Search Request Handling ---
    if (isVideoReq || isAudioReq || isUrl) {
        try {
            api.setMessageReaction("⌛", messageID, () => {}, true);

            let query = queryMsg.replace(/video|vdo|mp4|song|music|audio|mp3|play|gaana|gane|ghana/gi, "").trim();
            if (isUrl) query = queryMsg;

            if (!query) return api.sendMessage("Naam to batao kya download karun? 🥺", threadID, messageID);

            const searchResult = await ytSearch(query);
            if (!searchResult || !searchResult.videos.length) {
                api.setMessageReaction("❌", messageID, () => {}, true);
                return api.sendMessage("Maafi, ye video ya song nahi mila 🥺💔", threadID, messageID);
            }

            const video = searchResult.videos[0];
            const videoUrl = video.url;
            const format = isVideoReq ? "mp4" : "mp3";

            const apiUrl = "https://priyanshuapi.qzz.io/api/runner/youtube-downloader-v2/download";
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
                    api.setMessageReaction("❌", messageID, () => {}, true);
                    if (fs.existsSync(cachePath)) fs.unlinkSync(cachePath);
                    return api.sendMessage("⚠️ Maafi, file bahut badi hai!", threadID, messageID);
                }

                api.setMessageReaction("✅", messageID, () => {}, true);

                if (isVideoReq) {
                    api.sendMessage({ body: infoMsg, attachment: fs.createReadStream(cachePath) }, threadID, () => fs.unlinkSync(cachePath));
                } else {
                    await api.sendMessage(infoMsg, threadID);
                    api.sendMessage({ attachment: fs.createReadStream(cachePath) }, threadID, () => fs.unlinkSync(cachePath));
                }
            });
            return;
        } catch (err) {
            api.setMessageReaction("❌", messageID, () => {}, true);
            return api.sendMessage("Server thoda thak gaya hai, baad mein try karo 🥺", threadID, messageID);
        }
    }

    // --- Search Top 6 List Selection Mode ---
    try {
        const searchResults = await ytSearch(queryMsg);
        if (searchResults && searchResults.videos.length >= 2) {
            const results = searchResults.videos.slice(0, 6);
            const thumbDir = path.join(__dirname, "temp");
            if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

            let msg = "🎧 Top 6 results:\n\n";
            const attachments = [];
            const thumbnailPaths = [];

            for (let i = 0; i < results.length; i++) {
                const video = results[i];
                const thumbURL = video.thumbnail;
                const thumbPath = path.join(thumbDir, `thumb-${video.videoId}-${Date.now()}.jpg`);

                try {
                    const thumbData = await axios.get(thumbURL, { responseType: "arraybuffer" });
                    fs.writeFileSync(thumbPath, thumbData.data);
                    attachments.push(fs.createReadStream(thumbPath));
                    thumbnailPaths.push(thumbPath);
                } catch (e) {
                    console.error("Error downloading thumbnail:", e);
                }

                msg += `${i + 1}. ${video.title} (${video.timestamp})\n`;
                msg += `📻 ${video.author.name} | 👁 ${video.views}\n\n`;
            }

            msg += "👉 Reply with the number to download.";

            return api.sendMessage(
                {
                    body: msg,
                    attachment: attachments,
                },
                threadID,
                (err, info) => {
                    if (err) return console.error("Send failed:", err);

                    global.client.replies.set(threadID, [
                        ...(global.client.replies.get(threadID) || []),
                        {
                            command: this.config.name,
                            messageID: info.messageID,
                            expectedSender: senderID,
                            data: {
                                results,
                                messageIDToDelete: info.messageID,
                                thumbnailPaths
                            }
                        }
                    ]);

                    setTimeout(() => {
                        thumbnailPaths.forEach(p => {
                            if (fs.existsSync(p)) fs.unlink(p, () => { });
                        });
                    }, 60 * 1000);
                },
                messageID
            );
        }
    } catch (e) {}

    // --- AI Chat Processing (Muskan AI System) ---
    let userName = "User";
    try {
        const userInfo = await api.getUserInfo(senderID);
        if (userInfo && userInfo[senderID]) {
            userName = userInfo[senderID].name || "User";
        }
    } catch (err) {}

    let chatData = await ChatModel.findOne({ threadID });
    if (!chatData) {
        chatData = new ChatModel({ threadID, history: [] });
    }

    chatData.history.push(`${userName}: ${queryMsg}`);
    if (chatData.history.length > 5) chatData.history.shift();
    await chatData.save();

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
${chatData.history.join("\n")}
Muskan:`;

    try {
        const res = await axios.post(AI_API, { prompt });
        let reply = res.data?.result?.answer || "Hmmm... 🥺";

        const lines = reply.split('\n').filter(line => line.trim() !== '');
        if (lines.length > 4) {
            reply = lines.slice(0, 3).join('\n') + " ✨";
        }

        return api.sendMessage(reply, threadID, messageID);
    } catch (e) {
        return api.sendMessage("Mera net thoda slow chal raha hai, baad mein baat karte hain 🥺", threadID, messageID);
    }
};

module.exports.handleReply = async function ({ api, message, replyData }) {
    const { threadID, messageID, body } = message;
    const index = parseInt(body.trim());

    if (!replyData.results || isNaN(index) || index < 1 || index > replyData.results.length) {
        return api.sendMessage("❌ Please reply with a valid number.", threadID, messageID);
    }

    const video = replyData.results[index - 1];
    const videoUrl = video.url;

    if (replyData.messageIDToDelete) {
        api.unsendMessage(replyData.messageIDToDelete);
    }

    const processingMsg = await api.sendMessage(`⏳ Processing: ${video.title}...`, threadID, messageID);

    try {
        const apiUrl = "https://priyanshuapi.qzz.io/api/runner/youtube-downloader-v2/download";
        const response = await axios.post(
            apiUrl,
            {
                url: videoUrl,
                format: "mp3",
                quality: "320"
            },
            {
                headers: {
                    Authorization: `Bearer ${PRIYANSHU_API_KEY}`,
                    "Content-Type": "application/json",
                },
                timeout: 60000
            }
        );

        const downloadUrl = response.data?.data?.downloadUrl;
        if (!downloadUrl) {
            api.unsendMessage(processingMsg.messageID);
            return api.sendMessage("❌ Failed to generate download link.", threadID, messageID);
        }

        let finalTitle = video.title;

        try {
            const headResponse = await axios.head(downloadUrl);
            const contentLength = headResponse.headers["content-length"];
            if (contentLength && parseInt(contentLength) > 48 * 1024 * 1024) {
                api.unsendMessage(processingMsg.messageID);
                return api.sendMessage("❌ File size exceeds 48MB limit.", threadID, messageID);
            }
        } catch (headError) {
            console.error("Error checking file size:", headError);
        }

        const formattedViews = video.views ? new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(video.views) : "N/A";

        let infoMsg = `🎵 Title: ${finalTitle}\n`;
        if (video.timestamp) infoMsg += `⏱ Duration: ${video.timestamp}\n`;
        if (video.author && video.author.name) infoMsg += `👤 Artist: ${video.author.name}\n`;
        if (video.views) infoMsg += `👀 Views: ${formattedViews}\n`;
        if (video.ago) infoMsg += `📅 Uploaded: ${video.ago}\n`;
        infoMsg += `🔗 Source: ${videoUrl}\n`;
        infoMsg += `⏳ Downloading audio...`;

        api.sendMessage(infoMsg, threadID, () => {
            api.unsendMessage(processingMsg.messageID);
        });

        const tempDir = path.join(__dirname, "temp");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const safeFilename = `${Date.now()}.mp3`;
        const filePath = path.join(tempDir, safeFilename);

        const writer = fs.createWriteStream(filePath);
        const downloadResponse = await axios({
            method: "GET",
            url: downloadUrl,
            responseType: "stream",
        });

        downloadResponse.data.pipe(writer);

        writer.on("finish", () => {
            fs.stat(filePath, (statErr, stats) => {
                if (statErr || !stats || stats.size === 0) {
                    console.error("[muskan] Temp file is empty or unreadable:", filePath, statErr);
                    api.sendMessage("❌ Download failed (empty file). Please try again.", threadID, messageID);
                    return fs.unlink(filePath, () => { });
                }

                api.sendMessage(
                    {
                        body: `🎧 ${finalTitle}`,
                        attachment: fs.createReadStream(filePath),
                    },
                    threadID,
                    (err) => {
                        if (err) {
                            console.error("Error sending file:", err);
                            api.sendMessage("❌ Failed to send audio file.", threadID, messageID);
                        }
                        fs.unlink(filePath, (unlinkErr) => {
                            if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
                        });
                    }
                );
            });
        });

        writer.on("error", (err) => {
            console.error("Error downloading file:", err);
            api.sendMessage("❌ Failed to download the file.", threadID, messageID);
            fs.unlink(filePath, () => { });
        });

    } catch (error) {
        console.error("Error in muskan command execution:", error);
        api.sendMessage("❌ An error occurred while processing your request.", threadID, messageID);
    }
};

module.exports.handleEvent = async function ({ api, event }) {
  const { body, senderID, messageReply } = event;
  if (!body || senderID == api.getCurrentUserID()) return;
  if ((messageReply && messageReply.senderID == api.getCurrentUserID()) || body.toLowerCase().startsWith("muskan")) {
    this.run({ api, event, args: body.split(" ").slice(1) });
  }
};
