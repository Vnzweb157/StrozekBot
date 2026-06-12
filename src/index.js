const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");
const fs = require("fs");
const qrcode = require("qrcode-terminal");

const { CommandHandler } = require("./handlers/commandhandler");
const MessageHandler = require("./handlers/messagehandler");

const logger = pino({ level: "error" });

async function connectToWhatsApp() {
    // Mudamos o nome da pasta para forçar o WhatsApp a gerar um QR Code novo do zero
    const { state, saveCreds } = await useMultiFileAuthState("session_strozek");

    const sock = makeWASocket({
        auth: state,
        logger: logger,
        printQRInTerminal: false,
        // Usando o formato de array mais recente aceito pelas versões novas do Baileys
        browser: ["Ubuntu", "Chrome", "20.0.04"],
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
            console.log(chalk.blue("⏳ Conectando ao WhatsApp com nova sessão..."));
        }

        if (connection === "open") {
            console.log(chalk.green("\n✅ Bot conectado com sucesso e 100% independente!"));
            console.log(chalk.green(`🤖 Conectado no número: ${sock.user.id.split(":")[0]}`));
            console.log(chalk.green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.yellow(`\n⚠️ Conexão fechada. Razão: ${reason}`));

            if (reason === DisconnectReason.loggedOut || reason === 405) {
                console.log(chalk.red("💥 Dispositivo desconectado no WhatsApp. Limpando pasta de sessão..."));
                try { fs.rmSync("session_strozek", { recursive: true, force: true }); } catch (e) {}
                console.log(chalk.green("🔄 Tentando gerar novo QR Code em 5 segundos..."));
                setTimeout(() => { connectToWhatsApp(); }, 5000);
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
