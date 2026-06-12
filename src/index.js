const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const pino = require("pino");
const chalk = require("chalk");
const fs = require("fs");
const readline = require("readline");

const { CommandHandler } = require("./handlers/commandhandler");
const MessageHandler = require("./handlers/messagehandler");

const logger = pino({ level: "silent" });

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(text, (ans) => { rl.close(); resolve(ans); }));
};

async function connectToWhatsApp() {
    // Usando uma pasta limpa para isolar o login por código
    const { state, saveCreds } = await useMultiFileAuthState("whatsapp_session");

    const sock = makeWASocket({
        auth: state,
        logger: logger,
        printQRInTerminal: false,
        browser: Browsers.macOS("Safari"),
        syncFullHistory: false
    });

    const commandHandler = new CommandHandler(sock);
    const messageHandler = new MessageHandler(sock, commandHandler);

    // Se não estiver conectado, solicita o número para gerar o código de pareamento
    if (!sock.authState.creds.registered) {
        console.clear();
        console.log(chalk.cyan("╔════════════════════════════════════╗"));
        console.log(chalk.cyan("║    OPÇÃO DE CONEXÃO POR CÓDIGO     ║"));
        console.log(chalk.cyan("╚════════════════════════════════════╝\n"));
        
        const phoneNumber = await question(chalk.yellow("Digite o número do bot com DDD (Ex: 5511999999999): "));
        
        if (phoneNumber) {
            try {
                setTimeout(async () => {
                    let code = await sock.requestPairingCode(phoneNumber.trim());
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.log(chalk.green(`\n🔑 SEU CÓDIGO DE PAREAMENTO: ${chalk.bold.white(code)}`));
                    console.log(chalk.gray("Abra o WhatsApp -> Aparelhos Conectados -> Conectar com número de telefone e digite o código acima.\n"));
                }, 3000);
            } catch (err) {
                console.log(chalk.red("Erro ao solicitar código de pareamento:"), err);
            }
        }
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

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
                console.log(chalk.red(`\n❌ Conexão rejeitada (Erro ${reason}). Limpando cache...`));
                try { fs.rmSync("whatsapp_session", { recursive: true, force: true }); } catch (e) {}
                console.log(chalk.yellow("\nDICA: Se o erro persistir, mude a internet do PC para o 4G do celular apenas para conectar."));
                process.exit(1);
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
