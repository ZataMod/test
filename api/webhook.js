import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.BOT_TOKEN}`;
const YT_API = "https://www.googleapis.com/youtube/v3/search";

export default async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  const body = req.body;
  const msg = body.message;
  if (!msg || !msg.text) return res.status(200).send("No message");

  const chatId = msg.chat.id;
  const text = msg.text;

  // 1️⃣ /yt <tên bài hát>
  if (text.startsWith("/yt ")) {
    const query = text.slice(4).trim();
    try {
      const ytRes = await axios.get(YT_API, {
        params: {
          part: "snippet",
          q: query + " music",
          type: "video",
          key: process.env.YOUTUBE_API_KEY,
          maxResults: 1
        }
      });

      const items = ytRes.data.items;
      if (items && items.length > 0) {
        const videoId = items[0].id.videoId;
        const title = items[0].snippet.title;
        const url = `https://www.youtube.com/watch?v=${videoId}`;

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `🎵 ${title}\n🔗 ${url}`
        });
      } else {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "❌ Không tìm thấy bài hát."
        });
      }
    } catch (e) {
      console.error(e);
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "⚠️ Lỗi khi tìm kiếm bài hát."
      });
    }
    return res.status(200).end();
  }

  // 2️⃣ Tự động phát hiện link TikTok
  const tiktokRegex = /(https?:\/\/[^\s]*tiktok\.com[^\s]*)/;
  const match = text.match(tiktokRegex);
  if (match) {
    const url = match[1];
    try {
      const resTik = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`);
      const data = resTik.data.data;

      if (data && data.play) {
        await axios.post(`${TELEGRAM_API}/sendVideo`, {
          chat_id: chatId,
          video: data.play,
          caption: data.title || "🎬 Video TikTok"
        });
      } else {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "❌ Không lấy được video TikTok."
        });
      }
    } catch (e) {
      console.error(e);
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: "⚠️ Lỗi khi tải TikTok."
      });
    }
    return res.status(200).end();
  }

  // Trường hợp không khớp gì
  await axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text: "❓ Gõ /yt <tên bài hát> hoặc gửi link TikTok để tải video."
  });

  res.status(200).end();
};
