const { ipcRenderer } = require('electron');

// UI Elements
const btnPair = document.getElementById('btn-pair');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const btnDeleteHistory = document.getElementById('btn-delete-history');
const btnClearHistory = document.getElementById('btn-clear-history');
const historySelect = document.getElementById('history-select');
const historyList = document.getElementById('history-list');
const historyEmpty = document.getElementById('history-empty');
const activeDeviceLabel = document.getElementById('active-device-label');
const appStatus = document.getElementById('app-status');
const pairStatus = document.getElementById('pair-status');
const connStatus = document.getElementById('conn-status');
const stepPair = document.getElementById('step-pair');
const stepConnect = document.getElementById('step-connect');
const stepMirror = document.getElementById('step-mirror');

function setAppStatus(text, type = '') {
    appStatus.className = `status-pill ${type}`.trim();
    appStatus.innerHTML = `<span class="status-dot"></span>${text}`;
}

function setSteps(activeStep) {
    const steps = [
        { el: stepPair, key: 'pair' },
        { el: stepConnect, key: 'connect' },
        { el: stepMirror, key: 'mirror' }
    ];
    const activeIndex = steps.findIndex(step => step.key === activeStep);

    steps.forEach((step, index) => {
        step.el.className = 'step';
        if (activeStep === 'mirror') {
            step.el.classList.add('done');
            return;
        }

        if (index < activeIndex) step.el.classList.add('done');
        if (index === activeIndex) step.el.classList.add('active');
    });
}

function parseHistoryDevice(device) {
    const ip = device.split(' ')[0];
    const portMatch = device.match(/Port Pairing:\s*([^)]+)/);

    return {
        ip,
        pairPort: portMatch ? portMatch[1] : '-'
    };
}

function selectHistoryDevice(device) {
    if (!device) return;

    const parsed = parseHistoryDevice(device);
    historySelect.value = device;
    activeDeviceLabel.innerText = `${parsed.ip} | Pair port ${parsed.pairPort}`;
    document.getElementById('pair-ip').value = parsed.ip;
    document.getElementById('conn-ip').value = parsed.ip;
    btnDeleteHistory.disabled = false;

    document.querySelectorAll('.device-card').forEach(card => {
        card.classList.toggle('active', card.dataset.device === device);
    });
}

// Pairing Action
btnPair.addEventListener('click', async () => {
    const ip = document.getElementById('pair-ip').value.trim();
    const port = document.getElementById('pair-port').value.trim();
    const code = document.getElementById('pair-code').value.trim();

    if (!ip || !port || !code) {
        pairStatus.className = 'status-msg error';
        pairStatus.innerText = 'Harap isi IP, Port, dan Code.';
        setAppStatus('Input missing', 'error');
        setSteps('pair');
        return;
    }

    localStorage.setItem('lastIp', ip);
    localStorage.setItem('lastPairPort', port);
    localStorage.setItem('lastPairCode', code);

    pairStatus.className = 'status-msg warning';
    pairStatus.innerText = 'Memulai pairing...';
    setAppStatus('Pairing...', 'warning');
    setSteps('pair');

    const result = await ipcRenderer.invoke('run-command', 'pair', ip, port, code);
    
    if (result.success) {
        pairStatus.className = 'status-msg success';
        pairStatus.innerText = 'Pairing sukses. Isi port utama untuk mirroring.';
        setAppStatus('Paired', 'success');
        setSteps('connect');
        
        let history = JSON.parse(localStorage.getItem('pairHistory') || '[]');
        const newDevice = `${ip} (Port Pairing: ${port})`;
        if (!history.includes(newDevice)) {
            history.push(newDevice);
            localStorage.setItem('pairHistory', JSON.stringify(history));
        }

        document.getElementById('conn-ip').value = ip;
        document.getElementById('conn-port').focus();
        loadHistory(newDevice);
    } else {
        pairStatus.className = 'status-msg error';
        pairStatus.innerText = `Gagal: ${result.message}`;
        setAppStatus('Pair failed', 'error');
        setSteps('pair');
    }
});

// Connection & Start Action
btnStart.addEventListener('click', async () => {
    const ip = document.getElementById('conn-ip').value.trim();
    const port = document.getElementById('conn-port').value.trim();

    if (!ip || !port) {
        connStatus.className = 'status-msg error';
        connStatus.innerText = 'Harap isi IP dan Port utama.';
        setAppStatus('Input missing', 'error');
        setSteps('connect');
        return;
    }

    localStorage.setItem('lastIp', ip);
    localStorage.setItem('lastConnPort', port);

    connStatus.className = 'status-msg warning';
    connStatus.innerText = 'Menghubungkan ADB dan membuka scrcpy...';
    setAppStatus('Connecting...', 'warning');
    setSteps('connect');

    const result = await ipcRenderer.invoke('run-command', 'connect', ip, port);

    if (result.success) {
        connStatus.className = 'status-msg success';
        connStatus.innerText = 'Berhasil terhubung. Jendela mirror dibuka.';
        setAppStatus('Mirroring', 'success');
        setSteps('mirror');
        btnStart.style.display = 'none';
        btnStop.style.display = 'flex';
    } else {
        connStatus.className = 'status-msg error';
        connStatus.innerText = `Koneksi gagal: ${result.message.substring(0, 220)}${result.message.length > 220 ? '...' : ''}`;
        setAppStatus('Connect failed', 'error');
        setSteps('connect');
        
        if (result.message.toLowerCase().includes('unauthorized') || 
            result.message.toLowerCase().includes('refused') || 
            result.message.toLowerCase().includes('offline')) {
            pairStatus.className = 'status-msg error';
            pairStatus.innerText = 'Pairing sudah tidak berlaku/ditolak. Wajib pairing ulang.';
        }
    }
});

// Stop Action
btnStop.addEventListener('click', async () => {
    await ipcRenderer.invoke('run-command', 'stop');
    btnStart.style.display = 'flex';
    btnStop.style.display = 'none';
    connStatus.className = 'status-msg';
    connStatus.innerText = 'Mirroring dihentikan.';
    setAppStatus('Ready', '');
    setSteps('connect');
});

// Listener for unexpected close
ipcRenderer.on('scrcpy-closed', (event, errStr) => {
    btnStart.style.display = 'flex';
    btnStop.style.display = 'none';
    connStatus.className = 'status-msg error';
    connStatus.innerText = errStr ? `Layar tertutup: ${errStr.substring(0, 220)}${errStr.length > 220 ? '...' : ''}` : 'Layar ditutup dari luar.';
    setAppStatus('Mirror closed', 'error');
    setSteps('connect');
});

// Load saved data
window.onload = () => {
    const savedIp = localStorage.getItem('lastIp');
    const savedPairPort = localStorage.getItem('lastPairPort');
    const savedPairCode = localStorage.getItem('lastPairCode');
    const savedConnPort = localStorage.getItem('lastConnPort');
    
    if (savedIp) {
        document.getElementById('pair-ip').value = savedIp;
        document.getElementById('conn-ip').value = savedIp;
        activeDeviceLabel.innerText = savedIp;
    }
    if (savedPairPort) document.getElementById('pair-port').value = savedPairPort;
    if (savedPairCode) document.getElementById('pair-code').value = savedPairCode;
    if (savedConnPort) document.getElementById('conn-port').value = savedConnPort;
    
    setAppStatus('Ready', '');
    setSteps('pair');
    loadHistory();
};

function loadHistory(selectedDevice = historySelect.value) {
    let history = JSON.parse(localStorage.getItem('pairHistory') || '[]');

    historyList.innerHTML = '';
    historySelect.innerHTML = '';
    
    if (history.length > 0) {
        historySelect.disabled = false;
        btnClearHistory.disabled = false;
        historyEmpty.classList.remove('visible');

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.innerText = '-- Pilih perangkat --';
        historySelect.appendChild(placeholder);

        history.forEach(dev => {
            const parsed = parseHistoryDevice(dev);

            let opt = document.createElement('option');
            opt.value = dev;
            opt.innerText = dev;
            historySelect.appendChild(opt);

            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'device-card';
            card.dataset.device = dev;
            card.innerHTML = `<span class="device-ip">${parsed.ip}</span><span class="device-meta">Pair port ${parsed.pairPort}</span>`;
            card.addEventListener('click', () => selectHistoryDevice(dev));
            historyList.appendChild(card);
        });

        if (selectedDevice && history.includes(selectedDevice)) {
            selectHistoryDevice(selectedDevice);
        } else {
            btnDeleteHistory.disabled = true;
        }
    } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.innerText = '-- Riwayat masih kosong --';
        historySelect.appendChild(opt);
        historySelect.disabled = true;
        btnClearHistory.disabled = true;
        btnDeleteHistory.disabled = true;
        historyEmpty.classList.add('visible');
        activeDeviceLabel.innerText = localStorage.getItem('lastIp') || 'No device selected';
    }
}

historySelect.addEventListener('change', (e) => {
    btnDeleteHistory.disabled = !e.target.value;
    selectHistoryDevice(e.target.value);
});

btnDeleteHistory.addEventListener('click', () => {
    const selectedDevice = historySelect.value;
    if (!selectedDevice) return;

    let history = JSON.parse(localStorage.getItem('pairHistory') || '[]');
    history = history.filter(dev => dev !== selectedDevice);
    localStorage.setItem('pairHistory', JSON.stringify(history));

    pairStatus.className = 'status-msg warning';
    pairStatus.innerText = 'Riwayat pairing dipilih sudah dihapus.';
    activeDeviceLabel.innerText = localStorage.getItem('lastIp') || 'No device selected';
    loadHistory('');
});

btnClearHistory.addEventListener('click', () => {
    localStorage.removeItem('pairHistory');

    pairStatus.className = 'status-msg warning';
    pairStatus.innerText = 'Semua riwayat pairing sudah dihapus.';
    activeDeviceLabel.innerText = localStorage.getItem('lastIp') || 'No device selected';
    loadHistory('');
});
