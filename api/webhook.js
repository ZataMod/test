import axios from "axios";

const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

async function getChatMember(chat_id, user_id) {
  const res = await axios.get(`${TELEGRAM_API}/getChatMember`, {
    params: {
      chat_id,
      user_id,
    },
  });
  return res.data.result;
}

async function getChatAdministrators(chat_id) {
  const res = await axios.get(`${TELEGRAM_API}/getChatAdministrators`, {
    params: { chat_id },
  });
  return res.data.result;
}

async function getChatMembers(chat_id) {
  // Telegram không có API public để lấy toàn bộ thành viên nhóm nếu không phải bot riêng được cấp quyền đặc biệt
  // Vì vậy ta chỉ lấy danh sách admin (ví dụ đơn giản), hoặc sử dụng work-around từ tin nhắn gần đây nếu được
  return [];
}

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const update = req.body;

  // Kiểm tra có phải là message không
  const msg = update.message;
  if (!msg || !msg.text) {
    return res.status(200).send("No message");
  }

  const chat_id = msg.chat.id;
  const user_id = msg.from.id;
  const text = msg.text;

  // Lệnh /all (hoặc /tagall)
  if (text === "/all" || text === "/all@YourBotUsername") {
    try {
      // Kiểm tra quyền admin
      const member = await getChatMember(chat_id, user_id);
      const isAdmin = ["administrator", "creator"].includes(member.status);

      if (!isAdmin) {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id,
          text: "❌ Bạn không có quyền sử dụng lệnh này.",
        });
        return res.status(200).send("Not admin");
      }

      // Lấy danh sách admin để tag thử (nếu không lấy được member thường)
      const admins = await getChatAdministrators(chat_id);

      // Tạo danh sách mention (giới hạn 30 người để tránh lỗi 400)
      const mentions = admins
        .slice(0, 30)
        .map((a) => `[‎](tg://user?id=${a.user.id})`)
        .join(" ");

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id,
        text: mentions || "Không thể tag.",
        parse_mode: "Markdown",
        disable_notification: true,
      });

      return res.status(200).send("Done");
    } catch (err) {
      console.error("❌ Error:", err.response?.data || err.message);
      return res.status(500).send("Internal error");
    }
  }

  // Trả về OK mặc định
  res.status(200).send("OK");
};
