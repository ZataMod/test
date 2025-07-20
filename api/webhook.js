const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;
const TIKTOK_API = "https://tikwm.com/api/";
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

function extractTikTokUrl(text) {
  const match = text.match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/);
  return match ? match[0] : null;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return res.status(200).send("Bot is running");
  }

  try {
    const msg = req.body.message;
    const chatId = msg.chat.id;
    const text = msg.text || "";

    if (text.startsWith("/scl")) {
      const query = text.replace("/scl", "").trim();
      if (!query) {
        await sendMessage(chatId, "🔎 Vui lòng nhập tên bài hát sau lệnh /scl");
        return res.status(200).send("OK");
      }

      await sendMessage(chatId, `🎵 Đang tìm: ${query}...`);
      const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${SOUNDCLOUD_CLIENT_ID}&limit=1`;
      const trackRes = await axios.get(searchUrl);
      const track = trackRes.data.collection?.[0];

      if (!track) {
        await sendMessage(chatId, "❌ Không tìm thấy bài hát.");
        return res.status(200).send("OK");
      }

      const streamObj = track.media.transcodings.find(t => t.format.protocol === "progressive");
      const streamRes = await axios.get(`${streamObj.url}?client_id=${SOUNDCLOUD_CLIENT_ID}`);
      const streamUrl = streamRes.data.url;

      await sendAudio(chatId, streamUrl, track.title, track.user.username);
    } else if (text.includes("tiktok.com")) {
      const tiktokUrl = extractTikTokUrl(text);
      if (!tiktokUrl) return res.status(200).send("OK");

      await sendMessage(chatId, "📥 Đang xử lý video TikTok...");
      const resTikTok = await axios.get(TIKTOK_API, { params: { url: tiktokUrl } });
      const musicUrl = resTikTok.data?.data?.play;

      if (musicUrl) {
        await sendAudio(chatId, musicUrl, "Video từ TikTok", "TikTok");
      } else {
        await sendMessage(chatId, "❌ Không lấy được video TikTok.");
      }
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(200).send("ERR");
  }
};

async function sendMessage(chatId, text) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
  });
}

async function sendAudio(chatId, audioUrl, title, performer) {
  return axios.post(`${TELEGRAM_API}/sendAudio`, {
    chat_id: chatId,
    audio: audioUrl,
    title,
    performer,
  });
                        }
