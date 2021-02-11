const { QMainWindow, QPushButton, QBoxLayout, QWidget, Direction, QLabel, QTabWidget, QIcon, QTextEdit, QComboBox } = require("@nodegui/nodegui");

const config = require("./data/config.json");

const WebSocket = require("ws");

let ws = new WebSocket("ws://localhost:" + config.interface.port);
console.log("Connection...");
ws.onopen = () => {
    console.log("Authorisation en cours...");
    ws.send(JSON.stringify({ action: "connect", token: config.interface.token }));
}

//variables globales
let logsAll = "";
let logsMessages = "";
let logsCommands = "";
let logsLevels = "";


let win = new QMainWindow();
win.setFixedSize(400, 300);
win.setWindowTitle("CostaBot v" + process.env.npm_package_version);
let centralWidget = new QWidget(win);
win.setCentralWidget(centralWidget);
let layoutAll = new QBoxLayout(Direction.TopToBottom, centralWidget);

//page 1
let page1_widgetAll = new QWidget();
let page1_button = new QPushButton();
page1_button.setText("Chargement...");
let page1_label = new QLabel();
page1_label.setText("Bot éteint");
let page1_layout = new QBoxLayout(Direction.TopToBottom, page1_widgetAll);
page1_layout.addWidget(page1_button);
page1_layout.addWidget(page1_label);

//page 2
let page2_widgetAll = new QWidget();
let page2_comboBox = new QComboBox()
page2_comboBox.addItem(new QIcon(), "Tous les logs");
page2_comboBox.addItem(new QIcon(), "Seulement les messages envoyés");
page2_comboBox.addItem(new QIcon(), "Seulement les commandes utilisés");
page2_comboBox.addItem(new QIcon(), "Seulement les niveaux passés");
let page2_textArea = new QTextEdit();
page2_textArea.setReadOnly(true);
let page2_layout = new QBoxLayout(Direction.TopToBottom, page2_widgetAll)
page2_layout.addWidget(page2_comboBox);
page2_layout.addWidget(page2_textArea);

//tab
let tab = new QTabWidget(centralWidget);
tab.addTab(page1_widgetAll, new QIcon(), "Accueil");
tab.addTab(page2_widgetAll, new QIcon(), "Logs");



layoutAll.addWidget(tab);


// events
page1_button.addEventListener("clicked", () => {
    let send = {
        action: "func"
    }
    if (page1_button.text() == "Start") {
        send.func = "startBot";
        page1_button.setText("Stop");

    }
    else {
        send.func = "stopBot";
        page1_button.setText("Start");

    }
    ws.send(JSON.stringify(send));
});


//message
ws.onmessage = (message) => {
    message = JSON.parse(message.data);
    // console.log(message);
    switch (message.action) {

        case "connect":
            console.log("Authorisation reussi");
            if (message.uptime == "null") {
                page1_button.setText("Start");
                page1_label.setText("Bot éteint");
            }
            else {
                page1_button.setText("Stop");
                let startedSince = new Date(Date.now() - message.uptime);
                page1_label.setText("Bot allumé le " + startedSince.toLocaleDateString() + " à " + startedSince.toLocaleTimeString());
            }
            win.show();
            break;
        case "logs":
            message.logs.forEach(m => {
                logsAll += m.data + "\n";
                if (m.type == "message") {
                    logsMessages += m.data + "\n";
                }
                if (m.type == "levels") {
                    logsLevels += m.data + "\n";
                }
                if (m.type == "command") {
                    logsCommands += m.data + "\n";
                }
            });
            page2_textArea_changeText();
            break;
        case "addLog":
            logsAll += message.data + "\n";
            if (message.type == "message") {
                logsMessages += message.data + "\n";
            }
            if (message.type == "levels") {
                logsLevels += message.data + "\n";
            }
            if (message.type == "command") {
                logsCommands += message.data + "\n";
            }
            page2_textArea_changeText();
            break;
        default:
            break;
    }
};

ws.on("close", (code, reason) => {
    switch (code) {
        case 403:
            console.log("Authorisation echoue !");
            break;
        default:
            console.log(`Ws ferme avec le code ${code} ! Raison: ${reason}`);
    }
});

page2_comboBox.addEventListener("currentTextChanged", () => {
    page2_textArea_changeText();
});

function page2_textArea_changeText() {
    if (page2_comboBox.currentText() == "Tous les logs") {
        page2_textArea.setText(logsAll);
    }
    else if (page2_comboBox.currentText() == "Seulement les commandes utilisés") {
        page2_textArea.setText(logsCommands);
    }
    else if (page2_comboBox.currentText() == "Seulement les niveaux passés") {
        page2_textArea.setText(logsLevels);
    }
    else if (page2_comboBox.currentText() == "Seulement les messages envoyés") {
        page2_textArea.setText(logsMessages);
    }
}

global.win = win;