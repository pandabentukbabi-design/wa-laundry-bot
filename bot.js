const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys");

const P = require("pino");
const { google } = require("googleapis");
const { google } = require("googleapis");

// ================= GOOGLE AUTH =================
const auth = new google.auth.GoogleAuth({
  keyFile: "credentials.json",
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const SPREADSHEET_ID = "1wakfSFjiSmBthNm2E9zugbm2RzP_DmUIteogC-XfyCI";

// ================= FUNGSI TAMBAH DATA =================
async function addShift(data) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: "data_shift!A1",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [data],
    },
  });
}

// ================= FUNGSI AMBIL DATA =================
async function getData() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: "data_shift!A1:Z1000",
  });

  return res.data.values || [];
}

// ================= BOT =================
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
  auth: state,
  printQRInTerminal: true,
  logger: P({ level: "silent" }),
  browser: ["Laundry Bot", "Chrome", "1.0.0"]
});

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
  console.log(JSON.stringify(update, null, 2));
});
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;
    if (!text) return;

    // ================= INPUT SHIFT =================
    if (text.startsWith("/shift")) {
      try {
        const args = text.split(" ");

        const tanggal = args[1];
        const shift = args[2];

        const sabun = parseInt(args[3].split("=")[1]);
        const pewangi = parseInt(args[4].split("=")[1]);
        const kresek = parseInt(args[5].split("=")[1]);
        const kas = parseInt(args[6].split("=")[1]);

        const cp_awal = parseInt(args[7].split("=")[1]);
        const cp_sisa = parseInt(args[8].split("=")[1]);

        const ce_awal = parseInt(args[9].split("=")[1]);
        const ce_sisa = parseInt(args[10].split("=")[1]);

        // ===== HITUNG =====
        const penjualan = (sabun + pewangi + kresek) * 1000;
        const minusKas = penjualan - kas;

        const coin = (cp_awal - cp_sisa) + (ce_awal - ce_sisa);
        const minusCoin = coin * 10000;

        const totalGanti = minusKas + minusCoin;

        // ===== SIMPAN =====
        await addShift([
          tanggal, shift,
          sabun, pewangi, kresek,
          penjualan, kas,
          minusKas,
          coin, minusCoin,
          totalGanti
        ]);

        await sock.sendMessage(msg.key.remoteJid, {
          text: `✅ Data tersimpan

📅 ${tanggal} Shift ${shift}
📊 Penjualan: ${penjualan}
💸 Minus Kas: ${minusKas}
🪙 Minus Coin: ${minusCoin}
🔥 Total Ganti: ${totalGanti}`
        });

      } catch (e) {
        await sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Format salah"
        });
      }
    }

    // ================= LIHAT SHIFT =================
    if (text.startsWith("/lihat")) {
      const args = text.split(" ");
      const tanggal = args[1];
      const shift = args[2];

      const data = await getData();

      const found = data.find((row, i) => 
        i !== 0 && row[0] == tanggal && row[1] == shift
      );

      if (!found) {
        return sock.sendMessage(msg.key.remoteJid, {
          text: "❌ Data tidak ditemukan"
        });
      }

      await sock.sendMessage(msg.key.remoteJid, {
        text: `📊 DATA SHIFT

📅 ${found[0]} Shift ${found[1]}
🧼 Sabun: ${found[2]}
🌸 Pewangi: ${found[3]}
🛍️ Kresek: ${found[4]}

💰 Penjualan: ${found[5]}
💵 Kas: ${found[6]}
⚠️ Minus Kas: ${found[7]}
🪙 Minus Coin: ${found[9]}
🔥 Total Ganti: ${found[10]}`
      });
    }

    // ================= REKAP HARIAN =================
    if (text.startsWith("/rekap")) {
      const args = text.split(" ");
      const tanggal = args[1];

      const data = await getData();

      let total = 0;
      let totalKas = 0;
      let totalMinus = 0;

      data.forEach((row, i) => {
        if (i === 0) return;
        if (row[0] == tanggal) {
          total += Number(row[5]);
          totalKas += Number(row[6]);
          totalMinus += Number(row[10]);
        }
      });

      await sock.sendMessage(msg.key.remoteJid, {
        text: `📊 REKAP ${tanggal}

💰 Penjualan: ${total}
💵 Kas: ${totalKas}
🔥 Total Ganti: ${totalMinus}`
      });
    }

  });
}

startBot();
