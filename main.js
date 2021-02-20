(async function() {
    const fs = require("fs");

    const Discord = require("discord.js");
    const bot = new Discord.Client();

    const config = require("./data/config.json");
    const commandes = require("./data/commandes.json");

    const sanitize = require("sanitize-filename");
    const Process_info = require("process-infos");

    const ytb = require("ytdl-core");
    const WebSocket = require("ws");

    const ffmpeg = require('fluent-ffmpeg');
    ffmpeg.setFfmpegPath("./ffmpeg.exe");

    const GenerateImage = require("./generateImage");
    const Music = require("./music.js");
    const Giveway = require("./giveway.js");
    const { randomInt } = require("crypto");
    const QrCode = require("qrcode");
    const os_utils = require("node-os-utils");

    const { MongoClient } = require('mongodb');
    const uri = "mongodb://localhost:27017/?readPreference=primary&gs" +
        "sapiServiceName=mongodb&appname=MongoDB%20Compass&ssl=false";

    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    const db = client.db("CostaBot").collection("users");

    let WS;
    let MusicPlayer;
    // let giveway;

    fs.writeFileSync("./data/logs.json", JSON.stringify([], null, 4), (err) => {});

    function startInterface() {

    }

    function startServer() {
        let child = childProcess.fork("./server.js");
        child.on("close", (code, signal) => {
            console.log("Server close with code", code);
        });
    }


    //gestion des commandes discord
    bot.on("message", async(mess) => {

        if (mess.guild === null && !mess.author.bot) {

            bot.users.cache.get(config.dmTo).send(`${mess.author.username} a dit: *${mess.content}*`);
            mess.channel.send("Bien recu");
            return;
        }

        global.log("message", mess.author.username, "a dit :", mess.content);

        // xp add  
        await new Promise((resolve, reject) => {
            db.findOne({ id: mess.author.id }, { projection: { _id: 0, id: 1, xp: 1, lvl: 1 } }).then(async(user) => {
                if (user == undefined) {
                    user = await global.createUser(mess.author);
                }
                await addXp(mess.author.id, mess.createdTimestamp);
                await updateUsers(mess);

                resolve();
            }).catch((reason) => {
                reject(reason);
            });
        });

        if (!mess.author.bot) {
            if (mess.content.toLowerCase().startsWith(config.keyWord)) {
                let command = commandes.find((c) => {
                    let r = new RegExp(c.regExp, "ig");
                    return mess.content.match(r) != null
                });
                if (command) {
                    if (command.access != "")
                        if (!mess.member.hasPermission(command.access)) {
                            mess.channel.send("Et non, cette commande est reservé...");
                            return;
                        }
                    global.log("command", `${mess.author.username} a utilise la commande ${command.name}`);
                    global[command.action](mess);


                } else if (mess.content.toLowerCase() == config.keyWord) {
                    global.log("command", `${mess.author.username} a utilise la commande help`);
                    global["help"](mess);
                } else {
                    mess.channel.send("Je ne connais pas cette commande\n*Faut il que je l'apprenne ?*");
                }
            }
        }
    });


    //toutes les fonctions: 

    async function updateUsers(mess, sendMess = true) {
        return new Promise((resolve, reject) => {
            db.find({}, { projection: { _id: 0, id: 1, xp: 1, rank: 1, lvl: 1, avatarUrl: 1 } }).toArray().then((users) => {
                // console.log(users);
                users.sort((a, b) => b.xp - a.xp);
                // console.log(users);
                users.forEach((user, i) => {
                    if (bot.users.cache.get(user.id))
                        var avatarUrl = bot.users.cache.get(user.id).displayAvatarURL({ format: "png" })
                    else
                        var avatarUrl = user.avatarUrl;
                    db.findOneAndUpdate({ id: user.id }, { $set: { rank: i + 1, avatarUrl: avatarUrl } }).then(() => {
                        config.levels.forEach((level, i) => {
                            users.forEach((user) => {
                                if (user.xp >= level.xp && i > user.lvl) {
                                    db.findOneAndUpdate({ id: user.id }, { $set: { lvl: user.lvl + 1 } });
                                    user.lvl++;
                                    if (sendMess)
                                        global["passeLvl"](mess, bot.users.cache.get(user.id));
                                }
                                if (user.xp < level.xp && i < user.lvl) {
                                    db.findOneAndUpdate({ id: user.id }, { $set: { lvl: user.lvl - 1 } });
                                    user.lvl--;
                                }
                            });
                        });
                        resolve();
                    }, (reason) => reject(reason));
                });

            });
        });

    }

    global.startBot = async() => {
        await bot.login(config.token);
        let version = process.env.npm_package_version;
        await bot.user.setActivity("CostaBot v" + version + " (DM si bug)");
        global.log("all", "Bot started !");
    }

    global.stopBot = () => {
        bot.destroy();
        global.log("all", "Bot stoped !");
    }

    global.log = function(type) {
        let args = Array.from(arguments);
        args.splice(0, 1);
        console.log(args.join(" "));
        fs.readFile("./data/logs.json", (err, data) => {
            let logs = JSON.parse(data);
            let m = {
                type: type,
                data: args.join(" ")
            };
            logs.push(m);
            fs.writeFile("./data/logs.json", JSON.stringify(logs, null, 4), (err) => {});
        });
        if (config.interface.active) {
            try {
                WS.send(JSON.stringify({ action: "addLog", data: args.join(" "), type: type }));
            } catch (e) { console.log("error to send log at interface"); }
        }
    }

    global.test = async(mess = new Discord.Message()) => {
        mess.reply("test");
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

    global.send_m_xp = async(mess) => {
        return new Promise((resolve, reject) => {
            db.findOne({ id: mess.author.id }, { projection: { _id: 0, xp: 1, username: 1, lvl: 1, rank: 1 } }).then((user) => {
                if (user == null) { reject(new Error("User don't exist in mongo")) }
                let image = new GenerateImage.XpStatus(mess.author.displayAvatarURL({ format: "png" }), user.xp, user.username, mess.author.discriminator, user.lvl, user.rank, () => {
                    let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                    mess.channel.send(message);
                    resolve();
                });
            });
        });
    }

    global.passeLvl = (mess, u) => {
        return new Promise((resolve, reject) => {
            db.findOne({ id: u.id }, { projection: { _id: 0, xp: 1, username: 1, lvl: 1, rank: 1 } }).then((user) => {
                if (user == null) { reject(new Error("User don't exist in mongo")) }
                global.log("levels", "level", user.lvl, "passé par", user.username);
                let image = new GenerateImage.LevelPass(u.displayAvatarURL({ format: "png" }), user.xp, user.username, u.discriminator, user.lvl, user.rank, () => {
                    let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                    mess.channel.send(message);
                    resolve();
                });
            });
        });
    }

    global.send_xp_of = (mess) => {
        return new Promise((resolve, reject) => {
            let mentions = [];
            mess.mentions.users.array().forEach((mention) => {
                mentions.push(mention.id);
            });
            db.find({ id: { $in: mentions } }, { projection: { _id: 0, id: 1, username: 1, xp: 1, lvl: 1, rank: 1 } }).toArray().then((result) => {
                if (result == null) {
                    reject(new Error("Utilisateur introuvable"));
                }
                result.forEach((user, i) => {
                    let image = new GenerateImage.XpStatus(mess.mentions.users.array()[i].displayAvatarURL({ format: "png" }), user.xp, user.username, mess.mentions.users.array()[i].discriminator, user.lvl, user.rank, () => {
                        let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                        mess.channel.send(message);
                    });
                });
                resolve();
            }).catch(reason => reject(reason));
        });
    }

    global.xp_reset = async(mess) => {
        return new Promise((resolve, reject) => {
            let mentions = [];
            mess.mentions.users.array().forEach((mention) => {
                mentions.push(mention.id);
            });
            db.find({ id: { $in: mentions } }, { projection: { _id: 0, id: 1, username: 1, xp: 1, lvl: 1 } }).toArray().then((result) => {
                result.forEach(async(user, i) => {
                    user.xp = 0;
                    user.lvl = 0;
                    await db.findOneAndUpdate({ id: user.id }, { $set: { xp: user.xp, lvl: user.lvl } });
                    mess.channel.send(`L'xp de ${user.username} a été reset (pas de chance...)`);
                });
                resolve();
            }).catch(reason => reject(reason));
        });
    }

    global.download = async(mess) => {
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
        fs.access("./download/" + info.videoDetails.videoId + "." + format, async(err) => {
            if (err) {
                await new Promise((resolve, reject) => {
                    mess.channel.send("Telechargement en cours...");
                    let downloader = ytb(args[2], { filter: filter => { return filter.container == downloadFormat && filter.audioCodec == audioCodec && filter.videoCodec == videoCodec; } });
                    if (format == downloadFormat) {
                        downloader.pipe(fs.createWriteStream("./download/" + info.videoDetails.videoId + "." + format)).on("finish", () => {
                            fs.writeFile(__dirname + "/download/name/" + info.videoDetails.videoId, sanitize(info.videoDetails.title) + "." + format, (err) => {});
                            resolve();
                        });
                    } else {
                        ffmpeg(downloader)
                            .toFormat(format)
                            .saveToFile("./download/" + info.videoDetails.videoId + "." + format)
                            .on("end", () => {
                                fs.writeFile(__dirname + "/download/name/" + info.videoDetails.videoId, sanitize(info.videoDetails.title) + "." + format, (err) => {});
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

    global.spam = async(mess) => {
        let x = setInterval(() => {
            mess.channel.send("ET C LE SPAM <@!" + mess.mentions.users.array()[0] + ">")
        }, 1000);
        setTimeout(() => { clearInterval(x); }, 1000 * 60 * 0.5);
    }

    global.createUser = async(user) => {
        return new Promise((resolve, reject) => {
            let newUser = {
                "username": user.username,
                "discriminator": user.discriminator,
                "id": user.id,
                "xp": 0,
                "lvl": 0,
                "lastMessage": null,
                "rank": null,
                "avatarUrl": user.displayAvatarURL({ format: "png" })
            }
            db.insertOne(newUser).then(resolve(newUser)).catch(reason => reject(reason));
        });
    }

    global.help_admin = (mess) => {
        let message = new Discord.MessageEmbed()
            .setTitle("Liste des commandes administrateurs")
            .setDescription("")
            .setColor("RED");

        commandes.forEach((commande) => {
            if (!commande.masked && commande.access == "ADMINISTRATOR") {
                message.description += "**" + commande.name + "** : ";
                message.description += "    " + commande.description + "\n";
                message.description += "Utilisation: *" + config.keyWord + " " + commande.cmd + "*\n";
            }
        });
        mess.channel.send(message);
    }

    async function addXp(id, createdTimestamp, _xp) {
        return new Promise((resolve, reject) => {
            db.findOne({ id: id }, { projection: { _id: 0, xp: 1, lastMessage: 1 } }).then((user) => {
                if (user == null) {
                    reject(new Error("Utilisateur introuvable"));
                }
                let add = 0;
                let xp = user.xp;
                if (user.lastMessage == null || createdTimestamp - user.lastMessage > config.antispamMs) {
                    if (_xp) {
                        add = _xp;
                    } else {
                        add = randomInt(config.xp.text.min, config.xp.text.max);
                    }
                    xp += add;
                    user.lastMessage = createdTimestamp != Infinity ? createdTimestamp : user.lastMessage;
                }
                db.findOneAndUpdate({ id: id }, { $set: { xp: xp, lastMessage: user.lastMessage } })
                    .then(resolve(add))
                    .catch(reason => reject(reason));
            });
        });
    }

    global.add_xp = async(mess) => {
        let mention = mess.mentions.users.array()[0];
        await addXp(mention.id, Infinity, parseInt(mess.content.split(" ")[4]));
        await updateUsers(mess);
        let user = await db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1, lvl: 1, rank: 1 } });
        mess.channel.send(`${mention.username} vient de gagner ${mess.content.split(" ")[4]}xp et est` +
            ` maintenant level ${user.lvl} avec ${user.xp}xp et rang ${user.rank}`);
    }

    global.set_xp = (mess) => {
        let mention = mess.mentions.users.array()[0];
        db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1 } }).then(async(user) => {
            await db.findOneAndUpdate({ id: mention.id }, { $set: { lvl: 0 } });
            await addXp(mention.id, Infinity, parseInt(mess.content.split(" ")[4]) - user.xp);
            await updateUsers(mess, false);
            user = await db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1, lvl: 1, rank: 1 } });
            mess.channel.send(`${mention.username} a maintenant ${user.xp}xp et est maintenant level ${user.lvl} et rang ${user.rank}`);
        });

    }

    global.classement = async(mess) => {
        await updateUsers(mess);
        db.find({}, { _id: 0, id: 1, username: 1, discriminator: 1, avatarUrl: 1, lvl: 1, rank: 1 }).toArray().then((users) => {
            new GenerateImage.Classement(users, (image) => {
                let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
                mess.channel.send(message);
            })
        });
    }

    global.ta_gueule = (mess) => {
        mess.channel.send("https://tenor.com/view/milk-and-mocha-cry-sad-tears-upset-gif-11667710");
    }

    global.random = (mess) => {
        if (mess.content.split(" ").length == 2) {
            mess.channel.send(randomInt(1, 10));
        } else if (mess.content.split(" ").length == 3) {
            mess.channel.send(randomInt(1, parseInt(mess.content.split(" ")[2])));
        } else if (mess.content.split(" ").length == 4) {
            mess.channel.send(randomInt(parseInt(mess.content.split(" ")[2]), parseInt(mess.content.split(" ")[3])));
        }
    }

    global.qr = (mess) => {
        let m = mess.content.slice(mess.content.indexOf(" ") - 1, mess.content.length).slice(mess.content.indexOf(" "), mess.content.length);
        QrCode.toBuffer(m, (err, result) => {
            if (err) {
                mess.channel.send("Erreur");
                return;
            }
            mess.channel.send(new Discord.MessageAttachment(result));
        });
    }

    global.avatar = (mess) => {
        // var mess = new Discord.Message()
        let mentions = mess.mentions.users.array();
        let size = mess.content.match(/\s[0-9]+\s/) || 128;
        let format = mess.content.match(/png|gif|jpeg|jpg|webp/i) || "png";
        if (Array.isArray(size))
            size = size[0];
        if (Array.isArray(format))
            format = format[0];

        if (mentions.length == 0) {
            mess.channel.send(mess.author.displayAvatarURL({ format: format, size: parseInt(size) }));
        } else {
            mentions.forEach(mention => {
                mess.channel.send(mention.displayAvatarURL({ format: format, size: parseInt(size) }));
            });
        }
    }

    global.dl_minia = (mess) => {
        let link = mess.content.match(/https?:\/\/www.youtube.com\/watch\?v=(\S+)/);
        mess.channel.send("http://img.youtube.com/vi/" + link[1] + "/maxresdefault.jpg");
    }

    global.music = (mess) => {
        if (MusicPlayer)
            MusicPlayer.destroy()
        MusicPlayer = new Music.Player(mess);
    }

    global.music_add = (mess) => {
        if (!MusicPlayer) {
            mess.channel.send("Erreur: Le lecteur de musique n'est pas actif");
            return;
        }
        if (MusicPlayer.channel != mess.channel) {
            mess.channel.send("Erreur: Le lecteur de musique n'est pas dans ce channel");
            return;
        }
        let link = mess.content.match(/https?:\/\/www.youtube.com\/watch\?v=\S+/);
        let list = mess.content.match(/https?:\/\/www.youtube.com\/playlist\?list=(\S+)/);

        if (link)
            MusicPlayer.add(link);
        else if (list)
            MusicPlayer.add_playlist(list[1]);
        else
            mess.channel.send("Erreur: aucun lien trouvé");
    }

    global.music_resend = (mess) => {
        if (MusicPlayer)
            MusicPlayer.resend(mess);
    }

    global.giveway = async(mess) => {
        // if (giveway)
        //     giveway.destroy();
        // giveway = new Giveway(mess, await db.find({}).toArray()).on("end", (users, xp) => {
        //     users.forEach(async (user) => {
        //         await addXp(user.id, Infinity, xp);
        //     });
        // });
    }

    global.startBot();
    if (config.server.active)
        startServer();
    if (config.interface.active)
        startInterface();


    setInterval(() => {
        bot.users.cache.forEach(user => {
            let member = bot.guilds.cache.array()[0].member(user.id);
            if (member)
                if (member.voice)
                    if (member.voice.channel)
                        addXp(user.id, Infinity, randomInt(config.xp.voc.min, config.xp.voc.max));
        });
    }, 60000);


    //ws
    if (config.interface.active)
        var interfaceWss = new WebSocket.Server({ port: config.interface.port });
    interfaceWss.on("connection", (ws) => {
        console.log("connection au ws de l'interface");
        WS = ws;
        ws.connected = false;
        ws.on("message", (data) => {
            let mess = JSON.parse(data);
            if (!ws.connected && mess.action != "connect") {
                console.log(`Connection non autorisé depuis ${ws.url}`);
                ws.close(403, "Unauthorized");
                return;
            }
            switch (mess.action) {
                case "connect":
                    if (!ws.connected) {
                        if (ws.authorized(mess)) {
                            ws.interval = setInterval(async() => {
                                ws.send(JSON.stringify({
                                    action: "refresh",
                                    perf: {
                                        cpu_usage: await os_utils.cpu.usage(),
                                        mem: await os_utils.mem.info()
                                    },
                                    discord_infos: {
                                        channels: Process_info.discordChannels(bot),
                                        version: Process_info.discordVersion(),
                                        users: Process_info.discordUsers(bot)
                                    }
                                }));
                            }, 1000);
                            ws.send(JSON.stringify({ action: "connect", uptime: bot.uptime }));
                            fs.readFile("./data/logs.json", (err, data) => {
                                data = JSON.parse(data);
                                ws.send(JSON.stringify({
                                    action: "logs",
                                    logs: data
                                }));
                            });
                            ws.connected = true;
                        } else
                            ws.close(4003);
                    }
                    break;
                case "func":
                    global[mess.func]();
                    break;
                case "log":
                    global.log("all", mess.data);
                    break;
                default:
                    break;
            }
        });

        ws.on("close", (code, reason) => {
            ws.connected = false;
            clearInterval(ws.interval);
        });

        ws.authorized = (mess) => {
            return mess.token == config.interface.token;
        }
    });


    //api
    if (config.api.active) {
        const express = require('express');
        const app = express();
        app.listen(config.api.port);

        app.get("/musics/infos/all", (req, res) => {
            if (MusicPlayer)
                res.status(200).json(MusicPlayer.getAllInfos());
            else
                res.status(200).json({ Error: "No music player" });
        });
        app.get("/musics/historic/infos/all", (req, res) => {
            if (MusicPlayer)
                res.status(200).json(MusicPlayer.getAllHistoricInfos());
            else
                res.status(200).json({ Error: "No music player" });
        });
        app.get("/musics/all/infos/all", (req, res) => {
            if (MusicPlayer)
                res.status(200).json(MusicPlayer.getAllHistoricInfos().concat(MusicPlayer.getAllInfos()));
            else
                res.status(200).json({ Error: "No music player" });
        });
        app.get("/musics/infos", (req, res) => {
            if (MusicPlayer)
                res.status(200).json(MusicPlayer.getInfos());
            else
                res.status(200).json({ Error: "No music player" });
        });
        app.get("/musics/historic/infos", (req, res) => {
            if (MusicPlayer)
                res.status(200).json(MusicPlayer.getHistoricInfos());
            else
                res.status(200).json({ Error: "No music player" });
        });
        app.get("/musics/all/infos", (req, res) => {
            if (MusicPlayer)
                res.status(200).json(MusicPlayer.getHistoricInfos().concat(MusicPlayer.getInfos()));
            else
                res.status(200).json({ Error: "No music player" });
        });


    }
})()