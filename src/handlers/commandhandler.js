const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

class CommandHandler {
    constructor(sock) {
        this.sock = sock;
        this.commands = new Map();
        this.loadCommands();
    }

    loadCommands() {
        const commandsPath = path.join(__dirname, "../commands");
        if (!fs.existsSync(commandsPath)) return;

        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

        for (const file of commandFiles) {
            try {
                const CommandClass = require(path.join(commandsPath, file));
                const cmd = new CommandClass(this.sock);
                this.commands.set(cmd.name, cmd);
                console.log(chalk.green(`📦 Comando injetado: !${cmd.name}`));
            } catch (error) {
                console.log(chalk.red(`❌ Erro ao carregar comando ${file}:`), error);
            }
        }
    }

    async execute(commandName, context) {
        const cmd = this.commands.get(commandName);
        if (cmd) {
            await cmd.execute(context);
        }
    }
}

module.exports = { CommandHandler };
