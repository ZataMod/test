const axios = require("axios");

const TELEGRAM_TOKEN = process.env.BOT_TOKEN;
const YOUTUBE_API_KEY = process.env.YT_API_KEY;
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const TIKTOK_API = "https://tikwm.com/api/";

function extractTikTokUrl(text) {
  const match = text.match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/);
  return match ? match[0] : null;
}

async function handleTelegramUpdate(update) {
  const chatId = update.message.chat.id;
  const text = update.message.text;

  // 👉 TikTok link detection anywhere in the message
  const tiktokUrl = extractTikTokUrl(text);
  if (tiktokUrl) {
    try {
      const response = await axios.get(TIKTOK_API, {
        params: { url: tiktokUrl }
      });
      const videoUrl = response.data.data.play;
      await axios.post(`${TELEGRAM_API}/sendVideo`, {
        chat_id: chatId,
        video: videoUrl,
        caption: "✅ Tải TikTok không logo thành công!"
      });
    } catch (err) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "❌ Không thể tải video TikTok."
      });
    }
    return;
  }

  // 👉 /yt tên bài hát => tìm YouTube
  if (text.startsWith("/yt ")) {
    const query = text.replace("/yt ", "").trim();
    try {
      const ytResponse = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: {
          part: "snippet",
          q: `${query} music`,
          type: "video",
          key: YOUTUBE_API_KEY,
          maxResults: 1
        }
      });

      const video = ytResponse.data.items[0];
      const videoId = video.id.videoId;
      const title = video.snippet.title;
      const url = `https://www.youtube.com/watch?v=${videoId}`;

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `🎵 *${title}*\n🔗 ${url}`,
        parse_mode: "Markdown"
      });
    } catch (err) {
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "❌ Không tìm thấy bài hát."
      });
    }
    return;
  }

  // 👉 Gửi hướng dẫn nếu không khớp lệnh nào
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: `🔹 Gửi link TikTok bất kỳ để tải video.\n🔹 Gõ /yt <tên bài hát> để tìm nhạc YouTube.`
  });
}

export default async function handler(req, res) {
  if (req.method === "POST") {
    await handleTelegramUpdate(req.body);
    return res.status(200).end("OK");
  } else {
    return res.status(405).end("Method Not Allowed");
  }
}
