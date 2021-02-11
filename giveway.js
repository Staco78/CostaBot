const Discord = require("discord.js");
const { EventEmitter } = require("events");

class Giveway extends EventEmitter {
    constructor(mess = new Discord.Message(), users) {
        super();
        this.users = users;
        this.userMess = mess;
        (async () => {
            this.message = new Discord.MessageEmbed();
            this.message
                .setTitle("Configuration de giveway")
                .setColor("Dark_GOLD")
                .addField("Nombre de gagnants", "1", true)
                .addField("Nombre d'xp gagnée", "100", true)
                .addField("Modification en cours", "Nombre de gagnants");
            this.actualModif = "winners";
            this.sentMess = await this.userMess.channel.send(this.message);
            await Promise.all([
                this.sentMess.react("🔼"),
                this.sentMess.react("🔽"),
                this.sentMess.react("↔️")
            ]);
            let collector = this.sentMess.createReactionCollector(() => true);
            collector.on("collect", (reaction, user) => {
                if (reaction.me) return;
                reaction.users.remove(user);
                if (user.id != this.userMess.author.id) {
                    this.userMess.channel.send("https://tenor.com/view/julien-lepers-c-est-non-gif-11504168");
                    return;
                }

                switch (reaction.emoji.name) {
                    case "↔️":
                        if (this.actualModif == "winners") {
                            this.actualModif = "xp";
                            this.message.fields[2].value = "Quantité d'xp";
                        }
                        else if (this.actualModif == "xp") {
                            this.actualModif = "winners";
                            this.message.fields[2].value = "Nombre de gagnants";
                        }
                        this.sentMess.edit(this.message);
                        break;
                    case "🔼":
                        if (this.actualModif == "xp") {

                            this.message.fields[1].value = (parseInt(this.message.fields[1].value) + 50).toString();
                        }
                        else if (this.actualModif == "winners") {
                            if (parseInt(this.message.fields[0].value) >= this.users.length) {
                                this.userMess.channel.send("Impossible d'avoir plus de gagnants que de personnes sur le serveur !");
                                return;
                            }
                            this.message.fields[0].value = (parseInt(this.message.fields[0].value) + 1).toString();
                        }
                        this.sentMess.edit(this.message);
                        break;

                    case "🔽":
                        if (this.actualModif == "xp") {
                            if (parseInt(this.message.fields[1].value) < 50) {
                                this.userMess.channel.send("Impossible d'avoir une xp négative !");
                                return;
                            }
                            this.message.fields[1].value = (parseInt(this.message.fields[1].value) - 50).toString();
                        }
                        else if (this.actualModif == "winners") {
                            if (parseInt(this.message.fields[0].value) <= 1) {
                                this.userMess.channel.send("Impossible d'avoir 0 gagnants");
                                return;
                            }
                            this.message.fields[0].value = (parseInt(this.message.fields[0].value) - 1).toString();
                        }
                        this.sentMess.edit(this.message);
                        break;
                    default:
                        break;
                }
            });
        })();
    }
    tirage() {
        for (let i = 0; i < parseInt(this.message.fields[0].value); i++) {
            
        }
    }
}

module.exports = Giveway;