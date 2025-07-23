const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const TIKTOK_API = "https://tikwm.com/api/";

function extractTikTokUrl(text) {
  const match = text.match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/);
  return match ? match[0] : null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(200).send("🤖 Bot is running");

  const msg = req.body.message || req.body.edited_message;
  if (!msg || !msg.text) return res.status(200).send("No message");

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  try {
    // ✅ /yt: search YouTube and send iframe
    if (text.startsWith("/yt")) {
      const query = text.replace("/yt", "").trim();
      if (!query) {
        await sendMessage(chatId, "🔎 Vui lòng nhập từ khóa sau lệnh /yt");
        return res.status(200).send("OK");
      }

      await sendMessage(chatId, `🔍 Đang tìm kiếm: ${query}...`);

      // Gọi YouTube API
      const ytRes = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: {
          key: YOUTUBE_API_KEY,
          q: query,
          part: "snippet",
          maxResults: 1,
          type: "video"
        }
      });

      const video = ytRes.data.items?.[0];
      if (!video) {
        await sendMessage(chatId, "❌ Không tìm thấy video YouTube.");
        return res.status(200).send("OK");
      }

      const videoId = video.id.videoId;
      const title = video.snippet.title;
      const embedHtml = `<a href="https://www.youtube.com/watch?v=${videoId}">&#8205;</a><b>${title}</b>\n▶️ https://www.youtube.com/watch?v=${videoId}`;

      await sendHTML(chatId, embedHtml);
    }

    // ✅ TikTok video downloader
    else if (text.includes("tiktok.com")) {
      const tiktokUrl = extractTikTokUrl(text);
      if (!tiktokUrl) return res.status(200).send("No TikTok URL");

      await sendMessage(chatId, "📥 Đang xử lý video TikTok...");

      const resTikTok = await axios.get(TIKTOK_API, { params: { url: tiktokUrl } });
      const data = resTikTok.data?.data;
      const videoUrl = data?.play;

      if (videoUrl) {
        await sendVideo(chatId, videoUrl, data.title || "Video từ TikTok");
      } else {
        await sendMessage(chatId, "❌ Không thể tải video TikTok.");
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error:", err.message);
    await sendMessage(chatId, "⚠️ Đã xảy ra lỗi khi xử lý yêu cầu.");
    res.status(200).send("ERR");
  }
};

async function sendMessage(chatId, text) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
  });
}

async function sendHTML(chatId, html) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    disable_web_page_preview: false
  });
}

async function sendVideo(chatId, videoUrl, caption) {
  return axios.post(`${TELEGRAM_API}/sendVideo`, {
    chat_id: chatId,
    video: videoUrl,
    caption,
  });
    }
