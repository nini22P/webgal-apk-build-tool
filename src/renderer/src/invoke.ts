import { debounce } from 'lodash'
import { BuildResult, Keystore, ProjectInfo } from 'src/lib/types'

const _saveProjectInfo = (projectPath: string | null, projectInfo: ProjectInfo | null): void => {
  if (!projectPath || !projectInfo) return
  window.electron.ipcRenderer.invoke('save-project-info', projectPath, projectInfo)
}

export const saveProjectInfo = debounce(_saveProjectInfo, 500)

const _saveKeyProperties = (projectPath: string | null, keystore: Keystore | null): void => {
  if (!projectPath || !keystore) return
  window.electron.ipcRenderer.invoke('save-key-properties', projectPath, keystore)
}

export const saveKeyProperties = debounce(_saveKeyProperties, 500)

export const selectFolder = async (): Promise<string | null> => {
  const result = await window.electron.ipcRenderer.invoke('select-folder')

  if (!result || result.length === 0) {
    return null
  }

  return result[0]
}

export const selectKeystore = async (): Promise<string | null> => {
  const result = await window.electron.ipcRenderer.invoke('select-keystore')

  if (!result || result.length === 0) {
    return null
  }

  return result[0]
}

export const selectSaveKeystore = async (): Promise<string | null> =>
  await window.electron.ipcRenderer.invoke('select-save-keystore')

export const openOutputFolder = async (projectPath: string): Promise<void> => {
  await window.electron.ipcRenderer.invoke('open-output-folder', projectPath)
}

export const createKeystore = async (keystore: Keystore): Promise<Keystore | null> => {
  const result = await window.electron.ipcRenderer.invoke('create-keystore', keystore)
  return result
}

export const buildApk = async (projectPath: string): Promise<BuildResult> => {
  const result = await window.electron.ipcRenderer.invoke('build-apk', projectPath)
  return result
}
