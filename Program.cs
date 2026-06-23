using System;
using System.Drawing;
using System.Windows.Forms;
using System.Diagnostics;
using System.IO;

namespace MirrorWireless
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm());
        }
    }

    public class MainForm : Form
    {
        private TextBox txtIpPair, txtPortPair, txtCodePair;
        private TextBox txtIpConn, txtPortConn;
        private Button btnPair, btnConnect, btnStop;
        private Label lblStatus;
        private Process scrcpyProcess;
        private string toolsPath;

        public MainForm()
        {
            toolsPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "tools", "scrcpy");

            this.Text = "Wireless Mirror Native";
            this.Size = new Size(360, 480);
            this.BackColor = Color.FromArgb(15, 15, 15);
            this.ForeColor = Color.White;
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;

            Label title = new Label() { Text = "WIRELESS MIRROR", Font = new Font("Segoe UI", 16, FontStyle.Bold), ForeColor = Color.Orange, Top = 15, Left = 0, Width = 340, TextAlign = ContentAlignment.MiddleCenter };
            this.Controls.Add(title);

            // Group Pairing
            GroupBox grpPair = new GroupBox() { Text = "1. PAIRING (Gunakan Port dari Popup 6-Digit)", ForeColor = Color.Orange, Top = 55, Left = 20, Width = 300, Height = 140 };
            
            grpPair.Controls.Add(new Label() { Text = "IP Address:", Top = 25, Left = 10, Width = 70, ForeColor = Color.White });
            txtIpPair = new TextBox() { Top = 22, Left = 90, Width = 110, BackColor = Color.FromArgb(40,40,40), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
            grpPair.Controls.Add(txtIpPair);

            grpPair.Controls.Add(new Label() { Text = "Port:", Top = 55, Left = 10, Width = 70, ForeColor = Color.White });
            txtPortPair = new TextBox() { Top = 52, Left = 90, Width = 70, BackColor = Color.FromArgb(40,40,40), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
            grpPair.Controls.Add(txtPortPair);

            grpPair.Controls.Add(new Label() { Text = "Code:", Top = 85, Left = 10, Width = 70, ForeColor = Color.White });
            txtCodePair = new TextBox() { Top = 82, Left = 90, Width = 70, BackColor = Color.FromArgb(40,40,40), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
            grpPair.Controls.Add(txtCodePair);

            btnPair = new Button() { Text = "PAIR", Top = 40, Left = 180, Width = 100, Height = 50, BackColor = Color.FromArgb(50,50,50), ForeColor = Color.White, FlatStyle = FlatStyle.Flat };
            btnPair.Click += BtnPair_Click;
            grpPair.Controls.Add(btnPair);
            this.Controls.Add(grpPair);

            // Group Connection
            GroupBox grpConn = new GroupBox() { Text = "2. CONNECTION (Gunakan Port Layar Utama)", ForeColor = Color.LightGreen, Top = 210, Left = 20, Width = 300, Height = 150 };
            
            grpConn.Controls.Add(new Label() { Text = "IP Address:", Top = 25, Left = 10, Width = 70, ForeColor = Color.White });
            txtIpConn = new TextBox() { Top = 22, Left = 90, Width = 110, BackColor = Color.FromArgb(40,40,40), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
            grpConn.Controls.Add(txtIpConn);

            grpConn.Controls.Add(new Label() { Text = "Port:", Top = 55, Left = 10, Width = 70, ForeColor = Color.White });
            txtPortConn = new TextBox() { Top = 52, Left = 90, Width = 70, BackColor = Color.FromArgb(40,40,40), ForeColor = Color.White, BorderStyle = BorderStyle.FixedSingle };
            grpConn.Controls.Add(txtPortConn);

            btnConnect = new Button() { Text = "START MIRRORING", Top = 90, Left = 10, Width = 280, Height = 40, BackColor = Color.LightGreen, ForeColor = Color.Black, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9, FontStyle.Bold) };
            btnConnect.Click += BtnConnect_Click;
            grpConn.Controls.Add(btnConnect);

            btnStop = new Button() { Text = "STOP MIRRORING", Top = 90, Left = 10, Width = 280, Height = 40, BackColor = Color.Crimson, ForeColor = Color.White, FlatStyle = FlatStyle.Flat, Font = new Font("Segoe UI", 9, FontStyle.Bold), Visible = false };
            btnStop.Click += BtnStop_Click;
            grpConn.Controls.Add(btnStop);
            this.Controls.Add(grpConn);

            lblStatus = new Label() { Top = 370, Left = 20, Width = 300, Height = 60, ForeColor = Color.Gray, TextAlign = ContentAlignment.TopCenter, Font = new Font("Consolas", 8) };
            this.Controls.Add(lblStatus);

            txtIpPair.Text = "192.168.";
            txtIpConn.Text = "192.168.";
        }

        private void RunAdb(string arguments, Action<string> onOutput)
        {
            try {
                Process p = new Process();
                p.StartInfo.FileName = Path.Combine(toolsPath, "adb.exe");
                p.StartInfo.Arguments = arguments;
                p.StartInfo.UseShellExecute = false;
                p.StartInfo.RedirectStandardOutput = true;
                p.StartInfo.RedirectStandardError = true;
                p.StartInfo.CreateNoWindow = true;
                p.Start();
                string output = p.StandardOutput.ReadToEnd() + p.StandardError.ReadToEnd();
                p.WaitForExit();
                onOutput(output);
            } catch(Exception ex) {
                onOutput("Error: " + ex.Message);
            }
        }

        private void BtnPair_Click(object sender, EventArgs e)
        {
            string ip = txtIpPair.Text.Trim();
            string port = txtPortPair.Text.Trim();
            string code = txtCodePair.Text.Trim();
            if(ip=="" || port=="" || code=="") { lblStatus.Text="ERROR: Isi IP, Port, dan Code Pairing!"; return; }

            lblStatus.Text = "Status: Memulai Pairing...";
            Application.DoEvents();

            RunAdb(string.Format("pair {0}:{1} {2}", ip, port, code), (outStr) => {
                this.Invoke((MethodInvoker)delegate {
                    if (outStr.ToLower().Contains("success") || outStr.ToLower().Contains("successfully")) {
                        lblStatus.Text = "Status: Pairing SUKSES!\nSekarang cek port baru di HP dan masukkan ke bawah.";
                        lblStatus.ForeColor = Color.LightGreen;
                        txtIpConn.Text = ip;
                    } else {
                        lblStatus.Text = "Status: Pairing GAGAL!\n" + outStr;
                        lblStatus.ForeColor = Color.Crimson;
                    }
                });
            });
        }

        private void BtnConnect_Click(object sender, EventArgs e)
        {
            string ip = txtIpConn.Text.Trim();
            string port = txtPortConn.Text.Trim();
            if(ip=="" || port=="") { lblStatus.Text="ERROR: Isi IP dan Port Connection!"; return; }

            lblStatus.Text = "Status: Menghubungkan...";
            Application.DoEvents();

            RunAdb(string.Format("connect {0}:{1}", ip, port), (outStr) => {
                this.Invoke((MethodInvoker)delegate {
                    if (outStr.ToLower().Contains("connected to") || outStr.ToLower().Contains("already connected")) {
                        lblStatus.Text = "Status: Terkoneksi! Membuka layar...";
                        lblStatus.ForeColor = Color.LightGreen;
                        StartScrcpy(ip);
                    } else {
                        lblStatus.Text = "Status: Koneksi GAGAL!\n" + outStr;
                        lblStatus.ForeColor = Color.Crimson;
                    }
                });
            });
        }

        private void StartScrcpy(string ip)
        {
            try {
                scrcpyProcess = new Process();
                scrcpyProcess.StartInfo.FileName = Path.Combine(toolsPath, "scrcpy.exe");
                // Optimasi WiFi ekstrim
                scrcpyProcess.StartInfo.Arguments = string.Format("--tcpip={0} --turn-screen-off --stay-awake --video-bit-rate=1M --max-size=800 --video-codec=h265 --video-buffer=50 --no-audio", ip);
                scrcpyProcess.StartInfo.WorkingDirectory = toolsPath;
                scrcpyProcess.StartInfo.UseShellExecute = false;
                scrcpyProcess.StartInfo.CreateNoWindow = true;
                
                scrcpyProcess.EnableRaisingEvents = true;
                scrcpyProcess.Exited += (s, e) => {
                    this.Invoke((MethodInvoker)delegate {
                        btnConnect.Visible = true;
                        btnStop.Visible = false;
                        lblStatus.Text = "Status: Mirroring dihentikan.";
                        lblStatus.ForeColor = Color.Gray;
                        scrcpyProcess = null;
                    });
                };
                
                scrcpyProcess.Start();
                btnConnect.Visible = false;
                btnStop.Visible = true;
            } catch(Exception ex) {
                lblStatus.Text = "Error scrcpy: " + ex.Message;
                lblStatus.ForeColor = Color.Crimson;
            }
        }

        private void BtnStop_Click(object sender, EventArgs e)
        {
            if (scrcpyProcess != null && !scrcpyProcess.HasExited) {
                scrcpyProcess.Kill();
            }
            btnConnect.Visible = true;
            btnStop.Visible = false;
            lblStatus.Text = "Status: Mirroring dihentikan paksa.";
            lblStatus.ForeColor = Color.Gray;
        }
    }
}
