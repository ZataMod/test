import { createCanvas, loadImage, registerFont } from "canvas";
import axios from "axios";
import path from "path";

// 🌐 Token từ Vercel môi trường
const TOKEN = process.env.BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${TOKEN}`;

// 🖋 Font custom (nếu cần)
registerFont(path.resolve("./fonts/SVN-VT Redzone Classic.otf"), {
  family: "Redzone",
});

// 📸 Tạo banner welcome
async function generateWelcomeImage(name, avatarUrl) {
  const width = 1600;
  const height = 500;
  const avatarSize = 300;
  const border = 8;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Nền
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);

  // Load avatar
  const avatarRes = await axios.get(avatarUrl, { responseType: "arraybuffer" });
  const avatarImg = await loadImage(Buffer.from(avatarRes.data));

  // Cắt avatar tròn
  const avatarCanvas = createCanvas(avatarSize, avatarSize);
  const avatarCtx = avatarCanvas.getContext("2d");
  avatarCtx.beginPath();
  avatarCtx.arc(avatarSize / 2, avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  avatarCtx.closePath();
  avatarCtx.clip();
  avatarCtx.drawImage(avatarImg, 0, 0, avatarSize, avatarSize);

  // Viền trắng
  const borderSize = avatarSize + border * 2;
  const borderCanvas = createCanvas(borderSize, borderSize);
  const borderCtx = borderCanvas.getContext("2d");
  borderCtx.beginPath();
  borderCtx.arc(borderSize / 2, borderSize / 2, borderSize / 2, 0, Math.PI * 2);
  borderCtx.fillStyle = "#fff";
  borderCtx.fill();
  borderCtx.closePath();
  borderCtx.drawImage(avatarCanvas, border, border);

  // Dán avatar lên
  const avatarX = 80;
  const avatarY = (height - borderSize) / 2;
  ctx.drawImage(borderCanvas, avatarX, avatarY);

  // Đường kẻ dọc
  const lineX = avatarX + borderSize + 40;
  ctx.beginPath();
  ctx.moveTo(lineX, 120);
  ctx.lineTo(lineX, height - 60);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.stroke();

  // Văn bản
  ctx.fillStyle = "#ffffff";
  ctx.font = `80px "Redzone"`;
  const lines = ["-- Member Join Group --", name, "Vừa Tham Gia Nhóm"];
  const spacing = 15;
  const textYStart = (height - lines.length * (80 + spacing)) / 2;

  lines.forEach((line, i) => {
    const textWidth = ctx.measureText(line).width;
    const x = lineX + 40 + (width - lineX - 80 - textWidth) / 2;
    const y = textYStart + i * (80 + spacing);
    ctx.fillText(line, x, y);
  });

  return canvas.toBuffer("image/png");
}

// 🧩 Gửi ảnh buffer về nhóm
async function sendPhotoBuffer(chatId, buffer, caption = "") {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("photo", buffer, "welcome.png");

  await axios.post(`${TELEGRAM_API}/sendPhoto`, form, {
    headers: form.getHeaders(),
  });
}

// 🧠 Xử lý Telegram webhook
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("🤖 Bot is live");

  const msg = req.body.message || req.body.edited_message;
  const newMembers = req.body.message?.new_chat_members;

  if (!msg) return res.status(200).send("No message");

  try {
    const chatId = msg.chat.id;

    // 🎉 Thành viên mới
    if (newMembers && newMembers.length > 0) {
      for (const member of newMembers) {
        const name = `${member.first_name || ""} ${member.last_name || ""}`.trim();
        const userId = member.id;

        // 📸 Lấy avatar user (file Telegram)
        const { data } = await axios.get(`${TELEGRAM_API}/getUserProfilePhotos`, {
          params: { user_id: userId, limit: 1 },
        });

        const fileId = data.result.photos?.[0]?.[0]?.file_id;
        if (!fileId) return res.status(200).send("No avatar");

        const fileInfo = await axios.get(`${TELEGRAM_API}/getFile`, {
          params: { file_id: fileId },
        });

        const filePath = fileInfo.data.result.file_path;
        const avatarUrl = `https://api.telegram.org/file/bot${TOKEN}/${filePath}`;

        // 🎨 Tạo ảnh chào mừng
        const imageBuffer = await generateWelcomeImage(name, avatarUrl);

        // 📤 Gửi ảnh
        await sendPhotoBuffer(chatId, imageBuffer, `🎉 Welcome ${name}!`);
      }
    }

    return res.status(200).send("OK");
  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(200).send("Error");
  }
    }
