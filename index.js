const dotenv = require('dotenv');
dotenv.config();
const User = require('./models/User');
const Dua = require('./models/Dua');
const axios = require('axios');
const Fastify = require('fastify');
const fastify = Fastify({ logger: true });
const moment = require('moment-timezone');
const cron = require('node-cron');
const TelegramBot = require('node-telegram-bot-api');
const ADMIN_IDS = (process.env.ADMIN_IDS || '').split(',').map(id => id.trim()).filter(Boolean);
const MONGO_URI = process.env.MONGO_URI;
const mongoose = require('mongoose');
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { webHook: true });

const WEBHOOK_PATH = `/webhook/${token}`;
const FULL_WEBHOOK_URL = `${process.env.PUBLIC_URL}${WEBHOOK_PATH}`;

fastify.post(WEBHOOK_PATH, (req, reply) => {
  try {
    bot.processUpdate(req.body);  
    console.log('Update processed:', req.body);
    reply.code(200).send();       
  } catch (error) {
    console.error('Error processing update:', error);
    reply.sendStatus(500);
  }
});

fastify.get('/healthz', (req, reply) => {
  reply.send({ status: 'ok' });
});

// Serverni ishga tushirish va webhook o‘rnatish
fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' }, async (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  fastify.log.info(`Server listening at ${address}`);

  try {
const response = await axios.post(`https://api.telegram.org/bot${token}/setWebhook`, null, {
  params: { url: FULL_WEBHOOK_URL }
});

    if (response.data.ok) {
      fastify.log.info('Webhook successfully set:', response.data);
    } else {
      fastify.log.error('Failed to set webhook:', response.data);
    }
  } catch (error) {
    fastify.log.error('Error setting webhook:', error.message);
  }
});


bot.getMe().then((botInfo) => {
  bot.me = botInfo;
  console.log(`🤖 Bot ishga tushdi: @${bot.me.username}`);
}).catch((err) => {
  console.error("Bot ma'lumotini olishda xatolik:", err.message);
});
const userSessions = {};
const adminSessions = {};
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('MongoDBga ulandi');
}).catch(err => {
  console.error('MongoDB ulanishda xatolik:', err);
  process.exit(1);
});

function mainMenu() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Namoz vaqtlari', callback_data: 'pray_times' }],
        [{ text: `Kundalik duolar`, callback_data: 'dua' }],
        [{ text: 'Manbalar jamlanmasi', callback_data: 'library' }],
      ]
    }
  };
}

const availableRegions = {
  toshkent: { label: "Toshkent", apiValue: "Toshkent" },
  andijon: { label: "Andijon", apiValue: "Andijon" },
  fargona: { label: "Farg'ona", apiValue: "Farg'ona" },
  namangan: { label: "Namangan", apiValue: "Toshkent" },
  samarqand: { label: "Samarqand", apiValue: "Samarqand" },
  buxoro: { label: "Buxoro", apiValue: "Buxoro" },
  xorazm: { label: "Xiva", apiValue: "Xiva" },
  qarshi: { label: "Qarshi", apiValue: "Qarshi" },
  navoiy: { label: "Navoiy", apiValue: "Navoiy" },
  jizzax: { label: "Jizzax", apiValue: "Jizzax" },
  sirdaryo: { label: "Sirdaryo", apiValue: "Guliston" },
  surxondaryo: { label: "Surxondaryo", apiValue: "Termiz" },
  qoraqalpogiston: { label: "Qoraqalpog'iston", apiValue: "Nukus" },
  tojikiston: { label: "Tojikiston", apiValue: { city: "Dushanbe", country: "Tajikistan" } },
  qirgiziston: { label: "Qirg'iziston", apiValue: { city: "Bishkek", country: "Kyrgyzstan" } },
  uyguriston: { label: "Uyg'uriston", apiValue: { city: "Urumqi", country: "China" } },
  qozogiston: { label: "Qozog‘iston", apiValue: { city: "Nur-Sultan", country: "Kazakhstan" } },
  turkmaniston: { label: "Turkmaniston", apiValue: { city: "Ashgabat", country: "Turkmenistan" } },
  turkiya: { label: "Turkiya", apiValue: { city: "Ankara", country: "Turkey" } },
  azarbayjon: { label: "Ozarbayjon", apiValue: { city: "Baku", country: "Azerbaijan" } },
  gaza: { label: "Falastin", apiValue: { city: "Gaza", country: "Palestine" } }
};

async function sendPrayTimes(chatId, regionKey, displayRegion = null) {
  const regionObj = availableRegions[regionKey];
  if (!regionObj) {
    return bot.sendMessage(chatId, "❌ Noto'g'ri hudud tanlandi.");
  }

  const apiValue = regionObj.apiValue;

  if (typeof apiValue === 'object') {
    const { city, country } = apiValue;
    try {
      const response = await axios.get('https://api.aladhan.com/v1/timingsByCity', {
        params: {
          city,
          country,
          method: 2
        }
      });

      if (response.data.code === 200) {
        const timings = response.data.data.timings;
        const message = `
📍 <b>Hudud:</b> ${displayRegion || city}
🗓 <b>Sana:</b> ${response.data.data.date.readable}

🕌 <b>Namoz vaqtlari</b>:
- Bomdod: ${timings.Fajr}
- Quyosh: ${timings.Sunrise}
- Peshin: ${timings.Dhuhr}
- Asr: ${timings.Asr}
- Shom: ${timings.Maghrib}
- Xufton: ${timings.Isha}
        `;
        return bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      } else {
        return bot.sendMessage(chatId, "⚠️ Namoz vaqtlarini olishda xatolik yuz berdi.");
      }
    } catch (error) {
      console.error('Namoz vaqtlarini olishda xatolik (Aladhan API):', error.message);
      return bot.sendMessage(chatId, "⚠️ Namoz vaqtlarini olishda xatolik yuz berdi.");
    }
  } else {
    const url = `https://islomapi.uz/api/present/day?region=${encodeURIComponent(apiValue)}`;
    try {
      const { data } = await axios.get(url);
      const message = `
📍 <b>Hudud:</b> ${displayRegion || data.region}
🗓 <b>Sana:</b> ${data.date}

🕌 <b>Namoz vaqtlari</b>:
- Bomdod: ${data.times.tong_saharlik}
- Quyosh: ${data.times.quyosh}
- Peshin: ${data.times.peshin}
- Asr: ${data.times.asr}
- Shom: ${data.times.shom_iftor}
- Xufton: ${data.times.hufton}
      `;
      return bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    } catch (error) {
      console.error('Namoz vaqtlarini olishda xatolik (islomapi.uz):', error.message);
      return bot.sendMessage(chatId, "⚠️ Namoz vaqtlarini olishda xatolik yuz berdi.");
    }
  }
}




const prayerDescriptions = {
  Fajr: `<b>🌅 Bomdod namozi vaqti kirdi.</b>\n\n<b>١٤. قَدْ أَفْلَحَ مَن تَزَكَّىٰ

14. Haqiqatan, kim pok bo'lsa, yutuq topadir. | A'laa surasi</b>`,
  Dhuhr: `<b>☀️ Peshin namozi vaqti kirdi.</b> \n\n<b>١٥. وَذَكَرَ ٱسْمَ رَبِّهِۦ فَصَلَّىٰ

15. Va Robbining ismini zikr qilsa va namoz o'qisa hamdir. | A'laa surasi </b>`,
  Asr: `<b>🌇 Asr namozi vaqti kirdi.</b>\n\n<b>١٥٣. يَٰٓأَيُّهَا ٱلَّذِينَ ءَامَنُوا۟ ٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ

153. Ey iymon keltirganlar! Sabr va namoz ila madad so'ranglar. Albatta, Alloh sabrlilar bilandir. | Baqara surasi</b>`,
  Maghrib: `<b>🌆 Shom namozi vaqti kirdi.</b>\n\n<b>٤٥. وَٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى ٱلْخَٰشِعِينَ

45. Sabr va namoz ila yordam so'rang. Va albatta, u nafsi siniqlardan boshqalarga juda katta ishdir. | Baqara surasi</b>`,
  Isha: `<b>🌙 Xufton namozi vaqti keldi.</b><b>٤٥. وَٱسْتَعِينُوا۟ بِٱلصَّبْرِ وَٱلصَّلَوٰةِ وَإِنَّهَا لَكَبِيرَةٌ إِلَّا عَلَى ٱلْخَٰشِعِينَ

45. Sabr va namoz ila yordam so'rang. Va albatta, u nafsi siniqlardan boshqalarga juda katta ishdir. | Rum surasi</b>`
};
const uzbekPrayerMapping = {
  tong_saharlik: 'Fajr',
  quyosh: 'Sunrise',  
  peshin: 'Dhuhr',
  asr: 'Asr',
  shom_iftor: 'Maghrib',
  hufton: 'Isha'
};
async function getPrayTimesForUser(user) {
  const region = availableRegions[user.region];
  if (!region) return null;
  const apiValue = region.apiValue;
  if (typeof apiValue === 'object') {
    const { city, country } = apiValue;
    try {
      const response = await axios.get('https://api.aladhan.com/v1/timingsByCity', {
        params: { city, country, method: 2 }
      });
      if (response.data.code === 200) return response.data.data.timings;
    } catch (e) { }
  } else {
    try {
      const { data } = await axios.get(`https://islomapi.uz/api/present/day?region=${encodeURIComponent(apiValue)}`);
    const mappedTimings = {};
      for (const [uzKey, enKey] of Object.entries(uzbekPrayerMapping)) {
        if (data.times[uzKey]) {
          mappedTimings[enKey] = data.times[uzKey];
        }
      }
      return mappedTimings;
    } catch (e) { }
  }
  return null;
}

async function checkAndSendPrayerReminder(prayerName) {
  const users = await User.find({ region: { $exists: true, $ne: null } });
  let sent = 0;

  for (const user of users) {
    try {
      const timings = await getPrayTimesForUser(user);
      if (!timings || !timings[prayerName]) continue;
      const userTimezone = regionTimezones[user.region] || "Asia/Tashkent";
      const now = moment().tz(userTimezone);
      let prayerTimeStr = timings[prayerName]; 
      if (!prayerTimeStr.includes(':')) prayerTimeStr += ':00';

      const [hour, minute] = prayerTimeStr.split(':').map(Number);
      const prayerTime = now.clone().hour(hour).minute(minute).second(0);

      if (now.isSame(prayerTime, 'minute')) {
        await bot.sendMessage(user.telegramId, prayerDescriptions[prayerName], {
          parse_mode : 'HTML'
        });
        sent++;
      }
    } catch (err) {
      console.error(`Namoz eslatmasi yuborishda xatolik (${user.telegramId}):`, err.message);
    }
  }

  console.log(`✅ ${prayerName} uchun eslatma ${sent} foydalanuvchiga yuborildi.`);
}


const regionTimezones = {
  toshkent: "Asia/Tashkent",
  andijon: "Asia/Tashkent",
  fargona: "Asia/Tashkent",
  namangan: "Asia/Tashkent",
  samarqand: "Asia/Tashkent",
  buxoro: "Asia/Tashkent",
  xorazm: "Asia/Tashkent",
  qarshi: "Asia/Tashkent",
  navoiy: "Asia/Tashkent",
  jizzax: "Asia/Tashkent",
  sirdaryo: "Asia/Tashkent",
  surxondaryo: "Asia/Tashkent",
  qoraqalpogiston: "Asia/Tashkent",
  tojikiston: "Asia/Dushanbe",
  qirgiziston: "Asia/Bishkek",
  uyguriston: "Asia/Urumqi",
  qozogiston: "Asia/Almaty",
  turkmaniston: "Asia/Ashgabat",
  turkiya: "Europe/Istanbul",
  azarbayjon: "Asia/Baku",
  gaza: "Asia/Gaza"
};


cron.schedule('* * * * *', async () => {
  for (const prayer of Object.keys(prayerDescriptions)) {
    await checkAndSendPrayerReminder(prayer);
  }
}, { timezone: "Asia/Tashkent" });


const duaTimes = ['08:00', '10:00', '12:00', '14:00', '20:00', '22:00'];

async function sendDailyDua(chatId) {
  try {
    const duas = await Dua.find().sort({ createdAt: 1 });
    if (duas.length === 0) {
      return bot.sendMessage(chatId, "🕌 Hozircha duolar mavjud emas.");
    }

    const today = new Date();
    const dayOfMonth = today.getDate() - 1;
    const duaIndex = dayOfMonth % duas.length;
    const selectedDua = duas[duaIndex];

    if (selectedDua.image) {
      await bot.sendPhoto(chatId, selectedDua.image, {
        caption: selectedDua.caption,
        parse_mode: 'HTML'
      });
    } else {
      await bot.sendMessage(chatId, selectedDua.caption, {
        parse_mode: 'HTML'
      });
    }

    console.log(`✅ Dua yuborildi: ${chatId}`);
  } catch (err) {
    console.error('Dua yuborishda xatolik:', err.message);
    await bot.sendMessage(chatId, "⚠️ Dua yuborishda xatolik yuz berdi.");
  }
}


duaTimes.forEach(time => {
  const [hour, minute] = time.split(':');
  cron.schedule(`${minute} ${hour} * * *`, async () => {
    console.log(`🕌 Duolarni yuborish boshlandi: ${time}`);
    const users = await User.find({ duaTime: time });
    let sent = 0;

    for (let user of users) {
      try {
        await sendDailyDua(user.telegramId);
        sent++;
      } catch (err) {
        console.error(`Foydalanuvchiga dua yuborilmadi: ${user.telegramId}`, err.message);
      }
    }
    console.log(`✅ Duolar ${sent} foydalanuvchiga yuborildi (${time}).`);
  }, {
    timezone: "Asia/Tashkent"
  });
});

function generateDuaTimeKeyboard(columns = 2) {
  const keyboard = [];
  for (let i = 0; i < duaTimes.length; i += columns) {
    const row = duaTimes.slice(i, i + columns).map(time => ({
      text: time,
      callback_data: `set_dua_time_${time}`
    }));
    keyboard.push(row);
  }
  return keyboard;
}

function generateKeyboardFromObject(obj, columns = 3) {
  const entries = Object.entries(obj);
  const keyboard = [];

  for (let i = 0; i < entries.length; i += columns) {
    const row = entries.slice(i, i + columns).map(([key, { label }]) => ({
      text: label,
      callback_data: `region_${key}`
    }));
    keyboard.push(row);
  }

  return keyboard;
}
bot.onText(/\/start(?: (\d+))?/, async (message) => {
  const chatId = message.from.id;
  const name = message.from.first_name;
  await bot.sendMessage(chatId, `<b>Assalomu alaykum <a href="tg://user?id=${chatId}">${name}</a></b>`, {
    parse_mode: 'HTML',
    ...mainMenu()
  });
});

bot.onText(/\/panel/, async (msg) => {
  const chatId = msg.chat.id;
  const isAdmin = ADMIN_IDS.includes(chatId.toString());
  if (!isAdmin) return;
  const users = await User.find();
  const totalUsers = users.length;

  const regionsCount = {};
  const duaTimesCount = {};

  for (let user of users) {
    if (user.region) {
      regionsCount[user.region] = (regionsCount[user.region] || 0) + 1;
    }
    if (user.duaTime) {
      duaTimesCount[user.duaTime] = (duaTimesCount[user.duaTime] || 0) + 1;
    }
  }

  let regionStat = Object.entries(regionsCount).map(([r, c]) => `- ${availableRegions[r]?.label || r}: ${c} ta`).join("\n");
  let duaStat = Object.entries(duaTimesCount).map(([t, c]) => `- ${t}: ${c} ta`).join("\n");

  const stats = `
📊 <b>Statistika</b>:
👤 Foydalanuvchilar soni: ${totalUsers}

🌍 <b>Regionlar bo‘yicha:</b>
${regionStat || 'Mavjud emas'}

🕓 <b>Duolar vaqti bo‘yicha:</b>
${duaStat || 'Mavjud emas'}
`;

  const adminMenu = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📥 Duolar qo‘shish", callback_data: "admin_add_dua" }],
        [{ text: "📢 E’lon berish", callback_data: "admin_broadcast" }]
      ]
    },
    parse_mode: "HTML"
  };

  bot.sendMessage(chatId, stats, adminMenu);
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const userId = query.from.id;
  const data = query.data;
  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (err) {
    console.error('Xabarni o‘chirishda xatolik:', err.message);
  }
  if (data === 'pray_times') {
    const keyboard = generateKeyboardFromObject(availableRegions, 3);
    await bot.sendMessage(chatId, `🌏<b>Iltimos, hududingizni tanlang va tanlangan mintaqa bo'yicha sizga namoz vaqtlarini aytib turamiz:</b>`, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  }

  if (data.startsWith('region_')) {
    const key = data.replace('region_', '');
    const regionObj = availableRegions[key];

    if (!regionObj) {
      return await bot.sendMessage(chatId, "❌ Noto'g'ri hudud tanlandi.");
    }

    try {
      await User.findOneAndUpdate(
        { telegramId: chatId.toString() },
        {
          telegramId: chatId.toString(),
          name: query.from.first_name,
          username: query.from.username,
          region: key
        },
        { upsert: true, new: true }
      );
      console.log(`Region saqlandi: ${key} for user ${chatId}`);
    } catch (err) {
      console.error('Region saqlashda xatolik:', err.message);
    }

    try {
      await sendPrayTimes(chatId, key, regionObj.label);
      await bot.sendMessage(chatId, `✅ Hududingiz (${regionObj.label}) saqlandi. Namoz vaqtlari kirganda eslatamiz.`, {
        ...mainMenu()
      });
    } catch (err) {
      console.error('Namoz vaqtlarini yuborishda xatolik:', err.message);
      await bot.sendMessage(chatId, "❌ Namoz vaqtlarini yuborishda xatolik yuz berdi.");
    }
  }

  if (data === 'dua') {
    await bot.sendMessage(chatId, `<b>Har kuni sizga kundalik duolar va manfaatli hikmatlar yuboriladi, ularni sizga qaysi vaqtda yuborishimizni xohlaysiz?</b>`, {
      parse_mode : 'HTML',
      reply_markup: {
        inline_keyboard: generateDuaTimeKeyboard()
      }
    });
  }
  if(data === 'library'){
    await bot.sendMessage(chatId, `<b>@${bot.me.username} manbalari:</b>\n<blockquote><b>@islomuz</b>\n<b>@muslimuzportal</b>\n<b>@HilolNashr</b></blockquote>\n<b>Shiorimiz</b>:\n<blockquote><b>Ahli sunna va jamoa mazhabi asosida pok aqiyda va musaffo Islomga intilish, Qur'on va sunnatni o'rganib amal qilish, islomiy ma'rifat taratish, salafi solih - ulug' mujtahidlarga ergashish, kengbag'irlik va birodarlik ruhini tarqatish, diniy savodsizlikni tugatish, ixtilof va firqachilikka barham berish, mutaassiblik va bid'at-xurofotlarni yo'qotish</b></blockquote>`, {
      parse_mode : 'HTML',
      reply_markup : {
        inline_keyboard : [
          [{text : 'Fikr bildirish', callback_data : 'send_admin'}]
        ]
      }
    })
  }
  if (data === 'send_admin') {
  userSessions[chatId] = { step: 'awaiting_feedback' };
  await bot.sendMessage(chatId, `<b>✍️ Iltimos, fikr yoki savolingizni matn shaklida yozib yuboring:</b>\n\n<b>Rasm | Video | Ovozli xabar | Fayl </b>\nqabul qilinmaydi va adminga yuborilmaydi!`, {
    parse_mode : 'HTML'
  });
}
  if (data.startsWith('set_dua_time_')) {
    const selectedTime = data.replace('set_dua_time_', '');

    try {
      await User.findOneAndUpdate(
        { telegramId: chatId.toString() },
        {
          telegramId: chatId.toString(),
          name: query.from.first_name,
          username: query.from.username,
          duaTime: selectedTime
        },
        { upsert: true, new: true }
      );

      await bot.sendMessage(chatId, `<b>InshaAlloh duolar har kuni <i>${selectedTime}</i> da yuboriladi.</b>`, {
        parse_mode: 'HTML',
        ...mainMenu()
      });
    } catch (err) {
      console.error('Dua vaqtini saqlashda xatolik:', err.message);
      await bot.sendMessage(chatId, '❌ Dua vaqtini saqlashda xatolik yuz berdi.');
    }
  }

if (data === 'admin_add_dua' && ADMIN_IDS.includes(chatId.toString())) {
  adminSessions[chatId] = { step: 'awaiting_any' };
  return bot.sendMessage(chatId, "📩 Iltimos, duo matnini yuboring.\nAgar rasm bo‘lsa, oldin uni yuboring, keyin esa matnni alohida yuboring.\n\n<i>(Rasm ixtiyoriy, faqat matn ham bo‘lishi mumkin)</i>", {
    parse_mode: 'HTML'
  });
}


  if (data === 'admin_broadcast' && ADMIN_IDS.includes(chatId.toString())) {
    adminSessions[chatId] = { step: 'awaiting_broadcast' };
    return bot.sendMessage(chatId, "📨 E’lon matni, rasm, video yoki audio yuboring.");
  }

  await bot.answerCallbackQuery(query.id);
});


bot.on('photo', (msg) => {
  const chatId = msg.chat.id;
  const session = adminSessions[chatId];

  if (!session || session.step !== 'awaiting_any') return;

  const photo = msg.photo[msg.photo.length - 1].file_id;
  session.image = photo;

  bot.sendMessage(chatId, "📝 Endi esa dua matnini yuboring (HTML formatda).");
});



bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const session = adminSessions[chatId];

  if (!session || session.step !== 'awaiting_any' || !msg.text) return;

  const caption = `<b>${msg.text}</b>`;
  const image = session.image || null;

  try {
    const newDua = new Dua({ caption, image });
    await newDua.save();

    if (image) {
      await bot.sendPhoto(chatId, image, {
        caption,
        parse_mode: 'HTML'
      });
    } else {
      await bot.sendMessage(chatId, caption, { parse_mode: 'HTML' });
    }

    delete adminSessions[chatId];

    bot.sendMessage(chatId, "✅ Dua muvaffaqiyatli saqlandi.");
  } catch (err) {
    console.error('Dua saqlashda xatolik:', err.message);
    bot.sendMessage(chatId, "❌ Dua saqlashda xatolik yuz berdi.");
    delete adminSessions[chatId];
  }


  if (session && session.step === 'awaiting_broadcast') {
    const users = await User.find();
    let sent = 0;
    let errors = 0;

    for (let user of users) {
      try {
        if (msg.photo) {
          await bot.sendPhoto(user.telegramId, msg.photo[msg.photo.length - 1].file_id, {
            caption: msg.caption || '',
            parse_mode: 'HTML'
          });
        } else if (msg.video) {
          await bot.sendVideo(user.telegramId, msg.video.file_id, {
            caption: msg.caption || '',
            parse_mode: 'HTML'
          });
        } else if (msg.audio) {
          await bot.sendAudio(user.telegramId, msg.audio.file_id, {
            caption: msg.caption || '',
            parse_mode: 'HTML'
          });
        } else if (msg.document) {
          await bot.sendDocument(user.telegramId, msg.document.file_id, {
            caption: msg.caption || '',
            parse_mode: 'HTML'
          });
        } else if (msg.text) {
          await bot.sendMessage(user.telegramId, msg.text, { parse_mode: 'HTML' });
        } else {
          console.log('Noma\'lum media turi:', msg);
          errors++;
          continue;
        }
        sent++;
      } catch (err) {
        console.error(`Foydalanuvchiga e'lon yuborilmadi: ${user.telegramId}`, err.message);
        errors++;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    delete adminSessions[chatId];
    bot.sendMessage(chatId, `✅ E’lon ${sent} foydalanuvchiga muvaffaqiyatli yuborildi.\n❌ Xatolar: ${errors} ta.`);
    return;
  }

});
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const session = userSessions[chatId];

  if (session && session.step === 'awaiting_feedback') {
    const text = msg.text;
    if (!text || text.length < 3) {
      return bot.sendMessage(chatId, "❗️ Iltimos, fikr yoki savolingizni to‘liqroq yozing.");
    }

    for (let adminId of ADMIN_IDS) {
      await bot.sendMessage(adminId, `📩 <b>Yangi fikr:</b>\n\n${text}\n\n👤 <b>Foydalanuvchi:</b> <a href="tg://user?id=${chatId}">${msg.from.first_name}</a> (@${msg.from.username || 'no-username'})`, {
        parse_mode: 'HTML'
      });
    }

    delete userSessions[chatId];
    return bot.sendMessage(chatId, "✅ Fikringiz adminga yuborildi. Rahmat!");
  }

});


process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

console.log('🤖 Bot tayyor va ishlamoqda...');
