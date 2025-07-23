const express = require("express");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

const BOT_TOKEN = process.env.BOT_TOKEN;
const RAPID_API_KEY = process.env.RAPID_API_KEY;

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
const app = express();

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text) return;

  // 🎵 /yt tên bài hát
  if (text.startsWith("/yt ")) {
    const query = text.slice(4);
    await bot.sendMessage(chatId, `🔍 Đang tìm bài hát: ${query}...`);

    try {
      const options = {
        method: "GET",
        url: "https://youtube-mp36.p.rapidapi.com/dl",
        params: { id: "" },
        headers: {
          "X-RapidAPI-Key": RAPID_API_KEY,
          "X-RapidAPI-Host": "youtube-mp36.p.rapidapi.com",
        },
      };

      // Tìm video ID đầu tiên từ YouTube
      const searchRes = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            part: "snippet",
            q: query,
            maxResults: 1,
            key: process.env.YT_API_KEY,
          },
        }
      );

      const videoId = searchRes.data.items[0]?.id?.videoId;
      if (!videoId) {
        return bot.sendMessage(chatId, "❌ Không tìm thấy video.");
      }

      // Lấy link MP3
      options.params.id = videoId;
      const res = await axios.request(options);
      const mp3 = res.data;

      await bot.sendAudio(chatId, mp3.link, {
        title: mp3.title,
        performer: "YouTube",
      });
    } catch (err) {
      console.error(err.message);
      bot.sendMessage(chatId, "❌ Lỗi khi tải MP3.");
    }
  }

  // 🎵 Tự động phát hiện link TikTok
  const tiktokRegex = /(https?:\/\/(?:www\.)?tiktok\.com\/[^\s]*)/i;
  const match = text.match(tiktokRegex);
  if (match) {
    const url = match[1];
    await bot.sendMessage(chatId, `🔍 Đang xử lý TikTok: ${url}`);

    try {
      const res = await axios.get("https://tiktok-downloader-download-videos-without-watermark.p.rapidapi.com/vid/index", {
        params: { url },
        headers: {
          "X-RapidAPI-Key": RAPID_API_KEY,
          "X-RapidAPI-Host": "tiktok-downloader-download-videos-without-watermark.p.rapidapi.com"
        }
      });

      const audio = res.data.music;
      await bot.sendAudio(chatId, audio, {
        title: res.data.desc || "TikTok Audio",
        performer: "TikTok"
      });
    } catch (e) {
      console.error(e.message);
      bot.sendMessage(chatId, "❌ Lỗi khi tải audio TikTok.");
    }
  }
});

app.get("/", (req, res) => res.send("Bot is running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
