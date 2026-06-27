const { ipcRenderer } = require('electron');

// UI Elements
const btnPair = document.getElementById('btn-pair');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const pairStatus = document.getElementById('pair-status');
const connStatus = document.getElementById('conn-status');

// Pairing Action
btnPair.addEventListener('click', async () => {
    const ip = document.getElementById('pair-ip').value.trim();
    const port = document.getElementById('pair-port').value.trim();
    const code = document.getElementById('pair-code').value.trim();

    if (!ip || !port || !code) {
        pairStatus.className = 'status-msg error';
        pairStatus.innerText = 'Harap isi IP, Port, dan Code.';
        return;
    }

    localStorage.setItem('lastIp', ip);
    localStorage.setItem('lastPairPort', port);
    localStorage.setItem('lastPairCode', code);

    pairStatus.className = 'status-msg warning';
    pairStatus.innerText = 'Memulai Pairing...';

    const result = await ipcRenderer.invoke('run-command', 'pair', ip, port, code);
    
    if (result.success) {
        pairStatus.className = 'status-msg success';
        pairStatus.innerText = 'Pairing Sukses! Lanjut ke bawah.';
        
        // Simpan ke riwayat
        let history = JSON.parse(localStorage.getItem('pairHistory') || '[]');
        const newDevice = `${ip} (Port Pairing: ${port})`;
        if (!history.includes(newDevice)) {
            history.push(newDevice);
            localStorage.setItem('pairHistory', JSON.stringify(history));
            loadHistory();
        }

        document.getElementById('conn-ip').value = ip;
        document.getElementById('conn-port').focus();
    } else {
        pairStatus.className = 'status-msg error';
        pairStatus.innerText = `Gagal: ${result.message}`;
    }
});

// Connection & Start Action
btnStart.addEventListener('click', async () => {
    const ip = document.getElementById('conn-ip').value.trim();
    const port = document.getElementById('conn-port').value.trim();

    if (!ip || !port) {
        connStatus.className = 'status-msg error';
        connStatus.innerText = 'Harap isi IP dan Port utama.';
        return;
    }

    localStorage.setItem('lastIp', ip);
    localStorage.setItem('lastConnPort', port);

    connStatus.className = 'status-msg warning';
    connStatus.innerText = 'Mereset ADB dan Menghubungkan...';

    const result = await ipcRenderer.invoke('run-command', 'connect', ip, port);

    if (result.success) {
        connStatus.className = 'status-msg success';
        connStatus.innerText = 'Berhasil Terhubung! Membuka layar...';
        btnStart.style.display = 'none';
        btnStop.style.display = 'flex';
    } else {
        connStatus.className = 'status-msg error';
        connStatus.innerText = `Koneksi Gagal: ${result.message.substring(0, 220)}${result.message.length > 220 ? '...' : ''}`;
        
        // Jika error mengandung indikasi kunci kadaluarsa atau ditolak
        if (result.message.toLowerCase().includes('unauthorized') || 
            result.message.toLowerCase().includes('refused') || 
            result.message.toLowerCase().includes('offline')) {
            pairStatus.className = 'status-msg error';
            pairStatus.innerText = 'Pairing sudah tidak berlaku/ditolak. Wajib Pairing Ulang!';
        }
    }
});

// Stop Action
btnStop.addEventListener('click', async () => {
    await ipcRenderer.invoke('run-command', 'stop');
    btnStart.style.display = 'flex';
    btnStop.style.display = 'none';
    connStatus.className = 'status-msg';
    connStatus.innerText = 'Mirroring Dihentikan.';
});

// Listener for unexpected close
ipcRenderer.on('scrcpy-closed', (event, errStr) => {
    btnStart.style.display = 'flex';
    btnStop.style.display = 'none';
    connStatus.className = 'status-msg error';
    connStatus.innerText = errStr ? `Layar tertutup: ${errStr.substring(0, 220)}${errStr.length > 220 ? '...' : ''}` : 'Layar ditutup dari luar.';
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
    }
    if (savedPairPort) document.getElementById('pair-port').value = savedPairPort;
    if (savedPairCode) document.getElementById('pair-code').value = savedPairCode;
    if (savedConnPort) document.getElementById('conn-port').value = savedConnPort;
    
    loadHistory();
};

function loadHistory() {
    let history = JSON.parse(localStorage.getItem('pairHistory') || '[]');
    const historySection = document.getElementById('history-section');
    const historySelect = document.getElementById('history-select');
    
    historySection.style.display = 'block'; // Selalu tampilkan
    
    if (history.length > 0) {
        historySelect.disabled = false;
        historySelect.innerHTML = '<option value="">-- Lihat / Pilih Riwayat Perangkat --</option>';
        history.forEach(dev => {
            let opt = document.createElement('option');
            opt.value = dev;
            opt.innerText = dev;
            historySelect.appendChild(opt);
        });
    } else {
        historySelect.innerHTML = '<option value="">-- Riwayat masih kosong --</option>';
        historySelect.disabled = true;
    }
}

document.getElementById('history-select').addEventListener('change', (e) => {
    if (e.target.value) {
        let ip = e.target.value.split(' ')[0];
        document.getElementById('pair-ip').value = ip;
        document.getElementById('conn-ip').value = ip;
    }
});
