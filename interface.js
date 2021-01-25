const { QMainWindow, QPushButton, QBoxLayout, QWidget, Direction, QLabel, QTabWidget, QIcon, FlexLayout, QTextEdit, QListView, QComboBox } = require("@nodegui/nodegui");

//variables globales
let logsAll = "";
let logsMessages = "";
let logsCommands = "";
let logsLevels = "";


let win = new QMainWindow();
win.resize(400, 300);
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
        process.send(JSON.stringify({ action: "log", data: "page1_button a stop" }));

    }
    else {
        send.func = "stopBot";
        page1_button.setText("Start");
        process.send(JSON.stringify({ action: "log", data: "page1_button a start" }));
    }
    // process.send(JSON.stringify(send));
    process.send(JSON.stringify({ action: "log", data: JSON.stringify(send) }));
});

process.on("message", (message) => {
    message = JSON.parse(message);
    if (message.action == "start") {
        if (message.uptime == "null") {
            page1_button.setText("Start");
            page1_label.setText("Bot éteint");
        }
        else {
            page1_button.setText("Stop");
            let startedSince = new Date(Date.now() - message.uptime);
            page1_label.setText("Bot allumé le " + startedSince.toLocaleDateString() + " à " + startedSince.toLocaleTimeString());
        }

    }
    else if (message.action == "addLog") {
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
    }
    win.show();
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