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
  const text = msg.text.trim();
  const senderId = msg.from.id;

  try {
    // ✅ Command: /all — tag all members (chỉ admin)
    if (text === "/all") {
      const isAdmin = await checkAdmin(chatId, senderId);
      if (!isAdmin) {
        await sendMessage(chatId, "❌ Bạn không có quyền dùng lệnh này.");
        return res.status(200).send("OK");
      }

      // Get chat members (admin list as demo — you can expand later)
      const resp = await axios.get(`${TELEGRAM_API}/getChatAdministrators`, {
        params: { chat_id: chatId },
      });

      const members = resp.data.result;

      if (!members || members.length === 0) {
        await sendMessage(chatId, "❌ Không thể lấy danh sách thành viên.");
        return res.status(200).send("OK");
      }

      // Gắn thẻ từng thành viên có tên
      const mentions = members.map((m) => {
        const user = m.user;
        if (user.username) return `||@${user.username}||`;
        return `||[${user.first_name}](tg://user?id=${user.id})||`;
      });

      const chunkSize = 30;
      for (let i = 0; i < mentions.length; i += chunkSize) {
        const chunk = mentions.slice(i, i + chunkSize).join(" ");
        await sendMessage(chatId, chunk, "MarkdownV2");
      }

      return res.status(200).send("OK");
    }

    // 🔍 Command: /scl
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
    }

    // 📥 TikTok link
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

// 📤 Send plain message
async function sendMessage(chatId, text, mode = "HTML") {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode: mode,
    disable_notification: true,
  });
}

// 🎵 Send audio file
async function sendAudio(chatId, audioUrl, title, performer) {
  return axios.post(`${TELEGRAM_API}/sendAudio`, {
    chat_id: chatId,
    audio: audioUrl,
    title,
    performer,
  });
}

// 📹 Send video file
async function sendVideo(chatId, videoUrl, caption) {
  return axios.post(`${TELEGRAM_API}/sendVideo`, {
    chat_id: chatId,
    video: videoUrl,
    caption,
  });
}

// 🔐 Check if sender is admin
async function checkAdmin(chatId, userId) {
  try {
    const res = await axios.get(`${TELEGRAM_API}/getChatMember`, {
      params: { chat_id: chatId, user_id: userId },
    });
    const status = res.data.result.status;
    return status === "administrator" || status === "creator";
  } catch (e) {
    return false;
  }
  }
