import axios from 'axios';

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

export default async function handler(req, res) {
  const body = req.body;

  if (!body?.message || !body.message.text) {
    return res.status(200).send('No message');
  }

  const message = body.message;
  const chat_id = message.chat.id;
  const from_id = message.from.id;
  const text = message.text;

  // /all command
  if (text === '/all') {
    try {
      // Kiểm tra user là admin
      const adminsRes = await axios.get(`${TELEGRAM_API}/getChatAdministrators`, {
        params: { chat_id }
      });

      const isAdmin = adminsRes.data.result.some((admin) => admin.user.id === from_id);

      if (!isAdmin) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id,
          text: "❌ Bạn không có quyền sử dụng lệnh này.",
        });
        return res.status(200).send("Not admin");
      }

      // Lấy danh sách member (số lượng hạn chế trên Telegram Bot API — workaround là dùng mention cứng)
      const members = adminsRes.data.result.map((admin) => {
        const name = admin.user.username
          ? `@${admin.user.username}`
          : `[${admin.user.first_name}](tg://user?id=${admin.user.id})`;
        return name;
      });

      // Ghép nội dung tag ẩn
      const invisibleChar = '\u2063'; // Zero-width non-joiner
      const mentionText = members.join(` ${invisibleChar} `);

      // Gửi tin nhắn tag all với nội dung ẩn
      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id,
        text: mentionText || "Không có thành viên để tag",
        parse_mode: "Markdown"
      });

      return res.status(200).send("Done");
    } catch (err) {
      console.error(err.response?.data || err.message);
      return res.status(500).send("Error");
    }
  }

  return res.status(200).send("No command");
}
