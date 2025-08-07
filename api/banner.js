// welcomeBanner.js (ES Module)
import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

// Hàm gửi ảnh
async function sendPhoto(chatId, photoUrl, caption) {
  return axios.post(`${TELEGRAM_API}/sendPhoto`, {
    chat_id: chatId,
    photo: photoUrl,
    caption,
  });
}

// Hàm xử lý thành viên mới
export async function handleNewMember(msg) {
  const newMember = msg?.new_chat_member;
  if (!newMember) return;

  const chatId = msg.chat.id;
  const name = `${newMember.first_name || ""} ${newMember.last_name || ""}`.trim();
  const userId = newMember.id;

  try {
    // Lấy ảnh đại diện Telegram
    const photos = await axios.get(`${TELEGRAM_API}/getUserProfilePhotos`, {
      params: { user_id: userId, limit: 1 },
    });

    const photo = photos.data.result.photos?.[0]?.[0];
    let avatarUrl = "";

    if (photo) {
      const fileId = photo.file_id;
      const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, {
        params: { file_id: fileId },
      });

      const filePath = fileRes.data.result.file_path;
      avatarUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
    }

    // Gửi banner chào mừng
    const bannerUrl = `https://banner-black.vercel.app?name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatarUrl)}`;
    await sendPhoto(chatId, bannerUrl, `👋 Chào mừng ${name} đến với nhóm!`);
  } catch (err) {
    console.error("❌ Lỗi khi gửi banner chào:", err.message);
  }
}
