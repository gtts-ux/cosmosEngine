import { app, BrowserWindow, ipcMain, Menu, net, protocol, session, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { BODIES, TEXTURES } from '../src/data/catalog.js';
import {randomBytes} from 'node:crypto';
import {isStar,generatePlanet,sanitizeWorlds,GENERATION_TYPES,MAX_GENERATED,MAX_PER_SYSTEM} from '../src/data/systems.js';
import {populateWorlds,generateMoons} from '../src/data/world-population.js';
import {UpdateManager} from './updates.js';
import { defaults, sanitizeSettings } from './settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
let mainWindow;
// WebGL2 and GPU acceleration are enabled by Electron by default. This requested
// experimental flag is opt-in: it is not required by this WebGL2 renderer.
if (process.env.COSMOS_EXPERIMENTAL_COMPUTE === '1') {
  app.commandLine.appendSwitch('enable-webgl2-compute-context');
}
protocol.registerSchemesAsPrivileged([{
  scheme: 'cosmos', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
}]);
if (process.env.COSMOS_TEST_PROFILE) app.setPath('userData', process.env.COSMOS_TEST_PROFILE);

function trusted(event) {
  const url = new URL(event.senderFrame.url);
  if (!mainWindow || event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame ||
      url.protocol !== 'cosmos:' || url.hostname !== 'app') throw new Error('Untrusted IPC sender');
}
function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => { trusted(event); return handler(...args); });
}
let saveQueue = Promise.resolve();
async function setupIPC() {
  let fixture=null;
  if(process.env.COSMOS_TEST_PROFILE&&process.env.COSMOS_UPDATE_FIXTURE)fixture=JSON.parse(await readFile(process.env.COSMOS_UPDATE_FIXTURE,'utf8'));
  const updater=new UpdateManager({version:app.getVersion(),arch:process.arch,directory:path.join(app.getPath('userData'),'updates'),fetcher:fixture?async url=>{
    if(fixture.offline)throw new Error('No internet connection');
    return new Response(url.endsWith('/latest')?JSON.stringify(fixture.release):url.endsWith('SHA256SUMS.txt')?fixture.checksums:Buffer.from(fixture.payload,'base64'));
  }:(...args)=>net.fetch(...args),openInstaller:fixture?async()=> '':file=>shell.openPath(file)});
  handle('updates:status',()=>updater.snapshot());handle('updates:check',()=>updater.check());handle('updates:download',()=>updater.download());handle('updates:install',()=>updater.install());
  const settingsFile = path.join(app.getPath('userData'), 'settings.json');
  handle('settings:load', async () => {
    try { return sanitizeSettings(JSON.parse(await readFile(settingsFile, 'utf8'))); }
    catch { return { ...defaults }; }
  });
  handle('settings:save', (input) => {
    const settings = sanitizeSettings(input);
    saveQueue = saveQueue.catch(() => {}).then(async () => {
      await mkdir(path.dirname(settingsFile), { recursive: true });
      await writeFile(`${settingsFile}.tmp`, JSON.stringify(settings, null, 2), { mode: 0o600 });
      await rename(`${settingsFile}.tmp`, settingsFile);
      return settings;
    });
    return saveQueue;
  });
  handle('celestial:catalog', () => BODIES);
  const worldsFile=path.join(app.getPath('userData'),'worlds.json');let worldQueue=Promise.resolve();
  const loadWorlds=async()=>{try{return sanitizeWorlds(JSON.parse(await readFile(worldsFile,'utf8')),BODIES);}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return {version:1,planets:[]};throw error;}};
  handle('worlds:load',async()=>{await worldQueue.catch(()=>{});const state=await loadWorlds();return {state,bodies:populateWorlds(BODIES,state.planets)};});
  handle('worlds:generate',input=>{
    if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid generation request');
    const host=BODIES.find(b=>b.id===input.hostId&&isStar(b));
    const count=input.count??1,type=input.type??'random';
    if(!host||!Number.isInteger(count)||count<1||count>6||!GENERATION_TYPES.includes(type))throw new Error('Invalid generation options');
    const name=typeof input.name==='string'?input.name.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,48):'';
    const seed=typeof input.seed==='string'&&/^[a-zA-Z0-9-]{1,48}$/.test(input.seed)?input.seed:randomBytes(8).toString('hex');
    const task=worldQueue.catch(()=>{}).then(async()=>{
      const state=await loadWorlds(),existing=state.planets.filter(p=>p.hostId===host.id);
      const next=Math.max(host.id==='sun'?0:4,existing.length?Math.max(...existing.map(d=>d.index))+1:0);
      if(next+count>MAX_PER_SYSTEM||state.planets.length+count>MAX_GENERATED)throw new Error('Planet limit reached for this system or universe');
      const added=Array.from({length:count},(_,i)=>({hostId:host.id,index:next+i,seed,type,name:count===1?name:''}));
      state.planets.push(...added);
      await mkdir(path.dirname(worldsFile),{recursive:true});await writeFile(worldsFile+'.tmp',JSON.stringify(state,null,2),{mode:0o600});await rename(worldsFile+'.tmp',worldsFile);
      return {state,bodies:added.flatMap(d=>{const planet=generatePlanet(host,d);return [planet,...generateMoons(planet,host)];})};
    });worldQueue=task.then(()=>{},()=>{});return task;
  });
  handle('texture:resolve', (name) => {
    if (typeof name !== 'string' || !TEXTURES.includes(name)) throw new Error('Unknown texture');
    return `cosmos://app/assets/textures/${name}`;
  });
  handle('app:version', () => ({ app: app.getVersion(), electron: process.versions.electron, arch: process.arch, testing: !!process.env.COSMOS_TEST_PROFILE }));
  handle('window:action', (action) => {
    if (action === 'close') mainWindow.close();
    else if (action === 'minimize') mainWindow.minimize();
    else if (action === 'maximize') mainWindow.setFullScreen(!mainWindow.isFullScreen());
    else throw new Error('Unknown window action');
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 940, minWidth: 980, minHeight: 700,
    title: 'CosmosEngine-Mac', frame: false, backgroundColor: '#06090f',
    show: false, roundedCorners: true,
    webPreferences: {
      preload: path.join(here, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true,
    },
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.webContents.on('render-process-gone', (_event, details) => console.error('Renderer exited:', details.reason));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL('cosmos://app/index.html');
}
app.whenReady().then(async () => {
  protocol.handle('cosmos', (request) => {
    const url = new URL(request.url);
    if (url.host !== 'app' || request.method !== 'GET') return new Response('Forbidden', { status: 403 });
    let relative;
    try { relative = decodeURIComponent(url.pathname); } catch { return new Response('Bad path', { status: 400 }); }
    const base = path.join(root, 'dist');
    const resolved = path.resolve(base, `.${relative}`);
    if (!resolved.startsWith(`${base}${path.sep}`)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(resolved).href);
  });
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === 'pointerLock'));
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'pointerLock');
  await setupIPC();
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'CosmosEngine', submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'quit' }] },
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'toggleDevTools' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'front' }] },
  ]));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => app.quit());
