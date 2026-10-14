// App do ColorAttack (Electron): abre o jogo numa janela própria, sem precisar de servidor nem de navegador.
// Os ficheiros do jogo são servidos pelo endereço app://jogo/ (os módulos JS e os mapas .glb não carregam por file://).
const { app, BrowserWindow, protocol, net, Menu, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");                                    // pasta do jogo (index.html, src, assets, vendor)
protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

app.whenReady().then(() => {
  protocol.handle("app", (req) => {
    const file = path.normalize(path.join(ROOT, decodeURIComponent(new URL(req.url).pathname)));
    if (!file.startsWith(ROOT + path.sep)) return new Response("", { status: 403 });   // só ficheiros do jogo
    return net.fetch(pathToFileURL(file).toString());
  });
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 900, minHeight: 600, backgroundColor: "#0d0b1f", title: "ColorAttack", show: false,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },   // (a jogar com amigos o jogo não pode abrandar com a janela atrás de outra)
  });
  win.once("ready-to-show", () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });   // links abrem no navegador
  win.webContents.on("before-input-event", (e, input) => {                    // F11: ecrã inteiro
    if (input.type === "keyDown" && input.key === "F11") { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.loadURL("app://jogo/index.html");
});
app.on("window-all-closed", () => app.quit());
