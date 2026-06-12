const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");
const fs = require("fs");
const qrcode = require("qrcode-terminal");

const { CommandHandler } = require("./handlers/commandHandler");
const MessageHandler = require("./handlers/messageHandler");

const logger = pino({ level: "error" });

async function connectToWhatsApp() {
    if (fs.existsSync("auth_info_multi/creds.json")) {
        try {
            const creds = JSON.parse(fs.readFileSync("auth_info_multi/creds.json", "utf-8"));
            if (!creds.me) {
                console.log(chalk.red("💥 Credenciais incompletas detectadas. Limpando..."));
                fs.rmSync("auth_info_multi", { recursive: true, force: true });
            }
        } catch (e) {
            fs.rmSync("auth_info_multi", { recursive: true, force: true });
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState("auth_info_multi");

    const sock = makeWASocket({
        auth: state,
        logger: logger,
        printQRInTerminal: false,
        browser: Browsers.macOS("Desktop"),
        syncFullHistory: false
    });

    const commandHandler = new CommandHandler(sock);
    const messageHandler = new MessageHandler(sock, commandHandler);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.clear();
            console.log(chalk.cyan("╔════════════════════════════════════╗"));
            console.log(chalk.cyan("║      📱 ESCANEIE O QR CODE:        ║"));
            console.log(chalk.cyan("╚════════════════════════════════════╝\n"));
            qrcode.generate(qr, { small: true });
        }

        if (connection === "connecting") {
            console.log(chalk.blue("⏳ Conectando ao WhatsApp..."));
        }

        if (connection === "open") {
            console.log(chalk.green("\n✅ Bot conectado com sucesso e 100% independente!"));
            console.log(chalk.green(`🤖 Conectado no número: ${sock.user.id.split(":")[0]}`));
            console.log(chalk.green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.yellow(`⚠️ Conexão fechada. Razão: ${reason}`));

            if (reason === DisconnectReason.loggedOut || reason === 405) {
                console.log(chalk.red("💥 Sessão inválida. Pare o bot com CTRL+C, rode 'rm -rf auth_info_multi' e ligue novamente."));
            } else {
                setTimeout(() => { connectToWhatsApp(); }, 5000);
            }
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;
            await messageHandler.handle(msg);
        } catch (error) {
            console.log(chalk.red("❌ Erro ao processar mensagem:"), error);
        }
    });
}

connectToWhatsApp().catch(err => console.log(chalk.red("Erro fatal:"), err));
