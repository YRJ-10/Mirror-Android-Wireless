const { ipcRenderer } = require('electron');

// UI Elements
const tabConnect = document.getElementById('tab-connect');
const tabPair = document.getElementById('tab-pair');
const sectionConnect = document.getElementById('section-connect');
const sectionPair = document.getElementById('section-pair');

const btnStart = document.getElementById('btn-start');
const btnPair = document.getElementById('btn-pair');

// Inputs
const connIp = document.getElementById('conn-ip');
const connPort = document.getElementById('conn-port');
const pairIp = document.getElementById('pair-ip');
const pairPort = document.getElementById('pair-port');
const pairCode = document.getElementById('pair-code');

// Status
const connStatus = document.getElementById('connect-status');
const pairStatus = document.getElementById('pair-status');

// Load saved data
window.onload = () => {
    const savedIp = localStorage.getItem('lastIp') || '';
    const savedConnPort = localStorage.getItem('lastConnPort') || '5555';
    
    connIp.value = savedIp;
    pairIp.value = savedIp;
    connPort.value = savedConnPort;
};

// Tab Switching
tabConnect.addEventListener('click', () => {
    tabConnect.classList.add('active');
    tabPair.classList.remove('active');
    sectionConnect.style.display = 'block';
    sectionPair.style.display = 'none';
});

tabPair.addEventListener('click', () => {
    tabPair.classList.add('active');
    tabConnect.classList.remove('active');
    sectionPair.style.display = 'block';
    sectionConnect.style.display = 'none';
    
    // Sync IP if changed
    pairIp.value = connIp.value;
});

function showStatus(element, type, message) {
    element.className = `status-msg ${type}`;
    element.innerText = message;
}

// Pair Button Logic
btnPair.addEventListener('click', async () => {
    const ip = pairIp.value.trim();
    const port = pairPort.value.trim();
    const code = pairCode.value.trim();

    if (!ip || !port || !code) {
        showStatus(pairStatus, 'error', 'Please fill all fields');
        return;
    }

    showStatus(pairStatus, 'loading', 'Pairing in progress...');
    btnPair.disabled = true;

    try {
        const result = await ipcRenderer.invoke('run-command', {
            type: 'pair', ip, port, code
        });

        if (result.success && result.message.toLowerCase().includes('successfully paired')) {
            showStatus(pairStatus, 'success', 'Successfully paired! You can now switch to Connect tab.');
            localStorage.setItem('lastIp', ip);
            connIp.value = ip;
        } else {
            showStatus(pairStatus, 'error', result.message || 'Pairing failed. Check IP/Port/Code.');
        }
    } catch (err) {
        showStatus(pairStatus, 'error', 'Error: ' + err.message);
    } finally {
        btnPair.disabled = false;
    }
});

// Start Mirroring Logic
btnStart.addEventListener('click', async () => {
    const ip = connIp.value.trim();
    const port = connPort.value.trim() || '5555';

    if (!ip) {
        showStatus(connStatus, 'error', 'IP Address is required');
        return;
    }

    showStatus(connStatus, 'loading', 'Connecting...');
    btnStart.disabled = true;

    try {
        // First connect
        const connResult = await ipcRenderer.invoke('run-command', {
            type: 'connect', ip, port
        });

        if (connResult.success || connResult.message.includes('already connected')) {
            showStatus(connStatus, 'loading', 'Launching Scrcpy...');
            localStorage.setItem('lastIp', ip);
            localStorage.setItem('lastConnPort', port);

            const startResult = await ipcRenderer.invoke('run-command', {
                type: 'start', ip, port
            });

            if (startResult.success) {
                showStatus(connStatus, 'success', 'Mirroring started!');
                setTimeout(() => {
                    connStatus.style.display = 'none';
                }, 3000);
            } else {
                showStatus(connStatus, 'error', 'Failed to start scrcpy: ' + startResult.message);
            }
        } else {
             showStatus(connStatus, 'error', 'Connection failed: ' + connResult.message);
        }
    } catch (err) {
        showStatus(connStatus, 'error', 'Error: ' + err.message);
    } finally {
        btnStart.disabled = false;
    }
});
