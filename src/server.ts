import express from "express";
import ytdl from "ytdl-core";

import { server } from "./data/config.json";
import sanitize from "sanitize-filename";
import * as logger from "./logger";

import {join as pathJoin} from "path";


const ytbVideoLink = "https://youtube.com/watch?v=";

const app = express();

app.all("*", (req, res, next) => {
  logger.http(`Request at ${req.url} from ${req.ip}`);
  next();
});
app.use(express.static(server.public, { extensions: ["html"]}));

// app.get("/", (req, res) => {
//   res.sendFile("./public/index.html", { root: server.root });
// });

app.get("/apidoc", (req, res) => {
  res.status(200).sendFile("./api doc.txt", {
    root: server.root,
  });
});

app.get("/download", async (req, res) => {
  let id = req.query.id;
  if (typeof id != "string") {
    res.status(400).end("No video id found");
    return;
  }
  let format = req.query.f;
  if (typeof format != "string") {
    res.status(400).end("No format found");
    return;
  }

  let title = (await ytdl.getBasicInfo(ytbVideoLink + id)).videoDetails.title;

  if (format == "audio") {
    res.header(
      "Content-Disposition",
      'attachment; filename="' + encodeURIComponent(sanitize(title)) + '.mp4"'
    );
    ytdl(ytbVideoLink + id, {
      filter: "audioonly",
      quality: "highestaudio",
    }).pipe(res);
  } else if (format == "video") {
    res.header(
      "Content-Disposition",
      'attachment; filename="' + encodeURIComponent(sanitize(title)) + '.mp4"'
    );
    ytdl(ytbVideoLink + id, {
      filter: "videoandaudio",
      quality: "highestvideo",
    }).pipe(res);
  } else res.status(400).end("Unknown format");
});

app.get("*", (req, res) => {
  res.status(404).sendFile("./public/404.html", { root: pathJoin(__dirname, "..")});
});

export default function start(port?: number) {
  app.listen(port || server.port);
  logger.log("server started at port", port || server.port);
}


if (process.argv.includes("--autorun"))
  start();
