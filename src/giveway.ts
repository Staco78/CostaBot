import Discord from "discord.js";
import mongoDb from "mongodb";
import { randomInt } from "crypto";

import { user } from "./utils";

export default class Giveway {
  private mess: Discord.Message;
  private db: mongoDb.Collection;
  private users: user[] | undefined;
  private nWinner: number = 1;
  private addXp: any;
  private xp: number = 100;

  constructor(mess: Discord.Message, db: mongoDb.Collection, addXp: any) {
    this.addXp = addXp;
    this.mess = mess;
    this.db = db;
    let match = mess.content.match(/[0-9]+/g);
    if (match) {
      this.xp = parseInt(match[0]);
      if (match[1]) this.nWinner = parseInt(match[1]);
    }
    this.start();
  }
  async start() {
    this.users = await this.db
      .find({}, { projection: { _id: 0, id: 1, username: 1 } })
      .toArray();
    let numbers: number[] = [];

    for (let i = 0; i < this.nWinner; i++)
      numbers.push(randomInt(this.users.length));

    if (numbers.length > this.users.length) {
      this.mess.channel.send(
        "Plus de gagnants que de personnes sur le serveur"
      );
      return;
    }

    let winners: user[] = [];
    numbers.forEach((n) => {
      winners.push((this.users as user[])[n]);
      this.users?.splice(n, 1);
    });
    this.mess.channel.send(
      `Le(s) gagnant(s) sont ${winners.map((w) => `<@!${w.id}>`).join(" ")}`
    );
    winners.forEach((w) => {
      this.addXp(w.id, Infinity, this.xp);
    });
  }
}
