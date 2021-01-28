const config = require("./data/config.json")

const fs = require("fs");

const http = require("http");
const express = require("express");
const app = express();

http.createServer(app).listen(config.server.port);
console.log("Server started");

app.use((req, res, next) => {
    console.log(`Request ${req.method} at ${req.url} from ${req.ip}`);
    next();
});

app.get("/download/*", (req, res) => {
    fs.readFile(__dirname + "/download/name/" + req.url.slice(10, req.url.length - 4), (err, data) => {
        if (err){
            console.log(err);
            res.status(500).end();
            return;
        }
        res.sendFile(__dirname + "/download/" + req.url.slice(10, req.url.length), (err) => {
            res.end();
            // console.log("send file");
        });
    });
});


app.use((req, res) => {
    res.write("Cette page n'existe pas (encore)");
    res.status(404).end();
});