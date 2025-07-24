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
  if (req.method !== "POST") return res.status(200).send("🤖 Bot is running");

  const msg = req.body.message || req.body.edited_message;
  if (!msg || !msg.text) return res.status(200).send("No message");

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text.trim();

  try {
    // ✅ /all: Tag toàn bộ admin, ẩn nội dung, chỉ admin dùng được
    if (text.startsWith("/all")) {
      if (msg.chat.type === "private") {
        await sendMessage(chatId, "🚫 Lệnh này chỉ dùng trong nhóm.");
        return res.status(200).send("OK");
      }

      const adminRes = await axios.get(`${TELEGRAM_API}/getChatAdministrators?chat_id=${chatId}`);
      const admins = adminRes.data.result;

      const isAdmin = admins.some(admin => admin.user.id === userId);
      if (!isAdmin) {
        await sendMessage(chatId, "🚫 Chỉ admin mới có thể dùng lệnh này.");
        return res.status(200).send("OK");
      }

      const tags = admins.map(admin => `[‎](tg://user?id=${admin.user.id})`).join(" ");
      await sendMessage(chatId, tags || "Không tìm thấy ai để tag.");
      return res.status(200).send("OK");
    }

    // ✅ /scl: tìm nhạc SoundCloud
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
      if (!streamObj) {
        await sendMessage(chatId, "⚠️ Bài hát này không có định dạng hỗ trợ.");
        return res.status(200).send("OK");
      }

      const streamRes = await axios.get(`${streamObj.url}?client_id=${SOUNDCLOUD_CLIENT_ID}`);
      const streamUrl = streamRes.data.url;

      await sendAudio(chatId, streamUrl, track.title, track.user.username);
      return res.status(200).send("OK");
    }

    // ✅ TikTok video
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

      return res.status(200).send("OK");
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error:", err.message);
    await sendMessage(chatId, "⚠️ Đã xảy ra lỗi khi xử lý yêu cầu.");
    return res.status(200).send("ERR");
  }
};

async function sendMessage(chatId, text) {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
    disable_notification: true,
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

async function sendVideo(chatId, videoUrl, caption) {
  return axios.post(`${TELEGRAM_API}/sendVideo`, {
    chat_id: chatId,
    video: videoUrl,
    caption,
  });
  }
