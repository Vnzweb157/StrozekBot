const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");
const fs = require("fs");
const qrcode = require("qrcode-terminal");

const { CommandHandler } = require("./handlers/commandhandler");
const MessageHandler = require("./handlers/messagehandler");

const logger = pino({ level: "silent" });

async function connectToWhatsApp() {
    // Usando uma pasta totalmente nova e neutra
    const { state, saveCreds } = await useMultiFileAuthState("whatsapp_session");

    const sock = makeWASocket({
        auth: state,
        logger: logger,
        printQRInTerminal: false,
        // Usamos a emulação nativa do macOS com Safari, que é a mais aceita e menos bloqueada pelo ecossistema do WhatsApp
        browser: Browsers.macOS("Safari"),
        // Parâmetros limpos para evitar o filtro de spam (405)
        syncFullHistory: false,
        qrTimeoutMs: 60000,
        connectTimeoutMs: 60000
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
            console.log(chalk.blue("⏳ Estabelecendo conexão segura com o servidor..."));
        }

        if (connection === "open") {
            console.log(chalk.green("\n✅ Bot conectado com sucesso e 100% independente!"));
            console.log(chalk.green(`🤖 Conectado no número: ${sock.user.id.split(":")[0]}`));
            console.log(chalk.green("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"));
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            
            if (reason === DisconnectReason.loggedOut || reason === 405) {
                console.log(chalk.red(`\n⚠️ Bloqueio temporário do WhatsApp (Erro 405).`));
                console.log(chalk.yellow("Limpando cache de tentativas... Aguarde 10 segundos antes do próximo disparo automático."));
                try { fs.rmSync("whatsapp_session", { recursive: true, force: true }); } catch (e) {}
                setTimeout(() => { connectToWhatsApp(); }, 10000);
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
