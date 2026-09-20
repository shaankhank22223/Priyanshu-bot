const fs = require("fs");
const path = require("path");
const axios = require("axios");
const ytSearch = require("yt-search");

const AI_API = "https://uzairrajputapis.qzz.io/api/ai/gemini";
const OWNER_TAG = "»»𝑶𝑾𝑵𝑬𝑹««★™  »»𝑺𝑯𝑨𝑨𝑵 𝑲𝑯𝑨𝑵««";
const OWNER_UID = "100016828397863"; // Shaan Khan UID

module.exports.config = {
    name: "muskan",
    aliases: ["music", "yt", "ytmusic", "sing", "song"],
    version: "1.3.0",
    credit: "𝐏𝐫𝐢𝐲𝐚𝐧𝐬𝐡 𝐑𝐚𝐣𝐩𝐮𝐭",
    description: "Download music (audio) or video from YouTube or chat with Muskan AI",
    hasPrefix: true,
    permission: 'PUBLIC',
    category: "MEDIA",
    usages: "[song name / URL] or [song name video] or [muskan <message>]",
    cooldown: 5,
};

module.exports.run = async function ({ api, message, args }) {
    const { threadID, messageID, senderID } = message;

    // Check if input is empty or just 'muskan'
    if (!args.length || (args.length === 1 && args[0].toLowerCase() === "muskan")) {
        return api.sendMessage("Bolo na Shaan, kya baat karni hai ya kaun sa gaana maang rahe ho? 😘", threadID, messageID);
    }

    // AI Chat trigger if command used as 'muskan <text>'
    if (args[0].toLowerCase() === "muskan" && args.length > 1) {
        const userQuery = args.slice(1).join(" ");
        
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

User Message: ${userQuery}
Muskan:`;

        try {
            const aiRes = await axios.post(AI_API, { prompt: prompt });
            if (aiRes.data && (aiRes.data.response || aiRes.data.message || aiRes.data.reply)) {
                const replyText = aiRes.data.response || aiRes.data.message || aiRes.data.reply;
                return api.sendMessage(replyText, threadID, messageID);
            } else {
                return api.sendMessage("Haan ji bolain, main sun rahi hoon! ✨", threadID, messageID);
            }
        } catch (aiErr) {
            console.error("AI Error:", aiErr);
            return api.sendMessage("Haan ji bolain, main sun rahi hoon! ✨", threadID, messageID);
        }
    }

    const apiKey = global.config.apiKeys?.priyanshuApi;
    if (!apiKey) {
        return api.sendMessage("❌ API key not found in config.", threadID, messageID);
    }

    // Check if user requested video format
    let isVideoMode = false;
    let inputArgs = [...args];

    if (inputArgs.length > 1 && inputArgs[inputArgs.length - 1].toLowerCase() === "video") {
        isVideoMode = true;
        inputArgs.pop(); // Remove 'video' from end
    }

    const input = inputArgs.join(" ");
    let videoUrl = input;
    let videoTitle = "";
    let videoAuthor = "Unknown";
    let searchingMessageInfo = null;

    try {
        // Check if input is a YouTube URL
        const isUrl = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com|youtu\.be)(\/|$)/.test(input);

        if (!isUrl) {
            searchingMessageInfo = await api.sendMessage(`🔍 Searching for ${isVideoMode ? "video" : "audio"}: ${input}...`, threadID, messageID);
            const searchResult = await ytSearch(input);
            if (!searchResult || !searchResult.videos.length) {
                return api.sendMessage("❌ Song/Video not found on YouTube.", threadID, messageID);
            }
            const video = searchResult.videos[0];
            videoUrl = video.url;
            videoTitle = video.title;
            videoAuthor = video.author ? video.author.name : "Unknown Artist";
        } else {
            searchingMessageInfo = await api.sendMessage(`🔍 Processing URL...`, threadID, messageID);
            try {
                const videoIdMatch = input.match(/(?:youtube\.com\/(?:watch\?.*v=|shorts\/|embed\/|v\/)|youtu\.be\/)([0-9A-Za-z_-]{11})/);
                if (videoIdMatch) {
                    const videoId = videoIdMatch[1];
                    videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
                    const searchResult = await ytSearch({ videoId: videoId });
                    if (searchResult) {
                        videoTitle = searchResult.title;
                        videoAuthor = searchResult.author ? searchResult.author.name : "Unknown Artist";
                    }
                }
            } catch (e) {
                // Ignore error fetching details for URL
            }
        }

        // Call API according to mode (mp3 or mp4)
        const format = isVideoMode ? "mp4" : "mp3";
        const apiUrl = "https://priyanshuapi.qzz.io/api/runner/youtube-downloader-v2/download";
        
        const response = await axios.post(
            apiUrl,
            {
                link: videoUrl,
                format: format,
                videoQuality: "360",
            },
            {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
            }
        );

        if (!response.data || !response.data.success || !response.data.data) {
            if (searchingMessageInfo) api.unsendMessage(searchingMessageInfo.messageID);
            return api.sendMessage("❌ Failed to generate download link.", threadID, messageID);
        }

        const { downloadUrl, title, filename } = response.data.data;
        const finalTitle = videoTitle || title || "Unknown Title";

        // Check file size limit (50MB)
        const maxSizeBytes = 50 * 1024 * 1024;
        try {
            const headResponse = await axios.head(downloadUrl);
            const contentLength = headResponse.headers["content-length"];
            if (contentLength && parseInt(contentLength) > maxSizeBytes) {
                if (searchingMessageInfo) api.unsendMessage(searchingMessageInfo.messageID);
                return api.sendMessage("❌ File size exceeds the limit (50MB).", threadID, messageID);
            }
        } catch (headError) {
            console.error("Error checking file size:", headError);
        }

        // Clean Info Message format
        const infoMsg = `🖤 𝗧𝗶𝘁𝗹𝗲: ${finalTitle}\n\n👤 𝗔𝗿𝘁𝗶𝘀𝘁: ${videoAuthor}\n\n${OWNER_TAG}\n🥀𝒀𝑬 𝑳𝑶 𝑨𝑷𝑲𝑰 👉 ${format.toUpperCase()}`;

        api.sendMessage(infoMsg, threadID, () => {
            if (searchingMessageInfo) {
                api.unsendMessage(searchingMessageInfo.messageID);
            }
        });

        // Download file locally
        const tempDir = path.join(__dirname, "temporary");
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const ext = isVideoMode ? "mp4" : "mp3";
        const defaultFilename = `${Date.now()}.${ext}`;
        const safeFilename = (filename || defaultFilename).replace(/[^a-zA-Z0-9.-]/g, "_");
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
                    console.error("[muskan] File is empty or unreadable:", filePath, statErr);
                    api.sendMessage("❌ Download failed (empty file). Please try again.", threadID, messageID);
                    return fs.unlink(filePath, () => { });
                }

                // Send the media attachment
                api.sendMessage(
                    {
                        body: `${isVideoMode ? "🎥" : "🎧"} ${finalTitle}`,
                        attachment: fs.createReadStream(filePath),
                    },
                    threadID,
                    (err) => {
                        if (err) {
                            console.error("Error sending file:", err);
                            api.sendMessage("❌ Failed to send media file.", threadID, messageID);
                        }
                        // Clean temp file
                        fs.unlink(filePath, (unlinkErr) => {
                            if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
                        });
                    }
                );
            });
        });

        writer.on("error", (err) => {
            console.error("Error downloading file:", err);
            api.sendMessage("❌ Failed to download the media file.", threadID, messageID);
            fs.unlink(filePath, () => { });
        });

    } catch (error) {
        console.error("Error in muskan command:", error);
        api.sendMessage("❌ An error occurred while processing your request.", threadID, messageID);
    }
};
