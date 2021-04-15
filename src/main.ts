import Discord from "discord.js";
import ffmpeg from "fluent-ffmpeg";
import { MongoClient } from "mongodb";
import { randomInt } from "crypto";
import QrCode from "qrcode";
import WebSocket from "ws";
// @ts-ignore
import os_utils from "node-os-utils";
// @ts-ignore
import Process_info from "process-infos";
import express from "express";
import { google } from "googleapis";

import MusicPlayer from "./music";
import * as GenerateImage from "./generateImage";
import * as costa_utils from "./utils";
import server from "./server";
import Giveway from "./giveway";
import * as logger from "./logger";
import appSocket from "./appSocket";
import Radio from "./radio";

import config from "./data/config.json";
import commandes from "./data/commandes.json";

(async function () {
	process.title = "CostaBot";
	let all: any = {};
	const bot = new Discord.Client();

	ffmpeg.setFfmpegPath(config.ffmpegPath);

	const client = new MongoClient(config.mongoDb.uri, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	});
	await client.connect();
	const db = client.db("CostaBot").collection("users");

	let WS: WebSocket;
	let ActualMusicPlayer: MusicPlayer | undefined;
	let actualRadio: Radio | undefined;
	let appConnection = new appSocket(bot);

	let logs: costa_utils.log[] = [];

	google.options({ auth: config.google_api_key });
	const Youtube = google.youtube("v3");

	//gestion des commandes discord
	bot.on("message", async mess => {
		if (mess.guild === null && !mess.author.bot) {
			bot.users.cache.get(config.dmTo)?.send(`${mess.author.username} a dit: *${mess.content}*`);
			mess.channel.send("Bien recu");
			return;
		}

		all.log("message", mess.author.username, "a dit :", mess.content);

		// xp add
		await new Promise<void>((resolve, reject) => {
			db.findOne({ id: mess.author.id }, { projection: { _id: 0, id: 1, xp: 1, lvl: 1 } })
				.then(async user => {
					if (user == undefined) {
						user = await all.createUser(mess.author);
					}
					await addXp(mess.author.id, mess.createdTimestamp);
					await updateUsers(mess);

					resolve();
				})
				.catch(reason => {
					reject(reason);
				});
		});

		if (!mess.author.bot) {
			if (mess.content.toLowerCase().startsWith(config.keyWord)) {
				let command = commandes.find(c => {
					let r = new RegExp(c.regExp, "ig");
					return mess.content.match(r) != null;
				});
				if (command) {
					if (command.access != "")
						if (mess.member !== null)
							if (!mess.member.hasPermission(command.access as any)) {
								mess.channel.send("Et non, cette commande est reservé...");
								return;
							}
					all.log("command", `${mess.author.username} a utilise la commande ${command.name}`);
					all[command.action](mess);
				} else if (mess.content.toLowerCase() == config.keyWord) {
					all.log("command", `${mess.author.username} a utilise la commande help`);
					all["help"](mess);
				} else {
					mess.channel.send("Je ne connais pas cette commande\n*Faut il que je l'apprenne ?*");
				}
			}
		}
	});

	//toutes les fonctions:

	async function updateUsers(mess: Discord.Message, sendMess = true) {
		return new Promise((resolve, reject) => {
			db.find({}, { projection: { _id: 0, id: 1, xp: 1, rank: 1, lvl: 1, avatarUrl: 1 } })
				.toArray()
				.then(users => {
					// logger.log(users);
					users.sort((a, b) => b.xp - a.xp);
					// logger.log(users);
					users.forEach((user, i) => {
						if (bot.users.cache.get(user.id) !== undefined) {
							let x: any = bot.users.cache.get(user.id)?.displayAvatarURL({ format: "png" });
							var avatarUrl: string = x as string;
						} else var avatarUrl: string = user.avatarUrl;
						db.findOneAndUpdate({ id: user.id }, { $set: { rank: i + 1, avatarUrl: avatarUrl } }).then(
							() => {
								config.levels.forEach((level, i) => {
									users.forEach(user => {
										if (user.xp >= level.xp && i > user.lvl) {
											db.findOneAndUpdate({ id: user.id }, { $set: { lvl: user.lvl + 1 } });
											user.lvl++;
											if (sendMess) all["passeLvl"](mess, bot.users.cache.get(user.id));
										}
										if (user.xp < level.xp && i < user.lvl) {
											db.findOneAndUpdate({ id: user.id }, { $set: { lvl: user.lvl - 1 } });
											user.lvl--;
										}
									});
								});
								resolve(null);
							},
							reason => reject(reason)
						);
					});
				});
		});
	}

	all.startBot = async () => {
		await bot.login(config.token);
		let version = process.env.npm_package_version;
		await (bot.user as Discord.ClientUser).setActivity("CostaBot v" + version + " (DM si bug)");
		all.log("all", "Bot started !");
	};

	all.stopBot = () => {
		bot.destroy();
		all.log("all", "Bot stoped !");
	};

	all.log = function (type: string) {
		let args = Array.from(arguments);
		args.splice(0, 1);
		logger.log(args.join(" "));
		let m = {
			type: type,
			data: args.join(" "),
		};
		logs.push(m);

		if (config.interface.active) {
			try {
				WS.send(JSON.stringify({ action: "addLog", data: args.join(" "), type: type }));
			} catch (e) {
				// logger.log("error to send log at interface");
			}
		}
	};

	all.test = async (mess: Discord.Message) => {
		mess.reply("test");
	};

	all.help = (mess: Discord.Message) => {
		let message = new Discord.MessageEmbed();
		message.title = "Liste des commandes";
		message.description = "";
		commandes.forEach(commande => {
			if (!commande.masked && commande.access == "") {
				message.description += "**" + commande.name + "** : ";
				message.description += "    " + commande.description + "\n";
				message.description += "Utilisation: *" + config.keyWord + " " + commande.cmd + "*\n";
			}
		});
		mess.channel.send(message);
	};

	all.send_m_xp = async (mess: Discord.Message) => {
		return new Promise((resolve, reject) => {
			db.findOne({ id: mess.author.id }, { projection: { _id: 0, xp: 1, username: 1, lvl: 1, rank: 1 } }).then(user => {
				if (user == null) {
					reject(new Error("User don't exist in mongo"));
				}
				let image = new GenerateImage.XpStatus(mess.author.displayAvatarURL({ format: "png" }), user.xp, user.username, mess.author.discriminator, user.lvl, user.rank, () => {
					let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
					mess.channel.send(message);
					resolve(null);
				});
			});
		});
	};

	all.passeLvl = (mess: Discord.Message, u: Discord.User) => {
		return new Promise((resolve, reject) => {
			db.findOne({ id: u.id }, { projection: { _id: 0, xp: 1, username: 1, lvl: 1, rank: 1 } }).then(user => {
				if (user == null) {
					reject(new Error("User don't exist in mongo"));
				}
				all.log("levels", "level", user.lvl, "passé par", user.username);
				let image = new GenerateImage.LevelPass(u.displayAvatarURL({ format: "png" }), user.xp, user.username, u.discriminator, user.lvl, user.rank, () => {
					let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
					mess.channel.send(message);
					resolve(null);
				});
			});
		});
	};

	all.send_xp_of = (mess: Discord.Message) => {
		return new Promise((resolve, reject) => {
			let mentions = mess.mentions.users.array().map(mention => mention.id);
			db.find({ id: { $in: mentions } }, { projection: { _id: 0, id: 1, username: 1, xp: 1, lvl: 1, rank: 1 } })
				.toArray()
				.then(result => {
					if (result == null) {
						reject(new Error("Utilisateur introuvable"));
					}
					result.forEach((user, i) => {
						let image = new GenerateImage.XpStatus(
							mess.mentions.users.array()[i].displayAvatarURL({ format: "png" }),
							user.xp,
							user.username,
							mess.mentions.users.array()[i].discriminator,
							user.lvl,
							user.rank,
							() => {
								let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
								mess.channel.send(message);
							}
						);
					});
					resolve(null);
				})
				.catch(reason => reject(reason));
		});
	};

	all.xp_reset = async (mess: Discord.Message) => {
		return new Promise((resolve, reject) => {
			let mentions = mess.mentions.users.array().map(mention => mention.id);
			db.find({ id: { $in: mentions } }, { projection: { _id: 0, id: 1, username: 1, xp: 1, lvl: 1 } })
				.toArray()
				.then(result => {
					result.forEach(async (user, i) => {
						user.xp = 0;
						user.lvl = 0;
						await db.findOneAndUpdate({ id: user.id }, { $set: { xp: user.xp, lvl: user.lvl } });
						mess.channel.send(`L'xp de ${user.username} a été reset (pas de chance...)`);
					});
					resolve(null);
				})
				.catch(reason => reject(reason));
		});
	};

	all.download = async (mess: Discord.Message) => {
		let id = costa_utils.findYtbLink(mess.content);
		if (id == undefined) {
			mess.channel.send("Pas de lien detecté !");
			return;
		}
		let format = (() => {
			let match = mess.content.match(/(video)|(audio)/i);
			if (match === null) return "video";
			else return match[0];
		})();

		if (appConnection.dl(mess.author.id, id, format)) {
			mess.channel.send("Video en cours de telechargement dans l'application");
			mess.channel.send(`Ou par ce lien: ${config.server.url}download/?id=${id}&f=${format}`);
		} else {
			if (!config.server.active) {
				mess.channel.send("Erreur: Le serveur de telechargement n'est pas actif !");
				return;
			}
			mess.channel.send(`${config.server.url}download/?id=${id}&f=${format}`);
		}
	};

	all.spam = async (mess: Discord.Message) => {
		let x = setInterval(() => {
			mess.channel.send("ET C LE SPAM <@!" + mess.mentions.users.array()[0] + ">");
		}, 1000);
		setTimeout(() => {
			clearInterval(x);
		}, 1000 * 60 * 0.5);
	};

	all.createUser = async (user: Discord.User) => {
		return new Promise((resolve, reject) => {
			let newUser = {
				username: user.username,
				discriminator: user.discriminator,
				id: user.id,
				xp: 0,
				lvl: 0,
				lastMessage: null,
				rank: null,
				avatarUrl: user.displayAvatarURL({ format: "png" }),
			};
			db.insertOne(newUser)
				.then(() => resolve(newUser))
				.catch(reason => reject(reason));
		});
	};

	all.help_admin = (mess: Discord.Message) => {
		let message = new Discord.MessageEmbed().setTitle("Liste des commandes administrateurs").setDescription("").setColor("RED");

		commandes.forEach(commande => {
			if (!commande.masked && commande.access == "ADMINISTRATOR") {
				message.description += "**" + commande.name + "** : ";
				message.description += "    " + commande.description + "\n";
				message.description += "Utilisation: *" + config.keyWord + " " + commande.cmd + "*\n";
			}
		});
		mess.channel.send(message);
	};

	async function addXp(id: string, createdTimestamp: number, xp?: number) {
		return new Promise((resolve, reject) => {
			db.findOne({ id: id }, { projection: { _id: 0, xp: 1, lastMessage: 1 } }).then(user => {
				if (user == null) {
					reject(new Error("Utilisateur introuvable"));
					return;
				}
				let add = 0;
				let _xp = user.xp;
				if (user.lastMessage == null || createdTimestamp - user.lastMessage > config.antispamMs) {
					if (xp) {
						add = xp;
					} else {
						add = randomInt(config.xp.text.min, config.xp.text.max);
					}
					_xp += add;
					user.lastMessage = createdTimestamp != Infinity ? createdTimestamp : user.lastMessage;
				}
				db.findOneAndUpdate({ id: id }, { $set: { xp: _xp, lastMessage: user.lastMessage } })
					.then(() => resolve(add))
					.catch(reason => reject(reason));
			});
		});
	}

	all.add_xp = async (mess: Discord.Message) => {
		let mention = mess.mentions.users.array()[0];
		await addXp(mention.id, Infinity, parseInt(mess.content.split(" ")[4]));
		await updateUsers(mess);
		let user = await db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1, lvl: 1, rank: 1 } });
		mess.channel.send(`${mention.username} vient de gagner ${mess.content.split(" ")[4]}xp et est` + ` maintenant level ${user.lvl} avec ${user.xp}xp et rang ${user.rank}`);
	};

	all.set_xp = (mess: Discord.Message) => {
		let mention = mess.mentions.users.array()[0];
		db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1 } }).then(async user => {
			await db.findOneAndUpdate({ id: mention.id }, { $set: { lvl: 0 } });
			await addXp(mention.id, Infinity, parseInt(mess.content.split(" ")[4]) - user.xp);
			await updateUsers(mess, false);
			user = await db.findOne({ id: mention.id }, { projection: { _id: 0, xp: 1, lvl: 1, rank: 1 } });
			mess.channel.send(`${mention.username} a maintenant ${user.xp}xp et est maintenant level ${user.lvl} et rang ${user.rank}`);
		});
	};

	all.classement = async (mess: Discord.Message) => {
		await updateUsers(mess);
		db.find(
			{},
			{
				projection: {
					_id: 0,
					id: 1,
					username: 1,
					xp: 1,
					discriminator: 1,
					avatarUrl: 1,
					lvl: 1,
					rank: 1,
				},
			}
		)
			.toArray()
			.then((users: costa_utils.user[]) => {
				new GenerateImage.Classement(users, (image: GenerateImage.Classement) => {
					let message = new Discord.MessageAttachment(image.toBuffer("image/png"));
					mess.channel.send(message);
				});
			});
	};

	all.ta_gueule = (mess: Discord.Message) => {
		mess.channel.send("https://tenor.com/view/milk-and-mocha-cry-sad-tears-upset-gif-11667710");
	};

	all.random = (mess: Discord.Message) => {
		let match = mess.content.match(/[0-9]+/g);
		if (match === null) {
			mess.channel.send(randomInt(10));
			return;
		}
		let n1 = match[0];
		let n2 = match[1];
		if (n2) {
			if (parseInt(n1) >= parseInt(n2)) {
				mess.channel.send("Erreur: premier nombre plus grand que le deuxième");
				return;
			}
			mess.channel.send(randomInt(parseInt(n1), parseInt(n2)));
		} else {
			if (parseInt(n1) < 1) {
				mess.channel.send("Erreur: nombre trop petit");
				return;
			}
			mess.channel.send(randomInt(parseInt(n1)));
		}
	};

	all.qr = (mess: Discord.Message) => {
		let m = mess.content.slice(mess.content.indexOf(" ") - 1, mess.content.length).slice(mess.content.indexOf(" "), mess.content.length);
		QrCode.toBuffer(m, (err, result) => {
			if (err) {
				mess.channel.send("Erreur");
				return;
			}
			mess.channel.send(new Discord.MessageAttachment(result));
		});
	};

	all.avatar = (mess: Discord.Message) => {
		// var mess = new Discord.Message()
		let mentions = mess.mentions.users.array();
		let _size = mess.content.match(/\s[0-9]+/) || 128;
		let _format = mess.content.match(/png|gif|jpeg|jpg|webp/i) || "png";
		if (Array.isArray(_size)) var size = _size[0];
		else var size = (_size as unknown) as string;
		if (Array.isArray(_format)) var format = _format[0];
		else var format = (_format as unknown) as string;

		if (mentions.length == 0) {
			mess.channel.send(
				mess.author.displayAvatarURL({
					format: format as any,
					size: parseInt(size) as any,
				})
			);
		} else {
			mentions.forEach(mention => {
				mess.channel.send(
					mention.displayAvatarURL({
						format: format as any,
						size: parseInt(size) as any,
					})
				);
			});
		}
	};

	all.dl_minia = (mess: Discord.Message) => {
		let link = mess.content.match(/https?:\/\/www.youtube.com\/watch\?v=(\S+)/);
		mess.channel.send("http://img.youtube.com/vi/" + (link as RegExpMatchArray)[1] + "/maxresdefault.jpg");
	};

	all.music = (mess: Discord.Message) => {
		if (actualRadio) {
			mess.channel.send("Impossible de lancer la musique: radio en cours");
			return;
		}
		if (ActualMusicPlayer) ActualMusicPlayer.destroy();
		ActualMusicPlayer = new MusicPlayer(mess);
		ActualMusicPlayer.on("destroy", () => {
			(ActualMusicPlayer as any).removeAllListeners();
			ActualMusicPlayer = undefined;
		});
	};

	all.music_add = (mess: Discord.Message) => {
		if (!ActualMusicPlayer) {
			mess.channel.send("Erreur: Le lecteur de musique n'est pas actif");
			return;
		}
		if (ActualMusicPlayer.channel != mess.channel) {
			mess.channel.send("Erreur: Le lecteur de musique n'est pas dans ce channel");
			return;
		}
		let link = costa_utils.findYtbLink(mess.content);
		let list = costa_utils.findYtbPlaylistLink(mess.content);

		if (link) ActualMusicPlayer.add(link);
		else if (list) ActualMusicPlayer.add_playlist(list);
		else {
			let words: string[] = mess.content
				.slice(mess.content.lastIndexOf("add search") + "add search".length, mess.content.length)
				.split(" ")
				.filter(s => s != "" && !s.includes("--"));
			Youtube.search
				.list(
					mess.content.includes("--allCategories")
						? {
								part: ["id"],
								maxResults: 1,
								q: words.join(" "),
								type: ["video"],
						  }
						: {
								part: ["id"],
								maxResults: 1,
								q: words.join(" "),
								type: ["video"],
								videoCategoryId: "10",
						  }
				)
				.then(r => {
					try {
						ActualMusicPlayer?.add(`https://youtube.com/watch?v=${r.data.items?.[0].id?.videoId}`);
					} catch (e) {
						mess.channel.send("Aucune vidéo trouvée");
					}
				});
		}
	};

	all.music_resend = (mess: Discord.Message) => {
		if (ActualMusicPlayer) ActualMusicPlayer.resend(mess);
	};

	all.giveway = async (mess: Discord.Message) => {
		new Giveway(mess, db, addXp);
	};

	all.radio = (mess: Discord.Message) => {
		let match = mess.content.match(/https?:\/\/\S+/i) || "https://str2b.openstream.co/1369";
		if (Array.isArray(match)) var link = match[0];
		else var link = (match as unknown) as string;
		if (ActualMusicPlayer) {
			mess.channel.send("Impossible de lancer la radio: de la musique est déja en cours de lecture");
			return;
		}
		if (mess.guild?.member(mess.author)?.voice)
			if (mess.guild?.member(mess.author)?.voice.channel) {
				actualRadio = new Radio(link, mess.guild?.member(mess.author)?.voice.channel as any);
				actualRadio.connect().then(() => {
					(actualRadio as any).play();
				});
			} else mess.channel.send("Impossible de lancer la radio: pas dans un salon vocal");
		else mess.channel.send("Impossible de lancer la radio: pas dans un salon vocal");
	};

	all.radio_stop = (mess: Discord.Message) => {
		if (actualRadio) {
			actualRadio.stop();
			actualRadio = undefined;
		} else mess.channel.send("Pas de radio en cours");
	};

	all.startBot();
	if (config.server.active) server();

	setInterval(() => {
		bot.users.cache.forEach(user => {
			let member = bot.guilds.cache.array()[0].member(user.id);
			if (member)
				if (member.voice)
					if (member.voice.channel)
						if (member.voice.channelID != member.guild.afkChannelID)
							if (
								member.voice.channel.members.size > 1 &&
								!(
									member.voice.channel.members.size === 2 &&
									member.voice.channel.members.filter(m => m != member).array()[0].user.bot
								)
							)
								if (!member.voice.selfMute && !member.voice.serverMute && !member.voice.mute)
									if (!member.voice.selfDeaf && !member.voice.serverDeaf && !member.voice.deaf) {
										addXp(user.id, Infinity, randomInt(config.xp.voc.min, config.xp.voc.max));
									}
		});
	}, 10000);
	//ws
	if (config.interface.active) {
		let interfaceWss = new WebSocket.Server({ port: config.interface.port });
		interfaceWss.on("connection", ws => {
			logger.http("Connection au ws de l'interface");
			WS = ws;
			(ws as any).connected = false;
			ws.on("message", data => {
				let mess = JSON.parse(data.toString());
				if (!(ws as any).connected && mess.action != "connect") {
					logger.http(`Connection non autorisé depuis ${ws.url}`);
					ws.close(403, "Unauthorized");
					return;
				}
				switch (mess.action) {
					case "connect":
						if (!(ws as any).connected) {
							if ((ws as any).authorized(mess)) {
								(ws as any).interval = setInterval(async () => {
									ws.send(
										JSON.stringify({
											action: "refresh",
											perf: {
												cpu_usage: await os_utils.cpu.usage(),
												mem: await os_utils.mem.info(),
											},
											discord_infos: {
												channels: Process_info.discordChannels(bot),
												version: Process_info.discordVersion(),
												users: Process_info.discordUsers(bot),
											},
										})
									);
								}, 1000);
								ws.send(JSON.stringify({ action: "connect", uptime: bot.uptime }));
								ws.send(
									JSON.stringify({
										action: "logs",
										logs: logs,
									})
								);

								(ws as any).connected = true;
							} else ws.close(4003);
						}
						break;
					case "func":
						all[mess.func]();
						break;
					case "log":
						all.log("all", mess.data);
						break;
					default:
						break;
				}
			});

			ws.on("close", (code, reason) => {
				(ws as any).connected = false;
				clearInterval((ws as any).interval);
			});

			(ws as any).authorized = (mess: any) => {
				return mess.token == config.interface.token;
			};
		});
	}

	//api
	if (config.api.active) {
		const app = express();
		app.listen(config.api.port);
		app.all("*", (req, res, next) => {
			logger.http(`Request to api at ${req.url} from ${req.ip}`);
			next();
		});

		//GET
		app.get("/musics/infos/all", (req, res) => {
			if (ActualMusicPlayer) res.status(200).json(ActualMusicPlayer.getAllInfos());
			else res.status(200).json({ Error: "No music player" });
		});
		app.get("/musics/historic/infos/all", (req, res) => {
			if (ActualMusicPlayer) res.status(200).json(ActualMusicPlayer.getAllHistoricInfos());
			else res.status(200).json({ Error: "No music player" });
		});
		app.get("/musics/all/infos/all", (req, res) => {
			if (ActualMusicPlayer) res.status(200).json(ActualMusicPlayer.getAllHistoricInfos().concat(ActualMusicPlayer.getAllInfos() as any));
			else res.status(200).json({ Error: "No music player" });
		});
		app.get("/musics/infos", (req, res) => {
			if (ActualMusicPlayer) res.status(200).json(ActualMusicPlayer.getInfos());
			else res.status(400).json({ Error: "No music player" });
		});
		app.get("/musics/historic/infos", (req, res) => {
			if (ActualMusicPlayer) res.status(200).json(ActualMusicPlayer.getHistoricInfos());
			else res.status(400).json({ Error: "No music player" });
		});
		app.get("/musics/all/infos", (req, res) => {
			if (ActualMusicPlayer) res.status(200).json(ActualMusicPlayer.getHistoricInfos().concat(ActualMusicPlayer.getInfos() as any));
			else res.status(400).json({ Error: "No music player" });
		});

		app.get("/radio", (req, res) => {
			if (actualRadio) res.status(200).json({ link: actualRadio.url.toString() });
			else res.status(400).json({ Error: "No radio playing" });
		});

		//POST
		app.use(express.json());
		app.post("/music/send", (req, res) => {
			let textChannel = req.body.textChannel || config.api.music.defaultTextChannel;
			let voiceChannel = req.body.voiceChannel || config.api.music.defaultVoiceChannel;
			let link = req.body.link || "";
			try {
				if (req.body.autoconnect == "true" || req.body.autoconnect == true) {
					if (actualRadio) {
						res.status(500).end("Cannot play music: radio in progress");
						return;
					}
					if (ActualMusicPlayer) ActualMusicPlayer.destroy();
					ActualMusicPlayer = new MusicPlayer(bot.channels.cache.get(textChannel) as Discord.TextChannel, link, false).on("end", () => {
						(ActualMusicPlayer as any).send().then(() => {
							(ActualMusicPlayer as any).connect(bot.channels.cache.get(voiceChannel) as Discord.VoiceChannel);
						});
					});
					ActualMusicPlayer.on("destroy", () => {
						(ActualMusicPlayer as any).removeAllListeners();
						ActualMusicPlayer = undefined;
					});
				} else {
					if (actualRadio) {
						res.status(500).end("Cannot play music: radio in progress");
						return;
					}
					if (ActualMusicPlayer) ActualMusicPlayer.destroy();
					ActualMusicPlayer = new MusicPlayer(bot.channels.cache.get(textChannel) as Discord.TextChannel, link, true);
					ActualMusicPlayer.on("destroy", () => {
						(ActualMusicPlayer as any).removeAllListeners();
						ActualMusicPlayer = undefined;
					});
				}
				res.status(200).end();
			} catch (e) {
				logger.error(e);
				res.status(500).end(e.message);
			}
		});
		app.post("/music/connect", (req, res) => {
			let voiceChannel = req.body.voiceChannel || config.api.music.defaultVoiceChannel;
			if (ActualMusicPlayer) {
				ActualMusicPlayer.connect(bot.channels.cache.get(voiceChannel) as Discord.VoiceChannel)
					.then(() => {
						res.status(200).end();
					})
					.catch(r => {
						res.status(500).end(r.message);
					});
			} else res.status(400).json({ Error: "No music player" });
		});
		app.post("/music/disconnect", (req, res) => {
			if (ActualMusicPlayer) {
				if (ActualMusicPlayer.dispatcher) ActualMusicPlayer.pause();
				if (ActualMusicPlayer.connection) {
					ActualMusicPlayer.connection.disconnect();
					res.status(200).end();
				} else res.status(400).json({ Error: "Costa isn't connected" });
			} else res.status(400).json({ Error: "No music player" });
		});
		app.post("/music/stop", (req, res) => {
			if (ActualMusicPlayer)
				try {
					ActualMusicPlayer.destroy();
					res.status(200).end();
				} catch (e) {
					res.status(400).json(e);
				}
			else res.status(400).json({ Error: "No music player" });
		});
		app.post("/music/skip", (req, res) => {
			if (ActualMusicPlayer)
				try {
					ActualMusicPlayer.skip();
					res.status(200).end();
				} catch (e) {
					res.status(400).json(e);
				}
			else res.status(400).json({ Error: "No music player" });
		});
		app.post("/music/previous", (req, res) => {
			if (ActualMusicPlayer) ActualMusicPlayer.retour();
			else res.status(400).json({ Error: "No music player" });
		});
		app.post("/music/play", (req, res) => {
			if (ActualMusicPlayer)
				try {
					ActualMusicPlayer.play(true);
					res.status(200).end();
				} catch (e) {
					res.status(400).json(e);
				}
			else res.status(400).json({ Error: "No music player" });
		});
		app.post("/music/add", (req, res) => {
			if (ActualMusicPlayer)
				if (req.body.link)
					try {
						ActualMusicPlayer.add(req.body.link);
						res.status(200).end();
					} catch (e) {
						res.status(400).json(e);
					}
				else res.status(400).json({ Error: "Any link specified" });
			else res.status(400).json({ Error: "No music player" });
		});

		app.post("/radio/stop", (req, res) => {
			if (actualRadio) {
				actualRadio.stop();
				actualRadio = undefined;
				res.status(200).end();
			} else res.status(400).json({ Error: "No radio playing" });
		});

		app.post("/radio", (req, res) => {
			let link = req.body.link || "https://str2b.openstream.co/1369";
			let channel = bot.channels.cache.get(req.body.channel) || (bot.channels.cache.get(config.api.music.defaultVoiceChannel) as Discord.Channel);
			let force = req.body.force === "true" || req.body.force === true;

			if (force && ActualMusicPlayer) ActualMusicPlayer.destroy();
			if (ActualMusicPlayer) {
				res.status(400).json({ Error: "Unable to play radio: music already connected" });
				return;
			}
			if (channel instanceof Discord.VoiceChannel) {
				actualRadio = new Radio(link, channel);
				actualRadio.connect().then(() => {
					(actualRadio as any).play();
					res.status(200).json({ link: link });
				});
			} else res.status(400).json({ Error: "Invalid channel" });
		});

		app.all("*", (req, res) => {
			res.status(404).end();
		});
	}
})();
