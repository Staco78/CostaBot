const fs = require("fs");

const Discord = require("discord.js");
const bot = new Discord.Client();

const config = require("./config.json");
const commandes = require("./commandes.json");

const childProcess = require("child_process");

const ytb = require("ytdl-core");


let child;


function startInterface() {
    child = childProcess.fork("./interface.js");
    child.send(JSON.stringify({ action: "start", uptime: bot.uptime }));
    // global.log("all", bot.uptime);
    child.on("message", (mess) => {
        mess = JSON.parse(mess);
        if (mess.action == "func") {
            global[mess.func]();
        }
        else if (mess.action == "log") {
            global.log("all", mess.data);
        }
    });
    child.on("error", (err) => {
        global.log("all", "Interface erreur", err);
    });
    child.on("close", (code) => {
        global.log("all", "Interface ferme avec le code", code);
        process.exit();
    });
}


//gestion des commandes discord
bot.on("message", (mess) => {
    global.log("message", mess.author.username, "a dit :", mess.content);
    // xp add

    let users;
    fs.readFile("./users.json", (err, data) => {
        users = JSON.parse(data);

        let user = users.find(u => u.id == mess.author.id);

        if (user == undefined) {
            user = {
                username: mess.author.username,
                id: mess.author.id,
                xp: 0,
                lvl: 0
            }
            users.push(user);
        }
        user.xp += config.xp;

        config.levels.forEach((level, i) => {
            // global.log(user.xp, " || ", level.xp, " || ", i, " || ", user.lvl);
            if (user.xp >= level.xp && i > user.lvl) {
                user.lvl++;
                global["passeLvl"](mess, user);
            }
        });

        fs.writeFile("users.json", JSON.stringify(users, null, 4), () => { });

    });

    if (!mess.author.bot) {
        let mentions = mess.mentions.users.array();

        let m = mess.content.replace(/<@!(.*)>/, "@cible");
        m = m.replace(/http(.*):\/\/www.youtube.com\/watch\?v=\w+/i, "LIEN_YOUTUBE");
        m = m.replace("mp3", "FORMAT");
        let args = m.split(" ");
        // global.log(mess.content);
        global.log("all", m);
        if (args[0].toLowerCase() == config.keyWord) {
            let cmd_find = false;
            commandes.forEach((commande) => {
                let cmd_args = commande.cmd.split(" ");
                let x = false;
                cmd_args.forEach((arg, index) => {
                    if (arg != args[index + 1]) {
                        x = true;
                    }
                    if (index == cmd_args.length - 1 && !x) {
                        cmd_find = true;
                        if (commande.access != "") {
                            if (!mess.member.hasPermission(commande.access)) {
                                mess.channel.send("Et non, cette commande est reservé...");
                                return;
                            }
                        }

                        global.log("command", mess.author.username, "a utilise la commande", commande.name);
                        global[commande.action](mess, mentions);
                    }
                });
            });
            if (mess.content == config.keyWord) {
                global["help"](mess);
            } else if (!cmd_find) {
                mess.channel.send("Je ne connais pas cette commande\n*Faut il que je l'apprenne ?*");
            }
        }
    }
});


//toutes les fonctions:

global.startBot = async () => {
    await bot.login(config.token);
    let version = process.env.npm_package_version;
    await bot.user.setActivity("CostaBot v" + version);
    global.log("all", "Bot started !");
}

global.stopBot = () => {
    bot.destroy();
    global.log("all", "Bot stoped !");
}

global.log = function (type) {
    let args = Array.from(arguments);
    args.splice(0, 1);
    console.log(args.join(" "));
    try {
        child.send(JSON.stringify({ action: "addLog", data: args.join(" "), type: type }));
    }
    catch (e) { }
}

global.test = (mess) => {
    mess.channel.send("commande test effectue");
}

global.help = (mess) => {
    let message = new Discord.MessageEmbed();
    message.title = "Liste des commandes";
    message.description = "";
    commandes.forEach((commande) => {
        if (!commande.masked && commande.access == "") {
            message.description += "**" + commande.name + "** : ";
            message.description += "    " + commande.description + "\n";
            message.description += "Utilisation: *" + config.keyWord + " " + commande.cmd + "*\n";
        }
    });
    mess.channel.send(message);
}

global.send_m_xp = (mess) => {
    fs.readFile("./users.json", (err, users) => {
        users = JSON.parse(users);
        let user = users.find((user) => {
            return user.id == mess.author.id;
        });
        mess.channel.send("vous avez " + (user.xp + 1) + "xp !");

    });
}

global.passeLvl = (mess, user) => {
    global.log("levels", "level", user.lvl, "passé par", user.username);
    mess.channel.send("Bravo <@!" + mess.author.id + "> tu es passé au niveau " + user.lvl);
}

global.send_xp_of = (mess, mentions) => {
    fs.readFile("./users.json", (err, users) => {
        users = JSON.parse(users);
        mentions.forEach((mention) => {
            let user = users.find((user) => {
                return user.id == mention;
            });
            mess.channel.send(user.username + " a " + (user.xp) + "xp !");
        });

    });
}

global.xp_reset = (mess, mentions) => {
    fs.readFile("./users.json", (err, users) => {
        users = JSON.parse(users);
        mentions.forEach(mention => {
            let user = users.find((user) => {
                return user.id == mention;
            });
            user.xp = 0;
            user.lvl = 0;
        });
        fs.writeFile("users.json", JSON.stringify(users, null, 4), () => { });
        let string = "L'xp de ";
        mentions.forEach((mention, i) => {
            string += mention.username;
            if (i == mentions.length - 2) {
                string += " et "
            }
            else if (i < mentions.length - 2) {
                string += ", ";
            }
        });
        string += " a été reset (pas de chance...)";
        mess.channel.send(string);
    });
}

global.download = async (mess) => {
    let args = mess.content.split(" ");
    let info = await ytb.getBasicInfo(args[2]);
    fs.access("./download/" + info.videoDetails.videoId + ".mp4", (err) => {
        if (err) {
            let downloader = ytb(args[2], { quality: "highestaudio", filter: filter => filter.codecs == "mp4a.40.2"});
            downloader.pipe(fs.createWriteStream("./download/" + info.videoDetails.videoId + ".mp4"));
            mess.channel.send("Telechargement commencé...");

        }
        else {
            mess.channel.send("Envoi en cours...");
            let message = new Discord.MessageAttachment("./download/" + info.videoDetails.videoId + ".mp4");
            mess.channel.send(message);
        }
    });
}

global.startBot();
startInterface();