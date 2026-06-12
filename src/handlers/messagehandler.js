const chalk = require("chalk");

class MessageHandler {
    constructor(sock, commandHandler) {
        this.sock = sock;
        this.commandHandler = commandHandler;
        this.prefix = "!";
    }

    async handle(msg) {
        try {
            if (msg.key.fromMe) return;
            const from = msg.key.remoteJid;
            if (from.includes("@newsletter")) return;

            const messageContent = msg.message;
            const text = messageContent.conversation || 
                         messageContent.extendedTextMessage?.text || 
                         "";

            if (!text.startsWith(this.prefix)) return;

            const args = text.slice(this.prefix.length).trim().split(/\s+/);
            const commandName = args[0].toLowerCase();
            const params = args.slice(1);

            const sender = msg.key.participant || msg.key.remoteJid;
            const isGroup = from.includes("@g.us");

            console.log(chalk.yellow(`\n💬 Comando recebido: ${this.prefix}${commandName} de ${sender}`));

            await this.commandHandler.execute(commandName, {
                from, sender, isGroup, args: params, text
            });

        } catch (error) {
            console.log(chalk.red("❌ Erro no MessageHandler:"), error);
        }
    }
}

module.exports = MessageHandler;
