import Discord from "discord.js";
import ytdl from "ytdl-core";
import { scrapePlaylist } from "youtube-playlist-scraper";
import { getUrlfromText } from "tts-googlehome";
import { EventEmitter } from "events";
import * as costa_utils from "./utils";
import * as logger from "./logger";

export default class Player extends EventEmitter {
	queue: Music[] = [];
	historique: Music[] = [];
	playing: boolean = false;
	volume: number = 1;
	actualMusic: Music | undefined;
	channel: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel;
	dispatcher: Discord.StreamDispatcher | undefined;
	connection: Discord.VoiceConnection | undefined;

	private message: Discord.MessageEmbed | undefined;
	private messContent: string;
	private sentMess: Discord.Message | undefined;
	private m_loop = false;

	constructor(mess: Discord.Message | Discord.TextChannel, messContent = "", send = true) {
		super();
		if (!("channel" in mess)) {
			this.channel = mess;
			this.messContent = messContent;
		} else {
			this.channel = mess.channel;
			this.messContent = mess.content;
		}

		let link = costa_utils.findYtbLink(this.messContent, { return: "link" });
		let list = costa_utils.findYtbPlaylistLink(this.messContent);

		if (link) {
			new Music(link).getInfo().then(music => {
				this.queue = [music];
				if (send) this.send().then(() => this.emit("end"));
				else this.emit("end");
			});
		} else if (list) {
			scrapePlaylist(list).then(async result => {
				// logger.log(result);
				await new Promise<void>((resolve, reject) => {
					result.playlist.forEach(async (r, i) => {
						//@ts-ignore
						let music = await new Music(r.url).getInfo();
						this.queue.push(music);
						if (i === result.playlist.length - 1) resolve();
					});
				});

				if (send) this.send().then(() => this.emit("end"));
				else this.emit("end");
			});
		} else if (send) this.send().then(() => this.emit("end"));
		else this.emit("end");
	}
	send() {
		return new Promise<void>(async (resolve, reject) => {
			if (this.queue[0])
				this.message = new Discord.MessageEmbed()
					.setTitle("En attente...")
					.setDescription(this.queue[0].title)
					.addField("De:", this.queue[0].author?.name)
					.setThumbnail(this.queue[0].minia as string)
					.setFooter(`Durée: ${this.queue[0].length?.minutes}:${this.queue[0].length?.secondes}`);
			else this.message = new Discord.MessageEmbed().setTitle("Aucune musique en lecture").setDescription("");
			this.sentMess = await this.channel.send(this.message);
			Promise.all([
				this.sentMess.react("⏪"),
				this.sentMess.react("▶️"),
				this.sentMess.react("⏯️"),
				this.sentMess.react("⏹️"),
				this.sentMess.react("⏩"),
				this.sentMess.react("➕"),
				this.sentMess.react("🔉"),
				this.sentMess.react("🔊"),
			]);
			let collector = this.sentMess.createReactionCollector(() => true);
			collector.on("collect", (reaction, user) => {
				if (reaction.me) return;
				reaction.users.remove(user);

				switch (reaction.emoji.name) {
					case "➕":
						if (this.sentMess?.guild?.member(user.id))
							if (this.sentMess?.guild?.member(user.id)?.voice.channel) this.connect(this.sentMess?.guild?.member(user.id)?.voice.channel as Discord.VoiceChannel);
							else this.channel.send("Pas dans un salon vocal");
						else this.channel.send("Erreur membre inexistant");
						break;

					case "⏯️":
						this.playing = !this.playing;
						if (this.playing) this.resume();
						else this.pause();
						break;

					case "▶️":
						this.play();
						break;

					case "⏹️":
						this.destroy();
						break;

					case "⏩":
						this.skip();
						break;

					case "⏪":
						this.retour();
						break;

					case "🔉":
						if (this.volume < 0.2) {
							this.dispatcher?.setVolume(0);
						} else this.dispatcher?.setVolume(this.volume - 0.2);
						this.volume = this.dispatcher?.volume as number;
						// logger.log(this.dispatcher.volume);
						break;

					case "🔊":
						if (this.volume > 1.8) {
							this.dispatcher?.setVolume(2);
						} else this.dispatcher?.setVolume(this.volume + 0.2);
						this.volume = this.dispatcher?.volume as number;
						// logger.log(this.dispatcher.volume);
						break;
					default:
						break;
				}
			});
			collector.on("end", () => {});
			resolve();
		});
	}
	connect(channel: Discord.VoiceChannel) {
		return new Promise<void>((resolve, reject) => {
			channel
				.join()
				.catch(reason => {
					logger.error(reason);
					this.channel.send("Erreur");
					reject(reason);
				})
				.then(connection => {
					//@ts-ignore
					this.connection = connection;
					resolve();
				});
		});
	}
	add(link: string, api = false) {
		new Music(link).getInfo().then(music => {
			this.queue.push(music);
			this.updatePlayer();
			if (!api) this.channel.send(`${music.title} a été ajouté à la liste de lecture en position ${this.queue.length} !`);
		});
	}
	add_playlist(list_id: string) {
		scrapePlaylist(list_id).then(async result => {
			await new Promise<void>((resolve, reject) => {
				result.playlist.forEach(async (r, i) => {
					//@ts-ignore
					let music = await new Music(r.url).getInfo();
					this.queue.push(music);
					if (i == result.playlist.length - 1) resolve();
				});
			});
			this.channel.send(`La playlist ${result.title} a été ajouté à la liste de lecture`);
		});
	}
	play(api = false) {
		if (this.queue.length == 0) {
			if (api) throw { Error: "No playable music" };
			let url = getUrlfromText("Pas de musique en file d'attente, c'est triste...", "fr-FR");
			if (this.connection) {
				this.dispatcher?.setVolume(30);
				this.connection.play(url);
				this.dispatcher?.setVolume(this.volume);
			}
			return;
		}
		if (this.actualMusic) {
			if (api) throw { Error: "Music already playing" };
			this.channel.send("Et non...");
			return;
		}
		this.playing = true;
		this.actualMusic = this.queue.shift();
		this.message = new Discord.MessageEmbed()
			.setTitle("Lecture en cours")
			.setDescription(this.actualMusic?.title)
			.addField("De:", this.actualMusic?.author?.name)
			.setThumbnail(this.actualMusic?.minia as string)
			.setFooter(`Durée: ${this.actualMusic?.length?.minutes}:${this.actualMusic?.length?.secondes}`);
		this.sentMess?.edit(this.message);
		try {
			this.dispatcher = this.connection?.play(
				//@ts-ignore
				ytdl(this.actualMusic.link as string, { filter: "audioonly" })
			);
			this.dispatcher?.setVolume(this.volume || 1);
		} catch (e) {
			this.playing = false;
			this.queue.unshift(this.actualMusic as Music);
			this.actualMusic = undefined;
			if (api) throw e;
			logger.error(e);
			this.channel.send("Erreur");
			return;
		}
		this.dispatcher?.on("finish", () => {
			this.playing = false;
			this.historique.push(this.actualMusic as Music);
			this.actualMusic = undefined;
			this.play();
		});
	}
	destroy() {
		if (this.connection) if (typeof this.connection.disconnect == "function") this.connection.disconnect();
		if (this.sentMess)
			if (this.sentMess.deletable) this.sentMess.delete();
			else logger.error("Error to delete music player");
		this.queue = [];
		this.historique = [];
		this.sentMess = undefined;
		this.message = undefined;
		this.volume = 0;
		this.playing = false;
		this.emit("destroy");
	}
	resume() {
		this.dispatcher?.resume();
	}
	pause() {
		this.dispatcher?.pause();
	}
	skip() {
		if (this.dispatcher) this.dispatcher.emit("finish");
	}
	retour() {
		this.queue.unshift(this.actualMusic as Music);
		this.actualMusic = undefined;
		this.queue.unshift(this.historique.pop() as Music);
		this.play();
	}
	resend(mess: Discord.Message | Discord.TextChannel) {
		if (mess instanceof Discord.Message) this.channel = mess.channel;
		else if (mess instanceof Discord.TextChannel) this.channel = mess;
		if (this.sentMess)
			if (this.sentMess.deletable) this.sentMess.delete();
			else logger.error("Error to delete music player");
		this.send();
	}
	updatePlayer(api = false) {
		if (this.actualMusic)
			this.message = new Discord.MessageEmbed()
				.setDescription(this.actualMusic.title)
				.addField("De:", this.actualMusic.author?.name)
				.setThumbnail(this.actualMusic.minia as string)
				.setFooter(`Durée: ${this.actualMusic.length?.minutes}:${this.actualMusic.length?.secondes}`);
		else if (this.sentMess) this.sentMess.edit(this.message as Discord.MessageEmbed);
	}
	getInfos() {
		if (this.playing) {
			return [this.actualMusic].concat(this.queue).map(m => {
				return {
					title: (m as Music).title,
					author: (m as Music).author,
					minia: (m as Music).minia,
					length: (m as Music).length,
					link: (m as Music).link,
				};
			});
		} else if (this.queue == ("dqjgbsd" as any)) {
			return this.queue.map(m => {
				return {
					title: m.title,
					author: m.author,
					minia: m.minia,
					length: m.length,
					link: m.link,
				};
			});
		} else throw new costa_utils.apiError("No music playing");
	}
	getAllInfos() {
		if (this.playing) {
			return [this.actualMusic].concat(this.queue).map(m => (m as Music).info);
		} else if (this.queue != []) {
			return this.queue.map(m => m.info);
		} else
			return {
				Error: "No musique playing",
			};
	}
	getAllHistoricInfos() {
		return this.historique.map(m => m.info);
	}
	getHistoricInfos() {
		return this.historique.map(m => {
			return {
				title: m.title,
				author: m.author,
				minia: m.minia,
				length: m.length,
				link: m.link,
			};
		});
	}
}

class Music {
	link: string;
	info: ytdl.videoInfo | undefined;
	title: string | undefined;
	author: ytdl.Author | undefined;
	minia: string | undefined;
	length: { minutes: number; secondes: number } | undefined;

	constructor(link: string) {
		this.link = link;
	}
	async getInfo(): Promise<Music> {
		return new Promise(async (resolve, reject) => {
			this.info = await ytdl.getBasicInfo(this.link);
			this.title = this.info.videoDetails.title;
			this.author = this.info.videoDetails.author;
			this.minia = "http://img.youtube.com/vi/" + this.info.videoDetails.videoId + "/0.jpg";
			let s = parseInt(this.info.videoDetails.lengthSeconds);
			this.length = {
				minutes: Math.floor(s / 60),
				secondes: s % 60,
			};
			resolve(this);
		});
	}
}
