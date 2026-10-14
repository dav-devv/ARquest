const http = require('http');
const https = require('https');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const selfsigned = require('selfsigned');
const { exec } = require('child_process');
const { randomBytes } = require('crypto');
const { isLoopback, resolvePublicFile, validToken } = require('./security');
const virtualDisplays = require('./virtual-displays');
const {NativeMouse,MouseControl}=require('./mouse-control');
const {NativeControl}=require('./native-control');

async function startServer() {
// Port configuration
const HTTP_PORT = Number(process.env.MR_HTTP_PORT || 3000);
const HTTPS_PORT = Number(process.env.MR_HTTPS_PORT || 3443);
const WS_PORT = Number(process.env.MR_WS_PORT || 8080);
for(const port of [HTTP_PORT,HTTPS_PORT,WS_PORT])if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid MR server port');
const pairingToken = randomBytes(24).toString('hex');
const nativeControl=new NativeControl();
const allowedActions = new Set(['play_pause', 'volume_up', 'volume_down', 'mute', 'launch_calc', 'launch_notepad', 'screenshot', 'open_youtube', 'open_browser']);
const allowedMessages = new Set(['webrtc_offer','webrtc_answer','webrtc_ice','screen_stream_ended','direct_screen_frame','headset_preview_frame','gyro_telemetry','gesture_pinch','vr_command','set_gyro_config','hologram_notification','set_holo_color','headset_ready','stream_status']);
const localOrigins = new Set(['localhost','127.0.0.1'].flatMap(host=>['http://'+host+':'+HTTP_PORT,'https://'+host+':'+HTTPS_PORT]));
function trustedLocal(req) {
  return isLoopback(req.socket.remoteAddress) && (!req.headers.origin || localOrigins.has(req.headers.origin)) &&
    ['localhost','127.0.0.1'].flatMap(host=>[HTTP_PORT,HTTPS_PORT,WS_PORT].map(port=>host+':'+port)).includes(req.headers.host);
}

// Get local IPv4 address
function getLocalIPAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

const localIPs = getLocalIPAddresses();
const primaryIp = localIPs[0] || 'localhost';

// Generate or cache SSL certificates
const dataDir = process.env.MR_DATA_DIR || __dirname;
fs.mkdirSync(dataDir, { recursive: true });
const certPath = path.join(dataDir, 'cert.json');
let pems;

if (fs.existsSync(certPath)) {
  try {
    pems = JSON.parse(fs.readFileSync(certPath, 'utf8'));
  } catch (e) {
    pems = null;
  }
}

if (!pems || !pems.private || !pems.cert) {
  console.log('[SSL] Gerando certificado SSL autoassinado para HTTPS seguro...');
  const attrs = [{ name: 'commonName', value: primaryIp }];
  const altNames = [
    { type: 2, value: 'localhost' },
    ...localIPs.map(ip => ({ type: 7, ip: ip }))
  ];
  pems = await selfsigned.generate(attrs, { extensions: [{ name: 'subjectAltName', altNames }] });
  fs.writeFileSync(certPath, JSON.stringify(pems));
}

// Request Handler for both HTTP and HTTPS
function handleRequest(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let filePath = '';
  const url = req.url.split('?')[0];
  if(url.startsWith('/api/native/')){
    const reply=(code,value)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(value));};
    if(url==='/api/native/sync'){
      if(!req.socket.encrypted||!validToken((req.headers.authorization||'').replace(/^Bearer /,''),pairingToken)){reply(403,{error:'Pareamento inválido.'});return;}
    }else if(!trustedLocal(req)){reply(403,{error:'Use o painel neste PC.'});return;}
    if(url==='/api/native/pairing'&&req.method==='GET'){
      const pin=new (require('node:crypto').X509Certificate)(pems.cert).fingerprint256.replaceAll(':','').toLowerCase();
      reply(200,{code:'mrcompanion://'+primaryIp+':'+HTTPS_PORT+'/#token='+pairingToken+'&sha256='+pin});return;
    }
    if(url==='/api/native/status'&&req.method==='GET'){reply(200,{devices:nativeControl.status()});return;}
    if(req.method!=='POST'||!['/api/native/sync','/api/native/command'].includes(url)){reply(405,{error:'Método indisponível.'});return;}
    if(req.headers['content-type']!=='application/json'||(url==='/api/native/command'&&!localOrigins.has(req.headers.origin))){reply(403,{error:'Origem inválida.'});return;}
    let body='';req.on('data',chunk=>{body+=chunk;if(body.length>16384)req.destroy();});
    req.on('end',()=>{try{const data=JSON.parse(body);reply(200,url==='/api/native/sync'?nativeControl.sync(data):nativeControl.command(data.device,data));}catch(e){reply(400,{error:e.message});}});return;
  }
  if(url==='/api/health'&&trustedLocal(req)){
    res.writeHead(200,{'Content-Type':'application/json'});
    res.end(JSON.stringify({app:'mr-companion',version:'0.1.0'}));return;
  }
  if(url==='/api/displays'||url==='/api/displays/count'){
    // Driver changes are exclusively available from the local dashboard, never from paired phones.
    if(!trustedLocal(req)){res.writeHead(403);res.end();return;}
    const reply=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
    if(url==='/api/displays'&&req.method==='GET'){virtualDisplays.status().then(data=>reply(200,data)).catch(e=>reply(503,{error:e.message}));return;}
    if(url==='/api/displays/count'&&req.method==='POST'){
      if(!localOrigins.has(req.headers.origin)||req.headers['content-type']!=='application/json'){reply(403,{error:'Use o painel local.'});return;}
      let body='';req.on('data',chunk=>{body+=chunk;if(body.length>1024)req.destroy();});
      req.on('end',async()=>{let count;try{count=virtualDisplays.validateCount(JSON.parse(body).count);}catch(e){reply(400,{error:e.message});return;}try{await virtualDisplays.setCount(count);reply(200,{requested:count});}catch(e){reply(503,{error:e.message});}});return;
    }
    reply(405,{error:'Método não permitido.'});return;
  }
  if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
  if (url === '/api/pairing') {
    if (!trustedLocal(req)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ mobileUrl: 'https://' + primaryIp + ':' + HTTPS_PORT + '/mobile#token=' + pairingToken }));
    return;
  }

  if (url === '/' || url === '/dashboard') {
    filePath = path.join(__dirname, 'public', 'index.html');
  } else if (url === '/mobile') {
    filePath = path.join(__dirname, '..', 'web_mobile_test', 'index.html');
  } else if (url.startsWith('/mobile/')) {
    filePath = resolvePublicFile(path.join(__dirname, '..', 'web_mobile_test'), url.slice('/mobile'.length));
  } else if (url === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getSystemStats()));
    return;
  } else {
    filePath = resolvePublicFile(path.join(__dirname, 'public'), url);
  }

  if (!filePath) { res.writeHead(403); res.end(); return; }
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.wasm': 'application/wasm',
    '.task': 'application/octet-stream',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml'
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 - Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('500 - Internal Server Error: ' + err.message);
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

const httpServer = http.createServer(handleRequest);
const httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, handleRequest);

// WebSocket Server (works on WS_PORT for plain WS and attached to HTTPS for WSS)
const wsOptions = {
  maxPayload: 2 * 1024 * 1024,
  verifyClient: ({ req }) => {
    const token = new URL(req.url, 'http://localhost').searchParams.get('token');
    return trustedLocal(req) || validToken(token, pairingToken);
  }
};
const wss = new WebSocketServer({ port: WS_PORT, ...wsOptions });
const wssHttps = new WebSocketServer({ server: httpsServer, ...wsOptions });
const wssHttp = new WebSocketServer({ server: httpServer, ...wsOptions });

let activeClients = new Set();
const mouseControl=new MouseControl(new NativeMouse(),bindings=>broadcast({type:'mouse_control_state',bindings}));
setInterval(()=>mouseControl.tick(),100);
let lastCpuMeasure = os.cpus();

function getCpuUsagePercent() {
  const currentCpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const prev = lastCpuMeasure[i] ? lastCpuMeasure[i].times : { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 };
    const curr = currentCpus[i].times;

    const prevTotal = prev.user + prev.nice + prev.sys + prev.idle + prev.irq;
    const currTotal = curr.user + curr.nice + curr.sys + curr.idle + curr.irq;

    totalIdle += (curr.idle - prev.idle);
    totalTick += (currTotal - prevTotal);
  }

  lastCpuMeasure = currentCpus;
  if (totalTick <= 0) return 0;
  const usage = 100 - (totalIdle / totalTick * 100);
  return Math.max(0, Math.min(100, Math.round(usage)));
}

function getSystemStats() {
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memPercent = Math.round((usedMem / totalMem) * 100);

  return {
    type: 'system_stats',
    timestamp: Date.now(),
    cpuUsage: getCpuUsagePercent(),
    cpuCores: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Generic CPU',
    memoryTotalMB: Math.round(totalMem / (1024 * 1024)),
    memoryUsedMB: Math.round(usedMem / (1024 * 1024)),
    memoryPercent: memPercent,
    uptimeSeconds: Math.round(os.uptime()),
    hostname: os.hostname(),
    platform: os.platform()
  };
}

function handleWsConnection(ws, req) {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WS] Novo dispositivo conectado: ${clientIp}`);
  activeClients.add(ws);
  const local=trustedLocal(req);ws.screenSources=new Set();ws.controlSources=new Set();ws.mouseVersions=new Map();
  ws.send(JSON.stringify({type:'mouse_control_state',bindings:mouseControl.state()}));

  ws.send(JSON.stringify({
    type: 'connected',
    message: 'Conectado com sucesso ao Servidor PC!',
    serverTime: new Date().toISOString()
  }));
  ws.send(JSON.stringify(getSystemStats()));

  ws.on('error', error => console.warn('[WS]', error.message));
  let lastActionTime = 0;
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
      if(data.type==='mouse_control'){if(!local)mouseControl.input(ws,data);return;}
      if(data.type==='mouse_bind'){
        if(!local||typeof data.streamId!=='string'||!ws.controlSources.has(data.streamId))return;
        const version=(ws.mouseVersions.get(data.streamId)||0)+1;ws.mouseVersions.set(data.streamId,version);
        mouseControl.unbind(data.streamId,ws);
        try{
          if(!data.display){mouseControl.unbind(data.streamId,ws);return;}
          const status=await virtualDisplays.status(),display=status.displays.find(d=>d.name===data.display);
          if(!display)throw Error('Monitor não encontrado. Verifique as telas novamente.');
          await mouseControl.native.start();
          if(ws.readyState===1&&ws.controlSources.has(data.streamId)&&ws.mouseVersions.get(data.streamId)===version)mouseControl.bind(data.streamId,display,ws);
        }catch(e){if(ws.readyState===1)ws.send(JSON.stringify({type:'mouse_control_error',message:e.message}));}return;
      }
      if(local&&data.type==='stream_status'&&Array.isArray(data.sources)){
        const ids=new Set(data.sources.filter(s=>s&&typeof s.id==='string').map(s=>s.id));
        ws.controlSources=new Set(data.sources.filter(s=>s?.surface==='monitor'&&typeof s.id==='string').map(s=>s.id));
        for(const id of ws.screenSources)if(!ids.has(id))mouseControl.unbind(id,ws);ws.screenSources=ids;
      }
      if(local&&data.type==='screen_stream_ended'&&data.streamId)mouseControl.unbind(data.streamId,ws);

      // Execute actions triggered by Hand Tracking from mobile
      if (data.type === 'pc_action') {
        if (!allowedActions.has(data.action) || Date.now() - lastActionTime < 250) return;
        lastActionTime = Date.now();
        console.log(`>>> [AÇÃO NO PC EXECUTADA] ${data.action}`);
        try { await executePCAction(data.action); }
        catch (error) {
          if (ws.readyState===1) ws.send(JSON.stringify({type:'hologram_notification',title:'Falha na a??o',message:'N?o foi poss?vel executar o comando no PC.'}));
          console.error('[PC action]',error.message); return;
        }
        
        // Broadcast confirmation feedback to VR headset
        broadcast({
          type: 'hologram_notification',
          title: 'Ação no PC',
          message: formatActionMessage(data.action)
        });
        return;
      }

      // Forward all peer messages directly (WebRTC, gyro_telemetry, headset_preview, screen_frames, commands)
      if (allowedMessages.has(data.type)) broadcastExcept(ws, data);
    } catch (e) {
      console.error('[WS Erro]:', e.message);
    }
  });

  ws.on('close', () => {
    mouseControl.disconnect(ws);
    console.log(`[WS] Dispositivo desconectado: ${clientIp}`);
    activeClients.delete(ws);
  });
}

wss.on('connection', handleWsConnection);
wssHttps.on('connection', handleWsConnection);
wssHttp.on('connection', handleWsConnection);

function broadcast(data) {
  const json = JSON.stringify(data);
  for (const client of activeClients) {
    if (client.readyState === 1 && client.bufferedAmount < 1024 * 1024) client.send(json);
  }
}

function broadcastExcept(sender, data) {
  const json = JSON.stringify(data);
  for (const client of activeClients) {
    if (client !== sender && client.readyState === 1 && client.bufferedAmount < 1024 * 1024) client.send(json);
  }
}

setInterval(() => {
  if (activeClients.size > 0) broadcast(getSystemStats());
}, 1000);

// Start HTTP
httpServer.listen(HTTP_PORT);

// Start HTTPS
httpsServer.listen(HTTPS_PORT, () => {
  console.log('\n=============================================================');
  console.log('🚀 SERVIDOR MR PASSTHROUGH INICIADO (COM SUPORTE A HTTPS)!');
  console.log('=============================================================');
  console.log(`\n💻 Painel de Controle (no PC):`);
  console.log(`   http://localhost:${HTTP_PORT}`);
  console.log(`\n📱 No Celular (USE ESTE LINK HTTPS PARA LIBERAR A CÂMERA):`);
  localIPs.forEach(ip => {
    console.log(`   👉 https://${ip}:${HTTPS_PORT}/mobile`);
  });
  console.log('=============================================================\n');
});

function executePCAction(action) {
  const run = command => new Promise((resolve,reject)=>exec(command,error=>error?reject(error):resolve()));
  try {
    switch (action) {
      case 'play_pause':
        // Media Play/Pause
        return run('powershell -Command "$ws = New-Object -ComObject Wscript.Shell; $ws.SendKeys([char]179)"');
      case 'volume_up':
        // Volume Up
        return run('powershell -Command "$ws = New-Object -ComObject Wscript.Shell; $ws.SendKeys([char]175)"');
      case 'volume_down':
        // Volume Down
        return run('powershell -Command "$ws = New-Object -ComObject Wscript.Shell; $ws.SendKeys([char]174)"');
      case 'mute':
        // Volume Mute
        return run('powershell -Command "$ws = New-Object -ComObject Wscript.Shell; $ws.SendKeys([char]173)"');
      case 'open_youtube':
        return run('start "" "https://www.youtube.com"');
      case 'open_browser':
        return run('start "" "https://www.google.com"');
      case 'launch_calc':
        return run('calc');
      case 'launch_notepad':
        return run('notepad');
      case 'screenshot':
        return run('powershell -Command "Start-Process snippingtool"');
      default:
        console.log(`[Ação Desconhecida]: ${action}`);
    }
  } catch (err) {
    console.error(`[Erro ao executar ação no PC]: ${err.message}`);
  }
}

function formatActionMessage(action) {
  switch (action) {
    case 'open_youtube': return 'YouTube aberto no navegador do PC';
    case 'open_browser': return 'Navegador aberto no PC';
    case 'play_pause': return '⏯️ Música Play / Pause disparado!';
    case 'volume_up': return '🔊 Volume aumentado no PC';
    case 'volume_down': return '🔉 Volume diminuído no PC';
    case 'mute': return '🔇 Áudio colocado em mudo';
    case 'launch_calc': return '🧮 Calculadora aberta no PC';
    case 'launch_notepad': return '📝 Bloco de Notas aberto';
    case 'screenshot': return '📸 Captura de tela aberta';
    default: return `Comando: ${action}`;
  }
}


}

startServer().catch((error) => {
  console.error("Falha ao iniciar servidor:", error);
  process.exitCode = 1;
});
