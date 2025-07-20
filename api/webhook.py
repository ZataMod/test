import telebot
import os
import aiohttp
import asyncio
import re
from telebot import types
from telebot.wsgi_server import WSGIApp

TOKEN = os.environ.get("8012566836:AAHIdMZs_cZYDtgm_3Ncs1rU6NQfWov6JHI")
SOUNDCLOUD_CLIENT_ID = os.environ.get("KKzJxmw11tYpCs6T24P4uUYhqmjalG6M")
TIKTOK_API = "https://tikwm.com/api/"
HEADERS = {"User-Agent": "Mozilla/5.0"}

bot = telebot.TeleBot(TOKEN, threaded=False)

# ===== SoundCloud functions =====
async def search_soundcloud(session, query):
    url = f"https://api-v2.soundcloud.com/search/tracks?q={query}&client_id={SOUNDCLOUD_CLIENT_ID}&limit=1"
    try:
        async with session.get(url, headers=HEADERS, timeout=10) as resp:
            data = await resp.json()
            return data.get("collection", [None])[0]
    except Exception as e:
        print(f"[SoundCloud Search Error] {e}")
        return None

async def get_stream_url(session, track):
    for t in track["media"]["transcodings"]:
        if "progressive" in t["format"]["protocol"]:
            url = t["url"]
            break
    else:
        return None

    try:
        async with session.get(f"{url}?client_id={SOUNDCLOUD_CLIENT_ID}", headers=HEADERS, timeout=10) as r:
            info = await r.json()
            return info.get("url")
    except Exception as e:
        print(f"[Stream URL Error] {e}")
        return None

# ===== TikTok function =====
def extract_tiktok_url(text: str):
    matches = re.findall(r'(https?://[^ ]*tiktok\\.com[^\\s]*)', text)
    return matches[0] if matches else None

# ===== Handlers =====
@bot.message_handler(commands=["scl"])
def handle_scl(message):
    query = message.text.replace("/scl", "").strip()
    if not query:
        bot.reply_to(message, "🔎 Vui lòng nhập tên bài hát sau lệnh /scl")
        return

    bot.reply_to(message, f"🎵 Đang tìm: {query}...")
    asyncio.run(process_soundcloud(message, query))

async def process_soundcloud(message, query):
    async with aiohttp.ClientSession() as session:
        track = await search_soundcloud(session, query)
        if track:
            stream_url = await get_stream_url(session, track)
            if stream_url:
                bot.send_audio(
                    chat_id=message.chat.id,
                    audio=stream_url,
                    title=track["title"],
                    performer=track["user"]["username"]
                )
            else:
                bot.send_message(message.chat.id, "⚠️ Không lấy được link phát.")
        else:
            bot.send_message(message.chat.id, "❌ Không tìm thấy bài hát.")

@bot.message_handler(func=lambda msg: "tiktok.com" in msg.text.lower())
def handle_tiktok(message):
    url = extract_tiktok_url(message.text)
    if not url:
        return

    bot.reply_to(message, "📥 Đang xử lý video TikTok...")
    asyncio.run(process_tiktok(message, url))

async def process_tiktok(message, url):
    async with aiohttp.ClientSession() as session:
        try:
            async with session.get(f"{TIKTOK_API}?url={url}", headers=HEADERS, timeout=10) as res:
                data = await res.json()
                music_url = data.get("data", {}).get("play")

                if music_url:
                    bot.send_audio(chat_id=message.chat.id, audio=music_url, title="Video từ TikTok")
                else:
                    bot.send_message(message.chat.id, "❌ Không lấy được nhạc TikTok.")
        except Exception as e:
            print(f"[TikTok Error] {e}")
            bot.send_message(message.chat.id, "⚠️ Lỗi khi xử lý video TikTok.")

# ✅ Đây là WSGI app dùng cho Vercel
app = WSGIApp(bot)