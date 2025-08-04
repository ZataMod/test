import OpenAI from "openai";
import axios from "axios";

// 🔐 Biến môi trường
const TOKEN = process.env.BOT_TOKEN;
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const TIKTOK_API = "https://tikwm.com/api/";

// 🎯 Trích URL TikTok từ văn bản
function extractTikTokUrl(text) {
  const match = text.match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/);
  return match ? match[0] : null;
}

// 📩 Gửi tin nhắn text
async function sendMessage(chatId, text, parse_mode = "Markdown") {
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id: chatId,
    text,
    parse_mode
  });
}

// 📤 Gửi audio (SoundCloud)
async function sendAudio(chatId, audioUrl, title, performer) {
  return axios.post(`${TELEGRAM_API}/sendAudio`, {
    chat_id: chatId,
    audio: audioUrl,
    title,
    performer
  });
}

// 🎥 Gửi video TikTok
async function sendVideo(chatId, videoUrl, caption) {
  return axios.post(`${TELEGRAM_API}/sendVideo`, {
    chat_id: chatId,
    video: videoUrl,
    caption
  });
}

// 🧠 Gọi OpenAI GPT-4o
async function askAI(question) {
  const client = new OpenAI({
    baseURL: "https://models.github.ai/inference",
    apiKey: GITHUB_TOKEN
  });

  const response = await client.chat.completions.create({
    messages: [
      { role: "system", content: "" },
      { role: "user", content: question }
    ],
    model: "openai/gpt-4o",
    temperature: 1,
    max_tokens: 4096,
    top_p: 1
  });

  return response.choices[0].message.content;
}

// 🚀 Hàm chính
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("🤖 Bot is running");

  const msg = req.body.message || req.body.edited_message;
  if (!msg || !msg.text) return res.status(200).send("No message");

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  try {
    // 🎵 SoundCloud command
    if (text.startsWith("/scl")) {
      const query = text.replace("/scl", "").trim();
      if (!query) {
        await sendMessage(chatId, "🔎 *Vui lòng nhập tên bài hát sau lệnh* `/scl <tên>`");
        return res.status(200).send("OK");
      }

      await sendMessage(chatId, `🎧 Đang tìm: *${query}*...`);
      const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${SOUNDCLOUD_CLIENT_ID}&limit=1`;
      const trackRes = await axios.get(searchUrl);
      const track = trackRes.data.collection?.[0];

      if (!track) {
        await sendMessage(chatId, "❌ Không tìm thấy bài hát.");
        return res.status(200).send("OK");
      }

      const streamObj = track.media.transcodings.find(t => t.format.protocol === "progressive");
      if (!streamObj) {
        await sendMessage(chatId, "⚠️ Bài hát không hỗ trợ tải.");
        return res.status(200).send("OK");
      }

      const streamRes = await axios.get(`${streamObj.url}?client_id=${SOUNDCLOUD_CLIENT_ID}`);
      const streamUrl = streamRes.data.url;

      await sendAudio(chatId, streamUrl, track.title, track.user.username);
    }

    // 📹 TikTok link
    else if (text.includes("tiktok.com")) {
      const tiktokUrl = extractTikTokUrl(text);
      if (!tiktokUrl) return res.status(200).send("No TikTok URL");

      await sendMessage(chatId, "📥 Đang xử lý video TikTok...");

      const resTikTok = await axios.get(TIKTOK_API, { params: { url: tiktokUrl } });
      const data = resTikTok.data?.data;
      const videoUrl = data?.play;

      if (videoUrl) {
        await sendVideo(chatId, videoUrl, data.title || "🎬 Video TikTok");
      } else {
        await sendMessage(chatId, "❌ Không thể tải video TikTok.");
      }
    }

    // 💬 Hỏi AI
    else if (text.startsWith("/ask")) {
      const prompt = text.replace("/ask", "").trim();
      if (!prompt) {
        await sendMessage(chatId, "🧠 *Vui lòng nhập nội dung sau lệnh* `/ask <câu hỏi>`");
        return res.status(200).send("OK");
      }

      const reply = await askAI(prompt);
      await sendMessage(chatId, `🤖 *Trả lời:*\n${reply}`);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error:", err.message);
    await sendMessage(chatId, "⚠️ Đã xảy ra lỗi khi xử lý yêu cầu.");
    res.status(200).send("ERR");
  }
  }
