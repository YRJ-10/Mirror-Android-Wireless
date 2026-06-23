const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let scrcpyProcess = null;

// Mengamankan path ADB dan SCRCPY (aman saat di-build atau via npm start)
const toolsPath = path.join(__dirname, 'tools', 'scrcpy');

const adbPath = path.join(toolsPath, 'adb.exe');
const scrcpyBinPath = path.join(toolsPath, 'scrcpy.exe');

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 600,
        resizable: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        autoHideMenuBar: true
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (scrcpyProcess) {
        scrcpyProcess.kill();
    }
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handler
ipcMain.handle('run-command', (event, type, ip, port, code) => {
    return new Promise((resolve) => {
        let output = '';

        if (type === 'pair') {
            const child = spawn(adbPath, ['pair', `${ip}:${port}`, code], { cwd: toolsPath });
            child.stdout.on('data', (data) => { output += data.toString(); });
            child.stderr.on('data', (data) => { output += data.toString(); });
            
            child.on('close', () => {
                if (output.toLowerCase().includes('success') || output.toLowerCase().includes('successfully')) {
                    resolve({ success: true, message: output });
                } else {
                    resolve({ success: false, message: output });
                }
            });
        } 
        else if (type === 'connect') {
            const child = spawn(adbPath, ['connect', `${ip}:${port}`], { cwd: toolsPath });
            child.stdout.on('data', (data) => { output += data.toString(); });
            child.stderr.on('data', (data) => { output += data.toString(); });
            
            child.on('close', () => {
                if (output.toLowerCase().includes('connected to') || output.toLowerCase().includes('already connected')) {
                    // Berhasil connect, jalankan scrcpy
                    if (scrcpyProcess) scrcpyProcess.kill();

                    scrcpyProcess = spawn(scrcpyBinPath, [
                        `--serial=${ip}:${port}`,
                        '--turn-screen-off',
                        '--stay-awake',
                        '--video-bit-rate=1M',
                        '--max-size=800',
                        '--video-codec=h265',
                        '--video-buffer=50',
                        '--no-audio'
                    ], { cwd: toolsPath });

                    let scrcpyErr = '';
                    scrcpyProcess.stderr.on('data', (data) => {
                        scrcpyErr += data.toString();
                    });

                    scrcpyProcess.on('close', (code) => {
                        scrcpyProcess = null;
                        if (mainWindow) {
                            mainWindow.webContents.send('scrcpy-closed', scrcpyErr);
                        }
                    });

                    resolve({ success: true, message: output });
                } else {
                    resolve({ success: false, message: output });
                }
            });
        }
        else if (type === 'stop') {
            if (scrcpyProcess) {
                scrcpyProcess.kill();
                scrcpyProcess = null;
            }
            resolve({ success: true });
        }
    });
});
