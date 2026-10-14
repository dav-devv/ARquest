using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Windows.Forms;

class Launcher : Form {
    Process server;
    readonly Label status = new Label();
    readonly Button open = new Button();
    readonly Timer poll = new Timer();
    readonly string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MRCompanion");
    const string Address = "http://localhost:3010";
    int attempts;
    static bool smokeTest;
    static bool preview;
    [STAThread] static void Main(string[] args) {
        smokeTest=args.Length>0&&args[0]=="--smoke-test";
        if(args.Length==2&&args[0]=="--preview"){
            preview=true;
            Application.EnableVisualStyles();using(var form=new Launcher()){
                form.status.Text="Pronto para conectar seu celular";form.open.Enabled=true;form.Show();Application.DoEvents();form.PerformLayout();
                using(var bitmap=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(bitmap,new Rectangle(0,0,form.Width,form.Height));bitmap.Save(args[1]);}
            }return;
        }
        if (args.Length > 0 && args[0] == "--self-test") {
            Environment.Exit(File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"runtime","node.exe")) && File.Exists(Path.Combine(AppDomain.CurrentDomain.BaseDirectory,"pc_server","server.js")) ? 0 : 1);return;
        }
        bool first;
        using (var mutex = new System.Threading.Mutex(true,"Local\\MRCompanionDesktop",out first)) {
            if (!first) { MessageBox.Show("O MR Companion ja esta aberto.");return; }
            Application.EnableVisualStyles();Application.Run(new Launcher());
        }
    }
    Launcher() {
        Text="MR Companion • PC";ClientSize=new Size(560,330);MinimumSize=new Size(540,360);
        BackColor=Color.FromArgb(18,27,43);ForeColor=Color.White;Font=new Font("Segoe UI",11);StartPosition=FormStartPosition.CenterScreen;
        var layout=new TableLayoutPanel { Dock=DockStyle.Fill,Padding=new Padding(28),ColumnCount=1,RowCount=5 };
        layout.Controls.Add(new Label { Text="Seu computador, no espaco",Font=new Font("Segoe UI",20,FontStyle.Bold),AutoSize=true },0,0);
        layout.Controls.Add(new Label { Text="Mantenha esta janela aberta. No painel, compartilhe os monitores e obtenha o link para conectar o Android na mesma rede Wi-Fi.",AutoSize=true,MaximumSize=new Size(480,0),Margin=new Padding(0,16,0,16) },0,1);
        status.AutoSize=true;status.Text="Iniciando servidor...";layout.Controls.Add(status,0,2);
        open.Text="Abrir painel do PC";open.AutoSize=true;open.Height=44;open.Enabled=false;open.BackColor=Color.FromArgb(56,189,248);open.ForeColor=Color.Black;open.Click+=(s,e)=>Process.Start(Address);layout.Controls.Add(open,0,3);
        var logs=new Button { Text="Abrir pasta de registros",AutoSize=true };logs.Click+=(s,e)=>Process.Start("explorer.exe",data);layout.Controls.Add(logs,0,4);
        Controls.Add(layout);Shown+=(s,e)=>{if(!preview)Start();};FormClosing+=(s,e)=>Stop();
        poll.Interval=500;poll.Tick+=(s,e)=>Check();
    }
    void Start() {
        try {
            Directory.CreateDirectory(data);
            // Refuse occupied ports rather than attaching to an unrelated local process.
            foreach(var endpoint in System.Net.NetworkInformation.IPGlobalProperties.GetIPGlobalProperties().GetActiveTcpListeners())
                if(endpoint.Port==3010||endpoint.Port==3453||endpoint.Port==8090)throw new Exception("Portas 3010, 3453 ou 8090 ocupadas. Feche a outra instancia e reabra.");
            var root=AppDomain.CurrentDomain.BaseDirectory;
            var info=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"),"server.js") { WorkingDirectory=Path.Combine(root,"pc_server"),UseShellExecute=false,CreateNoWindow=true,RedirectStandardOutput=true,RedirectStandardError=true };
            info.EnvironmentVariables["MR_HTTP_PORT"]="3010";info.EnvironmentVariables["MR_HTTPS_PORT"]="3453";info.EnvironmentVariables["MR_WS_PORT"]="8090";info.EnvironmentVariables["MR_DATA_DIR"]=data;
            server=new Process { StartInfo=info };
            server.OutputDataReceived+=(s,e)=>Log(e.Data);server.ErrorDataReceived+=(s,e)=>Log(e.Data);
            server.Start();server.BeginOutputReadLine();server.BeginErrorReadLine();poll.Start();
        } catch(Exception e) {status.Text=e.Message;Log(e.Message);}
    }
    readonly object logGate=new object();
    void Log(string line) {if(line==null)return;try{lock(logGate)File.AppendAllText(Path.Combine(data,"server.log"),DateTime.Now.ToString("s")+" "+line+Environment.NewLine);}catch{}}
    void Check() {
        attempts++;
        if(server==null||server.HasExited){poll.Stop();status.Text="Falha ao iniciar. Consulte os registros.";return;}
        try {var request=(HttpWebRequest)WebRequest.Create(Address+"/api/health");request.Timeout=250;using(var response=request.GetResponse())using(var reader=new StreamReader(response.GetResponseStream())) {
            if(reader.ReadToEnd().Contains("mr-companion")){poll.Stop();status.Text="Pronto para conectar seu celular";open.Enabled=true;if(smokeTest){Stop();Close();}}
        }} catch {if(attempts>=60){poll.Stop();status.Text="Servidor indisponivel. Consulte os registros.";Stop();}}
    }
    void Stop(){poll.Stop();try{if(server!=null&&!server.HasExited){server.Kill();server.WaitForExit(2000);}}catch{} }
}
