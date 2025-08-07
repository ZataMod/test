import axios from 'axios';
import querystring from 'querystring';

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

/**
 * Gửi ảnh chào mừng khi có thành viên mới vào nhóm
 * @param {Object} message - Thông tin message từ Telegram Webhook
 */
export async function handleNewMember(message) {
  const newMembers = message.new_chat_members || [];
  const chatId = message.chat?.id;

  if (!Array.isArray(newMembers) || newMembers.length === 0 || !chatId) return;

  for (const user of newMembers) {
    let name = user.first_name || '';
    if (user.last_name) {
      name += ` ${user.last_name}`;
    }

    // Lấy avatar nếu có
    let avatarUrl = 'https://i.imgur.com/NoAvatar.png'; // mặc định

    try {
      const profilePhotosRes = await axios.get(`${TELEGRAM_API}/getUserProfilePhotos`, {
        params: {
          user_id: user.id,
          limit: 1,
        },
      });

      const photos = profilePhotosRes.data.result.photos;
      if (photos.length > 0 && photos[0].length > 0) {
        const fileId = photos[0][0].file_id;

        const fileInfoRes = await axios.get(`${TELEGRAM_API}/getFile`, {
          params: { file_id: fileId },
        });

        const filePath = fileInfoRes.data.result.file_path;
        avatarUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;
      }
    } catch (err) {
      console.warn('Không lấy được avatar:', err.message);
    }

    // Tạo URL banner
    const bannerUrl = `https://banner-black.vercel.app?` + querystring.stringify({
      name,
      avatar: avatarUrl,
    });

    // Gửi ảnh chào mừng vào nhóm
    try {
      await axios.post(`${TELEGRAM_API}/sendPhoto`, {
        chat_id: chatId,
        photo: bannerUrl,
        caption: `🎉 Chào mừng ${name} đến với nhóm!`,
      });
    } catch (err) {
      console.error('Lỗi khi gửi ảnh:', err.message);
    }
  }
}
