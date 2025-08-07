// banner.js
const axios = require("axios");

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

/**
 * Xử lý khi có thành viên mới vào nhóm
 * @param {object} msg - message từ Telegram webhook
 */
async function handleNewMember(msg) {
  const newMember = msg?.new_chat_member;
  if (!newMember) return;

  const chatId = msg.chat.id;
  const name = `${newMember.first_name || ""} ${newMember.last_name || ""}`.trim();
  const userId = newMember.id;

  try {
    // Lấy ảnh đại diện người dùng
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

    // Tạo banner
    const bannerUrl = `https://banner-black.vercel.app?name=${encodeURIComponent(name)}&avatar=${encodeURIComponent(avatarUrl)}`;

    // Gửi banner vào nhóm
    await sendPhoto(chatId, bannerUrl, `👋 Chào mừng ${name} đến với nhóm!`);
  } catch (err) {
    console.error("❌ Lỗi gửi banner chào:", err.message);
  }
}

async function sendPhoto(chatId, photoUrl, caption) {
  return axios.post(`${TELEGRAM_API}/sendPhoto`, {
    chat_id: chatId,
    photo: photoUrl,
    caption,
  });
}

module.exports = { handleNewMember };
