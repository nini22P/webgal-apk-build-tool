import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { buildApk } from '../lib/build'
import { BuildResult, Keystore, ProgressCallback, ProjectInfo } from '../lib/types'
import { getProjectInfo, saveProjectInfo } from '../lib/project'
import { getKeyProperties, saveKeyProperties } from '../lib/signer'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 540,
    height: 740,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('select-folder', async () => {
    const folderPaths = dialog.showOpenDialogSync({
      properties: ['openDirectory']
    })
    return folderPaths
  })

  ipcMain.handle('build-apk', async (_event, path: string | null): Promise<BuildResult> => {
    if (!path)
      return {
        success: false,
        message: 'No path specified'
      }

    const window = BrowserWindow.fromWebContents(_event.sender)

    if (!window) {
      return {
        success: false,
        message: 'Could not find the sender window.'
      }
    }

    const onProgress: ProgressCallback = (progressData): void => {
      window.webContents.send('build-progress', progressData)
    }

    const result = await buildApk(path, onProgress)
    return result
  })

  ipcMain.handle(
    'get-project-info',
    async (_event, path: string | null): Promise<ProjectInfo | null> => {
      if (!path) return null
      return await getProjectInfo(path)
    }
  )

  ipcMain.handle(
    'get-key-properties',
    async (_event, path: string | null): Promise<Keystore | null> => {
      if (!path) return null
      return await getKeyProperties(path)
    }
  )

  ipcMain.handle(
    'save-project-info',
    async (_event, path: string | null, projectInfo: ProjectInfo): Promise<void> => {
      if (!path) return
      await saveProjectInfo(path, projectInfo)
    }
  )

  ipcMain.handle(
    'save-key-properties',
    async (_event, path: string | null, keystore: Keystore): Promise<void> => {
      if (!path) return
      await saveKeyProperties(path, keystore)
    }
  )

  ipcMain.handle('select-keystore', async () => {
    const filePaths = dialog.showOpenDialogSync({
      properties: ['openFile'],
      filters: [
        { name: 'Keystore File', extensions: ['jks'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return filePaths
  })

  ipcMain.handle('select-save-keystore', async () => {
    const filePaths = dialog.showSaveDialogSync({
      properties: ['createDirectory'],
      filters: [
        { name: 'Keystore File', extensions: ['jks'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    return filePaths
  })

  ipcMain.handle('open-output-folder', async (_event, projectPath) => {
    if (!projectPath) return
    const outputPath = path.join(
      projectPath,
      '..',
      '..',
      '..',
      'Exported_Games',
      projectPath.split(path.sep).pop()!,
      'apk'
    )
    console.log(outputPath)
    try {
      await shell.openPath(outputPath)
    } catch (error) {
      console.error(`Error opening folder '${outputPath}':`, error)
    }
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
