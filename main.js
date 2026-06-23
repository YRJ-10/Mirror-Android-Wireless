const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;

// Paths to tools
const toolsPath = path.join(__dirname, 'tools', 'scrcpy');
const adbPath = path.join(toolsPath, 'adb.exe');
const scrcpyPath = path.join(toolsPath, 'scrcpy.exe');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    icon: path.join(__dirname, 'icon.ico')
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('run-command', async (event, args) => {
    const { type, ip, port, code } = args;
    const address = `${ip}:${port}`;

    return new Promise((resolve, reject) => {
        let child;
        
        if (type === 'pair') {
            child = spawn(adbPath, ['pair', address, code], { cwd: toolsPath });
        } else if (type === 'connect') {
            child = spawn(adbPath, ['connect', address], { cwd: toolsPath });
        } else if (type === 'start') {
            const scrcpyArgs = [
                '--tcpip=' + address,
                '--turn-screen-off',
                '--stay-awake',
                '--video-bit-rate=2M', // Sangat rendah agar nyaris tidak ada beban di Wi-Fi
                '--max-size=800',      // Ukuran lebih kecil agar proses pengiriman instan
                '--video-codec=h265',  // Teknologi H.265: Gambar tetap tajam meskipun bitrate sangat kecil
                '--no-audio'           // Tetap tanpa suara
            ];
            child = spawn(scrcpyPath, scrcpyArgs, { cwd: toolsPath });
            resolve({ success: true, message: 'Scrcpy launched' });
            return;
        }

        let output = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (codeStatus) => {
            const outStr = output.toLowerCase();
            const errStr = errorOutput.toLowerCase();
            
            if (outStr.includes('cannot connect') || outStr.includes('failed') || errStr.includes('cannot connect') || errStr.includes('failed')) {
                 resolve({ success: false, message: output || errorOutput });
            } else if (codeStatus === 0 || outStr.includes('already connected') || outStr.includes('successfully connected') || outStr.includes('successfully paired')) {
                resolve({ success: true, message: output });
            } else {
                resolve({ success: false, message: errorOutput || output || `Process exited with code ${codeStatus}` });
            }
        });
    });
});
