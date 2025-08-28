import axios from "axios";
import querystring from "querystring";

// 🔐 Biến môi trường
const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID;
const TIKTOK_API = "https://tikwm.com/api/";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Axios mặc định timeout 20s
const axiosInstance = axios.create({ timeout: 20000 });

// 📩 Gửi tin nhắn text
async function sendMessage(chatId, text, parse_mode = "Markdown") {
  return axiosInstance.post(`${TELEGRAM_API}/sendMessage`, { chat_id: chatId, text, parse_mode });
}

// 📤 Gửi audio (SoundCloud)
async function sendAudio(chatId, audioUrl, title, performer) {
  return axiosInstance.post(`${TELEGRAM_API}/sendAudio`, { chat_id: chatId, audio: audioUrl, title, performer });
}

// 🎥 Gửi video TikTok
async function sendVideo(chatId, videoUrl, caption) {
  return axiosInstance.post(`${TELEGRAM_API}/sendVideo`, { chat_id: chatId, video: videoUrl, caption });
}

// Send Photo
async function sendPhoto(chatId, photoUrl) {
  return axiosInstance.post(`${TELEGRAM_API}/sendPhoto`, { chat_id: chatId, photo: photoUrl });
}

// 🎯 Trích URL TikTok từ văn bản
function extractTikTokUrl(text) {
  const match = text.match(/https?:\/\/[^\s]*tiktok\.com[^\s]*/);
  return match ? match[0] : null;
}

// Bỏ dấu tiếng Việt
function bo_dau(text) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d").split(/\s+/).join("-");
}

// Regex lấy value
function get(pattern, text) {
  const regex = new RegExp(pattern + '">(.*?)<', "s");
  const match = text.match(regex);
  return match ? match[1].trim() : "";
}

// Weather
async function getWeather(tinh, huyen) {
  tinh = bo_dau(tinh).toLowerCase();
  huyen = bo_dau(huyen).toLowerCase();
  let html;
  try {
    const res = await axiosInstance.get(`https://thoitiet.edu.vn/${tinh}/${huyen}`);
    html = res.data;
  } catch {
    return "⚠️ Không thể lấy dữ liệu thời tiết.";
  }

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

  let result = `\nDự báo Thời tiết ${get(location[0], html)} - ${get(location[1], html)}\n\n`;

  for (const [key, pattern] of Object.entries(data_map)) {
    const value = get(pattern, html);
    result += `${key}: ${value || "N/A"}\n`;
  }

  return result;
}

// Gemini AI
async function askAI(prompt) {
  try {
    const res = await axiosInstance.post(GEMINI_URL, { contents: [{ parts: [{ text: prompt }] }] }, { headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY } });
    return res.data?.candidates?.[0]?.content?.parts?.[0]?.text || "⚠️ Không có phản hồi từ AI";
  } catch {
    return "⚠️ Lỗi khi gọi Gemini API.";
  }
}

// Bing images
async function getBingImages(keyword, limit = 5) {
  const url = `https://www.bing.com/images/search?q=${encodeURIComponent(keyword)}&form=HDRSC2`;
  const headers = { "User-Agent": "Mozilla/5.0" };
  try {
    const { data: html } = await axiosInstance.get(url, { headers });
    const matches = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)];
    const links = [...new Set(matches.map(m => m[1]))].slice(0, limit);
    return links;
  } catch {
    return [];
  }
}

// Handle new members
async function handleNewMember(message) {
  const newMembers = message.new_chat_members;
  const chatId = message.chat.id;
  if (!Array.isArray(newMembers)) return;

  await Promise.all(newMembers.map(async (user) => {
    let name = user.first_name + (user.last_name ? ` ${user.last_name}` : "");
    let avatarUrl = "https://i.imgur.com/2WZtOD6.png";
    try {
      const profileRes = await axiosInstance.get(`${TELEGRAM_API}/getUserProfilePhotos`, { params: { user_id: user.id, limit: 1 } });
      const photos = profileRes.data.result.photos;
      if (photos?.[0]?.[0]) {
        const fileId = photos[0][0].file_id;
        const fileInfo = await axiosInstance.get(`${TELEGRAM_API}/getFile`, { params: { file_id: fileId } });
        avatarUrl = `https://api.telegram.org/file/bot${TOKEN}/${fileInfo.data.result.file_path}`;
      }
    } catch {}
    const bannerUrl = `https://banner-black.vercel.app?` + querystring.stringify({ name, avatar: avatarUrl });
    await sendPhoto(chatId, bannerUrl);
    await sendMessage(chatId, `🎉 Chào mừng ${name} đến với nhóm!`);
  }));
}

// Main handler
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("🤖 Bot is running");

  const msg = req.body.message || req.body.edited_message;
  if (!msg) return res.status(200).send("No message");

  const chatId = msg.chat.id;

  // Trả về nhanh ngay lập tức để tránh timeout
  res.status(200).send("OK");

  (async () => {
    try {
      // New members
      if (msg.new_chat_members) return await handleNewMember(msg);

      if (!msg.text) return;

      const text = msg.text.trim();

      // SoundCloud
      if (text.startsWith("/scl")) {
        const query = text.replace("/scl", "").trim();
        if (!query) return await sendMessage(chatId, "🔎 Vui lòng nhập tên bài hát `/scl <tên>`");
        const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${SOUNDCLOUD_CLIENT_ID}&limit=1`;
        const trackRes = await axiosInstance.get(searchUrl);
        const track = trackRes.data.collection?.[0];
        if (!track) return await sendMessage(chatId, "❌ Không tìm thấy bài hát.");
        const streamObj = track.media.transcodings.find(t => t.format.protocol === "progressive");
        if (!streamObj) return await sendMessage(chatId, "⚠️ Bài hát không hỗ trợ tải.");
        const streamRes = await axiosInstance.get(`${streamObj.url}?client_id=${SOUNDCLOUD_CLIENT_ID}`);
        await sendAudio(chatId, streamRes.data.url, track.title, track.user.username);
      }

      // TikTok
      else if (text.includes("tiktok.com")) {
        const tiktokUrl = extractTikTokUrl(text);
        if (!tiktokUrl) return;
        const resTikTok = await axiosInstance.get(TIKTOK_API, { params: { url: tiktokUrl } });
        const videoUrl = resTikTok.data?.data?.play;
        if (videoUrl) await sendVideo(chatId, videoUrl, resTikTok.data?.data?.title || "🎬 Video TikTok");
        else await sendMessage(chatId, "❌ Không thể tải video TikTok.");
      }

      // AI
      else if (text.startsWith("/ask")) {
        const prompt = text.replace("/ask", "").trim();
        if (!prompt) return await sendMessage(chatId, "🧠 Vui lòng nhập nội dung `/ask <câu hỏi>`");
        const reply = await askAI(prompt);
        await sendMessage(chatId, `🤖 Trả lời:\n${reply}`);
      }

      // Bing Images
      else if (text.startsWith("/img")) {
        const key = text.replace("/img", "").trim();
        if (!key) return await sendMessage(chatId, "🧠 Vui lòng nhập `/img <key>`");
        const images = await getBingImages(key);
        await Promise.all(images.map(url => sendPhoto(chatId, url)));
      }

      // Weather
      else if (text.startsWith("/wt")) {
        const key = text.replace("/wt", "").trim();
        if (!key.includes(",")) return await sendMessage(chatId, "🌩️ Vui lòng nhập `/wt <Tỉnh/TP>, <Quận/Huyện>`");
        let [tinh, huyen] = key.split(",").map(s => s.trim());
        const result = await getWeather(tinh, huyen);
        await sendMessage(chatId, result);
      }

    } catch (err) {
      console.error("❌ Error:", err.message);
      await sendMessage(chatId, "⚠️ Đã xảy ra lỗi khi xử lý yêu cầu.");
    }
  })();
}