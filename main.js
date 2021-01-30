const fs = require("fs");

const Discord = require("discord.js");
const bot = new Discord.Client();

const config = require("./data/config.json");
const commandes = require("./data/commandes.json");

const sanitize = require("sanitize-filename");
const childProcess = require("child_process");

const ytb = require("ytdl-core");
const WebSocket = require("ws");
const wss = new WebSocket.Server({ port: config.interface.port });

const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const GenerateImage = require("./generateImage");
const { randomInt } = require("crypto");

let WS;

function startInterface() {

}

function startServer() {
    let child = childProcess.fork("./server.js");
    child.on("close", (code, signal) => {
        console.log("Server close with code", code, "and signal", signal);
    });
}


//gestion des commandes discord
bot.on("message", async (mess) => {

    if (mess.guild.id != 664438592093028374) { return; }

    global.log("message", mess.author.username, "a dit :", mess.content);
    // xp add  

    let users;

    await new Promise((resolve, reject) => {
        fs.readFile("./data/users.json", async (err, data) => {
            if (err) {
                reject();
            }
            users = JSON.parse(data);

            let user = users.find(u => u.id == mess.author.id);

            if (user == undefined) {
                user = await global.createUser(mess.author);
                users.push(user);
            }
            addXp(mess.author.id, mess.createdTimestamp);
            config.levels.forEach((level, i) => {
                if (user.xp >= level.xp && i > user.lvl) {
                    let data = JSON.parse(fs.readFileSync("./data/users.json"));
                    let uu = data.find(u => u.id == mess.author.id);
                    uu.lvl++;
                    fs.writeFileSync("./data/users.json", JSON.stringify(data, null, 4));
                    global["passeLvl"](mess, uu);
                }
            });
            resolve();

        });
    });

    if (!mess.author.bot) {
        let m = mess.content.replace(/<@!(.*)>/, "@cible");
        m = m.replace(/http(.*):\/\/www.youtube.com\/watch\?v=\S+/i, "LIEN_YOUTUBE");
        m = m.replace(/audio|video/i, "FORMAT");
        let args = m.split(" ");
        // global.log(mess.content);
        // global.log("all", m);
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
                        global[commande.action](mess);
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
    if (config.interface.active) {
        try {
            WS.send(JSON.stringify({ action: "addLog", data: args.join(" "), type: type }));
        } catch (e) { console.log("error to send log at interface"); }
    }
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
    fs.readFile("./data/users.json", (err, users) => {
        users = JSON.parse(users);
        let user = users.find((user) => {
            return user.id == mess.author.id;
        });

        let image = new GenerateImage.XpStatus(mess.author.displayAvatarURL({ format: "png" }), user.xp + 1, user.username, mess.author.discriminator, user.lvl, () => {
            let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
            mess.channel.send(message);
        });
    });
}

global.passeLvl = (mess, user) => {
    global.log("levels", "level", user.lvl, "passé par", user.username);
    mess.channel.send("Bravo <@!" + mess.author.id + "> tu es passé au niveau " + user.lvl);
}

global.send_xp_of = (mess) => {
    fs.readFile("./data/users.json", async (err, users) => {
        users = JSON.parse(users);
        let mentions = mess.mentions.users.array();
        mentions.forEach(async (mention, i) => {
            // let author = mess.mentions.
            let user = users.find((user) => {
                return user.id == mention;
            });
            if (user == undefined) {
                user = await global.createUser(mention);
            }
            let image = new GenerateImage.XpStatus(mention.displayAvatarURL({ format: "png" }), user.xp + 1, user.username, mention.discriminator, user.lvl, () => {
                let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                mess.channel.send(message);
            });

        });
    });
}

global.xp_reset = (mess) => {
    fs.readFile("./data/users.json", (err, users) => {
        let mentions = mess.mentions.users.array();
        users = JSON.parse(users);
        mentions.forEach(mention => {
            let user = users.find((user) => {
                return user.id == mention;
            });
            user.xp = 0;
            user.lvl = 0;
        });
        fs.writeFile("./data/users.json", JSON.stringify(users, null, 4), () => { });
        let string = "L'xp de ";
        mentions.forEach((mention, i) => {
            string += mention.username;
            if (i == mentions.length - 2) {
                string += " et "
            } else if (i < mentions.length - 2) {
                string += ", ";
            }
        });
        string += " a été reset (pas de chance...)";
        mess.channel.send(string);
    });
}

global.download = async (mess) => {
    let args = mess.content.split(" ");
    let audioCodec;
    let format;
    let videoCodec;
    let downloadFormat = "mp4";
    if (args[4] == "audio") {
        format = "mp3";
        audioCodec = "mp4a.40.2";
        videoCodec = null;
    } else if (args[4] == "video") {
        format = "mp4";
        audioCodec = "mp4a.40.2";
        videoCodec = "avc1.64001F"
    }
    let info = await ytb.getBasicInfo(args[2]);
    fs.access("./download/" + info.videoDetails.videoId + "." + format, async (err) => {
        if (err) {
            await new Promise((resolve, reject) => {
                mess.channel.send("Telechargement commencé...");
                let downloader = ytb(args[2], { filter: filter => { return filter.container == downloadFormat && filter.audioCodec == audioCodec && filter.videoCodec == videoCodec; } });
                if (format == downloadFormat) {
                    downloader.pipe(fs.createWriteStream("./download/" + info.videoDetails.videoId + "." + format)).on("finish", () => {
                        fs.writeFile(__dirname + "/download/name/" + info.videoDetails.videoId, sanitize(info.videoDetails.title) + "." + format, (err) => { });
                        resolve();
                    });
                } else {
                    ffmpeg(downloader)
                        .toFormat(format)
                        .saveToFile("./download/" + info.videoDetails.videoId + "." + format)
                        .on("end", () => {
                            fs.writeFile(__dirname + "/download/name/" + info.videoDetails.videoId, sanitize(info.videoDetails.title) + "." + format, (err) => { });
                            resolve();
                        });
                }

            });
        }

        fs.stat("./download/" + info.videoDetails.videoId + "." + format, (err, stats) => {
            if (err) throw err;
            if (stats.size > 8000000) {
                mess.channel.send("Fichier trop gros...\nClique ici: " + config.server.url + "download/" + info.videoDetails.videoId + "." + format);
            } else {
                mess.channel.send("Envoi en cours...");
                let message = new Discord.MessageAttachment("./download/" + info.videoDetails.videoId + "." + format);
                mess.channel.send(message).catch((reason) => {
                    mess.channel.send("Erreur veuillez réessayer !");
                    console.log(reason);
                });
            }
        });
    });
}

global.spam = async (mess) => {
    let x = setInterval(() => {
        mess.channel.send("ET C LE SPAM <@!" + mess.mentions.users.array()[0] + ">")
    }, 1000);
    setTimeout(() => { clearInterval(x); }, 1000 * 60 * 0.5);
}

global.createUser = async (user) => {
    return new Promise((resolve, reject) => {
        fs.readFile("./data/users.json", (err, data) => {
            data = JSON.parse(data);
            data.forEach((u) => {
                if (u.id == user.id) {
                    reject(new Error("L'utilisateur existe deja !"));
                }
            });
            let newUser = {
                "username": user.username,
                "id": user.id,
                "xp": 0,
                "lvl": 0
            }
            data.push(newUser);
            fs.writeFile("./data/users.json", JSON.stringify(data, null, 4), (err) => {
                if (err)
                    reject(err);
                else
                    resolve(newUser);
            })
        });
    });
}

async function addXp(id, createdTimestamp) {
    return new Promise((resolve, reject) => {
        let data = JSON.parse(fs.readFileSync("./data/users.json"));
        data.forEach((user) => {
            if (user.id == id){
                if (user.lastMessage == null || createdTimestamp - user.lastMessage > config.antispamMs){
                    user.xp += randomInt(config.xp.min, config.xp.max);
                    user.lastMessage = createdTimestamp;
                }
            }
        });
        fs.writeFileSync("./data/users.json", JSON.stringify(data, null, 4));
        resolve();
    });
}


global.startBot();
if (config.server.active)
    startServer();
if (config.interface.active)
    startInterface();


//ws

wss.on("connection", (ws) => {
    WS = ws;
    ws.send(JSON.stringify({ action: "start", uptime: bot.uptime }));
    ws.on("message", (data) => {
        let mess = JSON.parse(data);
        if (mess.action == "func") {
            global[mess.func]();
        } else if (mess.action == "log") {
            global.log("all", mess.data);
        }
    });
});
