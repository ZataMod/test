const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;
const GENIUS_TOKEN = process.env.GENIUS_TOKEN;
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

  try {
    // 🎵 /scl - SoundCloud
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

    // 📄 /lyrics - lấy lời bài hát
    else if (text.startsWith("/lyric")) {
      const query = text.replace("/lyric", "").trim();
      if (!query) {
        await sendMessage(chatId, "📄 Vui lòng nhập tên bài hát sau lệnh /lyric");
        return res.status(200).send("OK");
      }

      await sendMessage(chatId, `📖 Đang tìm lời bài hát cho: *${query}*`);

      // Tìm bài hát
      const searchRes = await axios.get(`https://api.genius.com/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${GENIUS_TOKEN}` }
      });

      const song = searchRes.data.response.hits?.[0]?.result;
      if (!song) {
        await sendMessage(chatId, "❌ Không tìm thấy bài hát.");
        return res.status(200).send("OK");
      }

      const songUrl = song.url;

      // Lấy lời bài hát từ trang web
      const htmlRes = await axios.get(songUrl);
      const html = htmlRes.data;
      const lyricsMatch = html.match(/<div[^>]+data-lyrics-container[^>]*>([\s\S]+?)<\/div><\/div>/);

      if (!lyricsMatch) {
        await sendMessage(chatId, "❌ Không thể trích xuất lời bài hát.");
        return res.status(200).send("OK");
      }

      let lyrics = lyricsMatch[1]
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .trim();

      if (lyrics.length > 4000) lyrics = lyrics.slice(0, 4000) + "\n...\n(Lời bài hát quá dài)";

      await sendMessage(chatId, `🎶 *${song.full_title}*\n\`\`\`\n${lyrics}\n\`\`\``);
    }

    // 📥 TikTok
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
    parse_mode: "Markdown"
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
