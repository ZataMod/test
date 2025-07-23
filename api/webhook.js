const axios = require("axios");

const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}/sendMessage`;
const TIKTOK_API = "https://tikwm.com/api/";

const apiKey = process.env.YOUTUBE_API_KEY;
const botToken = process.env.BOT_TOKEN;

function extractTikTokUrl(text) {
  const match = text.match(/https?:\/\/(www\.)?tiktok\.com\/[^\s]+/);
  return match ? match[0] : null;
}

async function getTikTokInfo(url) {
  const api = `${TIKTOK_API}?url=${encodeURIComponent(url)}`;
  const { data } = await axios.get(api);
  if (data.code === 0) {
    return {
      title: data.data.title,
      video_url: data.data.play,
      cover: data.data.cover,
    };
  } else {
    throw new Error("Không tìm thấy video TikTok");
  }
}

async function searchYouTube(query) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}+music&type=video&key=${apiKey}&maxResults=1`;
  const { data } = await axios.get(url);
  return data.items.length > 0 ? data.items[0] : null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { token, chat_id, message } = req.body;
    if (!token || !chat_id || !message) {
      return res.status(400).json({ error: "Missing fields: token, chat_id, or message" });
    }

    // TikTok URL extraction
    const tiktokUrl = extractTikTokUrl(message);
    if (tiktokUrl) {
      const info = await getTikTokInfo(tiktokUrl);
      await axios.post(TELEGRAM_API(token), {
        chat_id,
        text: `🎵 ${info.title}\n📽️ [Xem video](${info.video_url})`,
        parse_mode: "Markdown",
      });
      return res.json({ status: "Sent TikTok info" });
    }

    // YouTube search for music
    const ytResult = await searchYouTube(message);
    if (ytResult) {
      await axios.post(TELEGRAM_API(token), {
        chat_id,
        text: `🔎 Tìm thấy trên YouTube:\n🎶 *${ytResult.snippet.title}*\n▶️ ${ytResult.snippet.title}\n[Watch here](https://www.youtube.com/watch?v=${ytResult.id.videoId})`,
        parse_mode: "Markdown",
      });
      return res.json({ status: "Sent YouTube result" });
    }

    return res.status(404).json({ error: "Không tìm thấy TikTok hoặc bài hát phù hợp" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
};
