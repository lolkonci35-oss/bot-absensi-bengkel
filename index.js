
require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits
} = require("discord.js");

const Database = require("better-sqlite3");

const db = new Database("absensi.db");

db.exec(`
CREATE TABLE IF NOT EXISTS absensi (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  tanggal TEXT NOT NULL,
  masuk TEXT,
  pulang TEXT,
  UNIQUE(user_id, tanggal)
);
`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const commands = [
  new SlashCommandBuilder()
    .setName("absen")
    .setDescription("Sistem absensi karyawan")
    .addSubcommand(s =>
      s.setName("masuk").setDescription("Absen masuk")
    )
    .addSubcommand(s =>
      s.setName("pulang").setDescription("Absen pulang")
    ),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Cek status absensi"),

  new SlashCommandBuilder()
    .setName("rekap")
    .setDescription("Rekap absensi karyawan")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild
    )
];

const rest = new REST({ version: "10" })
  .setToken(process.env.TOKEN);

client.once("ready", () => {
  console.log(`Bot aktif: ${client.user.tag}`);
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const now = new Date();

  const tanggal = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta"
  });

  const waktu = now.toLocaleTimeString("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  if (interaction.commandName === "absen") {
    const jenis = interaction.options.getSubcommand();

    const data = db.prepare(
      "SELECT * FROM absensi WHERE user_id = ? AND tanggal = ?"
    ).get(userId, tanggal);

    if (jenis === "masuk") {
      if (data) {
        return interaction.reply({
          content: "Kamu sudah absen masuk hari ini!",
          ephemeral: true
        });
      }

      db.prepare(`
        INSERT INTO absensi
        (user_id, tanggal, masuk)
        VALUES (?, ?, ?)
      `).run(userId, tanggal, waktu);

      return interaction.reply(
        `✅ ABSEN MASUK BERHASIL\n\nKaryawan: ${interaction.user}\nTanggal: ${tanggal}\nJam: ${waktu} WIB\nStatus: HADIR`
      );
    }

    if (jenis === "pulang") {
      if (!data) {
        return interaction.reply({
          content: "Kamu belum absen masuk!",
          ephemeral: true
        });
      }

      if (data.pulang) {
        return interaction.reply({
          content: "Kamu sudah absen pulang!",
          ephemeral: true
        });
      }

      db.prepare(`
        UPDATE absensi SET pulang = ?
        WHERE user_id = ? AND tanggal = ?
      `).run(waktu, userId, tanggal);

      return interaction.reply(
        `🏁 ABSEN PULANG BERHASIL\nKaryawan: ${interaction.user}\nJam: ${waktu} WIB`
      );
    }
  }

  if (interaction.commandName === "status") {
    const data = db.prepare(
      "SELECT * FROM absensi WHERE user_id = ? AND tanggal = ?"
    ).get(userId, tanggal);

    return interaction.reply({
      content: data
        ? `📋 STATUS ABSENSI\nMasuk: ${data.masuk}\nPulang: ${data.pulang || "Belum"}`
        : "Belum ada absensi hari ini.",
      ephemeral: true
    });
  }

  if (interaction.commandName === "rekap") {
    const rows = db.prepare(
      "SELECT * FROM absensi WHERE tanggal = ?"
    ).all(tanggal);

    const hasil = rows.map((r, i) =>
      `${i + 1}. <@${r.user_id}> | Masuk: ${r.masuk} | Pulang: ${r.pulang || "Belum"}`
    );

    return interaction.reply(
      `📊 REKAP ABSENSI ${tanggal}\n\n${hasil.join("\n") || "Belum ada data."}`
    );
  }
});

async function start() {
  await rest.put(
    Routes.applicationGuildCommands(
      process.env.CLIENT_ID,
      process.env.GUILD_ID
    ),
    { body: commands.map(c => c.toJSON()) }
  );

  await client.login(process.env.TOKEN);
}

start().catch(console.error);
            
