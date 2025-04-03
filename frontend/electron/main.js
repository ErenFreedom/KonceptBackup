const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

app.commandLine.appendSwitch('ignore-certificate-errors');
app.disableHardwareAcceleration();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const indexPath = path.join(__dirname, '..', 'build', 'index.html');
  mainWindow.loadFile(indexPath)
    .then(() => console.log('✅ React frontend loaded'))
    .catch(err => console.error('❌ Failed to load frontend:', err));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});