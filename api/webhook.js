import axios from "axios";
import querystring from "querystring";

// 🔐 Biến môi trường
const TOKEN = process.env.BOT_TOKEN;
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;
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

// Send Photo
async function sendPhoto(chatId, photoUrl) {
  return axios.post(`${TELEGRAM_API}/sendPhoto`, {
    chat_id: chatId,
    photo: photoUrl
  });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

async function askAI(prompt) {
  const payload = {
    contents: [
      { parts: [{ text: prompt }] }
    ]
  };

  const headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": GEMINI_API_KEY
  };

  const params = { alt: "json", prettyPrint: "false" };

  try {
    const res = await axios.post(GEMINI_URL, payload, { headers, params });

    if (res.status === 200) {
      return res.data.candidates[0].content.parts[0].text;
    } else {
      return "Mạng lag";
    }
  } catch (err) {
    console.error("Gemini API Error:", err.response?.data || err.message);
    return "⚠️ Lỗi khi gọi Gemini API.";
  }
}

// Bỏ dấu tiếng Việt
function bo_dau(text) {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Đ/g, "D")
    .replace(/đ/g, "d")
    .split(/\s+/)
    .join("-");
}

// Hàm GET request dùng axios
async function fetch(url) {
  try {
    const res = await axios.get(url);
    return res.data;
  } catch (err) {
    throw err;
  }
}

// Hàm lấy value theo regex
function get(pattern, text) {
  let regex = new RegExp(pattern + '">(.*?)<', "s");
  let match = text.match(regex);
  return match ? match[1].trim() : "";
}

// Hàm chính: trả về string
async function getWeather(tinh, huyen) {
  tinh = bo_dau(tinh).toLowerCase();
  huyen = bo_dau(huyen).toLowerCase();

  const html = await fetch(`https://thoitiet.edu.vn/${tinh}/${huyen}`);

  const location = [
    'breadcrumb-item active" aria-current="(.*?)',
    'breadcrumb-item"><a href="(.*?)',
  ];

  const data_map = {
    "🌡️  Nhiệt Độ": "<span(.*?)current-temperature",
    "🌥️  Hiện Tượng": "<p(.*?)overview-caption-item overview-caption-item-detail",
    "🔻 Thấp/Cao": "Thấp/Cao(.*?)text-white op-8 fw-bold",
    "💧 Độ Ẩm": "Độ ẩm(.*?)text-white op-8 fw-bold",
    "👁️  Tầm Nhìn": "Tầm nhìn(.*?)text-white op-8 fw-bold",
    "🍃 Gió": "Gió(.*?)text-white op-8 fw-bold",
    "❄️ Điểm Ngưng": "Điểm ngưng(.*?)text-white op-8 fw-bold",
    "🔆 UV": "UV(.*?)text-white op-8 fw-bold",
  };

  let result = `\nDự báo Thời tiết ${get(location[0], html)} - ${get(
    location[1],
    html
  )}\n\n`;

  for (const [key, pattern] of Object.entries(data_map)) {
    const value = get(pattern, html);
    result += `${key}: ${value || "N/A"}\n`;
  }

  return result;
}

// 👋 Gửi ảnh chào mừng thành viên mới
async function handleNewMember(message) {
  const newMembers = message.new_chat_members;
  const chatId = message.chat.id;

  if (!Array.isArray(newMembers)) return;

  for (const user of newMembers) {
    let name = user.first_name || "";
    if (user.last_name) name += ` ${user.last_name}`;

    // Avatar mặc định
    let avatarUrl = "https://i.imgur.com/2WZtOD6.png";

    try {
      const profileRes = await axios.get(`${TELEGRAM_API}/getUserProfilePhotos`, {
        params: { user_id: user.id, limit: 1 }
      });

      const photos = profileRes.data.result.photos;
      if (photos?.[0]?.[0]) {
        const fileId = photos[0][0].file_id;
        const fileInfo = await axios.get(`${TELEGRAM_API}/getFile`, {
          params: { file_id: fileId }
        });
        const filePath = fileInfo.data.result.file_path;
        avatarUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
      }
    } catch (err) {
      console.warn("Không lấy được avatar:", err.message);
    }

    // Gửi ảnh banner từ dịch vụ tùy chỉnh
    const bannerUrl = `https://banner-black.vercel.app?` + querystring.stringify({
      name,
      avatar: avatarUrl
    });

    await axios.post(`${TELEGRAM_API}/sendPhoto`, {
      chat_id: chatId,
      photo: bannerUrl,
      caption: `🎉 Chào mừng ${name} đến với nhóm!`
    });
  }
}

async function getBingImages(keyword, limit = 5) {
    const url = `https://www.bing.com/images/search?q=${encodeURIComponent(keyword)}&form=HDRSC2`;
    const headers = { "User-Agent": "Mozilla/5.0" };

    try {
        const { data: html } = await axios.get(url, { headers });

        // Regex tìm link ảnh gốc
        const matches = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)];

        const links = [];
        for (const match of matches) {
            const link = match[1];
            if (!links.includes(link)) {
                links.push(link);
            }
            if (links.length >= limit) break;
        }

        return links;
    } catch (err) {
        console.error("Lỗi khi lấy ảnh:", err.message);
        return [];
    }
}

// 🚀 Hàm chính xử lý webhook
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("🤖 Bot is running");

  const msg = req.body.message || req.body.edited_message;
  if (!msg) return res.status(200).send("No message");

  const chatId = msg.chat.id;

  try {
    // 👋 Thành viên mới
    if (msg.new_chat_members) {
      await handleNewMember(msg);
      return res.status(200).send("OK");
    }

    if (!msg.text) return res.status(200).send("No text");

    const text = msg.text.trim();

    // 🎵 SoundCloud
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

    // 📹 TikTok
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

    // 💬 AI
    else if (text.startsWith("/ask")) {
      const prompt = text.replace("/ask", "").trim();
      if (!prompt) {
        await sendMessage(chatId, "🧠 *Vui lòng nhập nội dung sau lệnh* `/ask <câu hỏi>`");
        return res.status(200).send("OK");
      }

      const reply = await askAI(prompt);
      await sendMessage(chatId, `🤖 *Trả lời:*\n${reply}`);
    }

    else if (text.startsWith("/img")) {
      const key = text.replace("/img", "").trim();
      if (!key) {
        await sendMessage(chatId, "🧠 *Vui lòng nhập nội dung sau lệnh* `/img <key>`");
        return res.status(200).send("OK");
      }

      const images = await getBingImages(key);
      for (let i = 0; i < images.length; i++) {
        await sendPhoto(chatId, images[i]);
      }
      return res.status(200).send("OK");
    }
    
    else if (text.startsWith("/wt")) {
      const key = text.replace("/wt", "").trim();
      if (!key || !key.includes(",")) {
        await sendMessage(chatId, "🌩️ *Vui lòng nhập nội dung sau lệnh* `/wt <Tỉnh/TP>, <Quận/Huyện>`");
        return res.status(200).send("OK");
      }
      let [tinh, huyen] = key.split(",").map((s) => s.trim());
      await sendMessage(chatId, await getWeather(tinh, huyen));
      return res.status(200).send("OK");
    } 
    
  } catch (err) {
    console.error("❌ Error:", err.message);
    await sendMessage(chatId, "⚠️ Đã xảy ra lỗi khi xử lý yêu cầu.");
    res.status(200).send("ERR");
  }
}
