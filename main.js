const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow;
let scrcpyProcess = null;
let stoppingScrcpy = false;

// Mengamankan path ADB dan SCRCPY (aman saat di-build atau via npm start)
const toolsPath = path.join(__dirname, 'tools', 'scrcpy');

const adbPath = path.join(toolsPath, 'adb.exe');
const scrcpyBinPath = path.join(toolsPath, 'scrcpy.exe');

function runTool(command, args) {
    return new Promise((resolve) => {
        let output = '';
        const child = spawn(command, args, {
            cwd: toolsPath,
            windowsHide: true
        });

        child.stdout.on('data', (data) => { output += data.toString(); });
        child.stderr.on('data', (data) => { output += data.toString(); });
        child.on('error', (error) => {
            resolve({ code: -1, output: error.message });
        });
        child.on('close', (code) => {
            resolve({ code, output });
        });
    });
}

function stopScrcpy() {
    return new Promise((resolve) => {
        if (!scrcpyProcess) {
            resolve();
            return;
        }

        const processToStop = scrcpyProcess;
        stoppingScrcpy = true;
        const timeout = setTimeout(() => {
            stoppingScrcpy = false;
            if (scrcpyProcess === processToStop) {
                scrcpyProcess = null;
            }
            resolve();
        }, 1200);

        processToStop.once('close', () => {
            clearTimeout(timeout);
            stoppingScrcpy = false;
            if (scrcpyProcess === processToStop) {
                scrcpyProcess = null;
            }
            resolve();
        });

        processToStop.kill();
    });
}

function startScrcpy(serial) {
    return new Promise((resolve) => {
        const args = [
            `--serial=${serial}`,
            '--stay-awake',
            '--video-bit-rate=1M',
            '--max-size=800',
            '--video-codec=h264',
            '--video-buffer=50',
            '--no-audio'
        ];

        let scrcpyLog = '';
        let settled = false;

        scrcpyProcess = spawn(scrcpyBinPath, args, {
            cwd: toolsPath,
            windowsHide: false
        });

        const finish = (result) => {
            if (settled) return;
            settled = true;
            resolve(result);
        };

        scrcpyProcess.stdout.on('data', (data) => {
            scrcpyLog += data.toString();
        });

        scrcpyProcess.stderr.on('data', (data) => {
            scrcpyLog += data.toString();
        });

        scrcpyProcess.on('error', (error) => {
            scrcpyProcess = null;
            finish({ success: false, message: error.message });
        });

        scrcpyProcess.on('close', (code) => {
            scrcpyProcess = null;
            const message = scrcpyLog.trim() || `scrcpy keluar dengan kode ${code}`;

            if (!settled) {
                finish({ success: false, message });
                return;
            }

            if (!stoppingScrcpy && mainWindow) {
                mainWindow.webContents.send('scrcpy-closed', message);
            }
        });

        setTimeout(() => {
            if (scrcpyProcess && !scrcpyProcess.killed) {
                finish({ success: true, message: scrcpyLog });
            }
        }, 1800);
    });
}

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

app.on('window-all-closed', async () => {
    await stopScrcpy();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// IPC Handler
ipcMain.handle('run-command', async (event, type, ip, port, code) => {
    const serial = `${ip}:${port}`;

    if (type === 'pair') {
        const result = await runTool(adbPath, ['pair', serial, code]);
        const output = result.output.toLowerCase();

        if (output.includes('success') || output.includes('successfully')) {
            return { success: true, message: result.output };
        }

        return { success: false, message: result.output };
    }

    if (type === 'connect') {
        const result = await runTool(adbPath, ['connect', serial]);
        const output = result.output.toLowerCase();

        if (!output.includes('connected to') && !output.includes('already connected')) {
            return { success: false, message: result.output };
        }

        await stopScrcpy();

        const devices = await runTool(adbPath, ['devices']);
        if (!devices.output.includes(`${serial}\tdevice`)) {
            return {
                success: false,
                message: `${result.output}\n\nADB belum melihat ${serial} sebagai device siap.\n${devices.output}`
            };
        }

        const scrcpyResult = await startScrcpy(serial);
        if (!scrcpyResult.success) {
            return {
                success: false,
                message: `${result.output}\n\nscrcpy gagal start:\n${scrcpyResult.message}`
            };
        }

        return { success: true, message: result.output };
    }

    if (type === 'stop') {
        await stopScrcpy();
        return { success: true };
    }

    return { success: false, message: `Perintah tidak dikenal: ${type}` };
});
