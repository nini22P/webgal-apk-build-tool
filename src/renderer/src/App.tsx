import { useEffect, useMemo, useState } from 'react'
import styles from './app.module.css'
import { Button, Field, InfoLabel, Input, ProgressBar, Text } from '@fluentui/react-components'
import { BuildResult, Keystore, ProgressData, ProjectInfo } from 'src/lib/types'
import useSWR from 'swr'
import { debounce } from 'lodash'

const _saveProjectInfo = (projectPath: string | null, projectInfo: ProjectInfo | null): void => {
  if (!projectPath || !projectInfo) return
  window.electron.ipcRenderer.invoke('save-project-info', projectPath, projectInfo)
}

const saveProjectInfo = debounce(_saveProjectInfo, 500)

const _saveKeyProperties = (projectPath: string | null, keystore: Keystore | null): void => {
  if (!projectPath || !keystore) return
  window.electron.ipcRenderer.invoke('save-key-properties', projectPath, keystore)
}

const saveKeyProperties = debounce(_saveKeyProperties, 500)

const App = (): React.JSX.Element => {
  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [keystore, setKeystore] = useState<Keystore | null>(null)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)

  const isValidPackageName = (packageName: string): boolean => {
    const regex = /^(?=[a-z0-9])(?=.*\.)[a-z0-9_.]*[a-z0-9]$/
    return regex.test(packageName)
  }

  const selectFolder = async (): Promise<string | null> => {
    const result = await window.electron.ipcRenderer.invoke('select-folder')

    if (!result || result.length === 0) {
      return null
    }

    return result[0]
  }

  const selectKeystore = async (): Promise<string | null> => {
    const result = await window.electron.ipcRenderer.invoke('select-keystore')

    if (!result || result.length === 0) {
      return null
    }

    return result[0]
  }

  const selectSaveKeystore = async (): Promise<string | null> =>
    await window.electron.ipcRenderer.invoke('select-save-keystore')

  const build = async (): Promise<void> => {
    setBuildResult(null)
    const result = await window.electron.ipcRenderer.invoke('build-apk', projectPath)
    console.log(result)
    setBuildResult(result)
    openOutputFolder()
  }

  const openOutputFolder = async (): Promise<void> => {
    await window.electron.ipcRenderer.invoke('open-output-folder', projectPath)
  }

  const disableBuild = useMemo(
    () =>
      !projectPath ||
      projectPath.length === 0 ||
      !projectInfo ||
      projectInfo.appName.length === 0 ||
      projectInfo.packageName.length === 0 ||
      !isValidPackageName(projectInfo.packageName) ||
      projectInfo.versionName.length === 0 ||
      projectInfo.versionCode === 0 ||
      !keystore ||
      keystore.storeFile.length === 0 ||
      keystore.storePassword.length === 0 ||
      keystore.keyAlias.length === 0 ||
      keystore.keyPassword.length === 0 ||
      progress?.stage === 'RUNNING' ||
      progress?.stage === 'INITIALIZING',
    [projectPath, projectInfo, keystore, progress]
  )

  useSWR(
    projectPath ? ['get-project-info', projectPath] : null,
    async ([_event, path]: [string, string]): Promise<ProjectInfo | null> => {
      const info = await window.electron.ipcRenderer.invoke('get-project-info', path)
      setProjectInfo(info)
      return info
    }
  )

  useSWR(
    projectPath ? ['get-key-properties', projectPath] : null,
    async ([_event, path]: [string, string]): Promise<Keystore | null> => {
      const keystore = await window.electron.ipcRenderer.invoke('get-key-properties', path)
      setKeystore(keystore)
      return keystore
    }
  )

  useEffect(() => {
    window.electron.ipcRenderer.on('build-progress', (_event, progressData) => {
      console.log('Build Progress:', progressData)
      setProgress(progressData)
    })
  }, [])

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <Text>项目路径</Text>
        <div className={styles.inputContainer}>
          <Input
            type="text"
            style={{ flex: 1 }}
            value={projectPath || ''}
            onChange={(_ev, data) => setProjectPath(data.value)}
          />
          <Button
            appearance="primary"
            style={{ minWidth: '0' }}
            onClick={async () => {
              const result = await selectFolder()
              if (!result) return
              setProjectPath(result)
              setBuildResult(null)
              setProgress(null)
            }}
          >
            选择
          </Button>
        </div>
        {projectPath && (
          <>
            {projectInfo && (
              <>
                <Text>应用名</Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="text"
                    style={{ flex: 1 }}
                    value={projectInfo.appName}
                    onChange={(_ev, data) => {
                      const newProjectInfo = { ...projectInfo, appName: data.value }
                      setProjectInfo(newProjectInfo)
                      saveProjectInfo(projectPath, newProjectInfo)
                    }}
                  />
                </div>

                <Text>
                  包名
                  <InfoLabel info="包名只能包含小写字母、数字、下划线（_）或点（.），以小写字母或数字开头。包含至少一个点，且点不能在开头或结尾。" />
                </Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="text"
                    style={{ flex: 1 }}
                    value={projectInfo.packageName}
                    onChange={(_ev, data) => {
                      const newProjectInfo = { ...projectInfo, packageName: data.value }
                      setProjectInfo(newProjectInfo)
                      saveProjectInfo(projectPath, newProjectInfo)
                    }}
                  />
                </div>

                <Text>版本名</Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="text"
                    style={{ flex: 1 }}
                    value={projectInfo.versionName}
                    onChange={(_ev, data) => {
                      const newProjectInfo = { ...projectInfo, versionName: data.value }
                      setProjectInfo(newProjectInfo)
                      saveProjectInfo(projectPath, newProjectInfo)
                    }}
                  />
                </div>

                <Text>
                  版本号
                  <InfoLabel info="版本号为大于0的整数。应用安装新版本后，将无法直接覆盖安装旧版本；如需使用较低版本，必须先卸载当前已安装的高版本。" />
                </Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="number"
                    step={1}
                    min={1}
                    style={{ flex: 1 }}
                    value={projectInfo.versionCode.toString()}
                    onChange={(_ev, data) => {
                      const newProjectInfo = {
                        ...projectInfo,
                        versionCode: Number(data.value) || 1
                      }
                      setProjectInfo(newProjectInfo)
                      saveProjectInfo(projectPath, newProjectInfo)
                    }}
                  />
                </div>
              </>
            )}

            {keystore && projectInfo && (
              <>
                <Text>签名文件</Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="text"
                    style={{ flex: 1 }}
                    value={keystore.storeFile}
                    onChange={(_ev, data) => {
                      const newKeystore = { ...keystore, storeFile: data.value }
                      setKeystore(newKeystore)
                      saveKeyProperties(projectPath, newKeystore)
                    }}
                  />
                  <Button
                    appearance="primary"
                    style={{ minWidth: '0' }}
                    onClick={async () => {
                      const result = await selectSaveKeystore()
                      if (!result) return
                      const newKeystore = { ...keystore, storeFile: result }
                      setKeystore(newKeystore)
                      saveKeyProperties(projectPath, newKeystore)
                    }}
                  >
                    新建
                  </Button>
                  <Button
                    appearance="primary"
                    style={{ minWidth: '0' }}
                    onClick={async () => {
                      const result = await selectKeystore()
                      if (!result) return
                      const newKeystore = { ...keystore, storeFile: result }
                      setKeystore(newKeystore)
                      saveKeyProperties(projectPath, newKeystore)
                    }}
                  >
                    选择
                  </Button>
                </div>

                <Text>签名文件密码</Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="password"
                    style={{ flex: 1 }}
                    value={keystore.storePassword}
                    onChange={(_ev, data) => {
                      const newKeystore = { ...keystore, storePassword: data.value }
                      setKeystore(newKeystore)
                      saveKeyProperties(projectPath, newKeystore)
                    }}
                  />
                </div>

                <Text>密钥别名</Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="text"
                    style={{ flex: 1 }}
                    value={keystore.keyAlias}
                    onChange={(_ev, data) => {
                      const newKeystore = { ...keystore, keyAlias: data.value }
                      setKeystore(newKeystore)
                      saveKeyProperties(projectPath, newKeystore)
                    }}
                  />
                </div>

                <Text>密钥密码</Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="password"
                    style={{ flex: 1 }}
                    value={keystore.keyPassword}
                    onChange={(_ev, data) => {
                      const newKeystore = { ...keystore, keyPassword: data.value }
                      setKeystore(newKeystore)
                      saveKeyProperties(projectPath, newKeystore)
                    }}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {projectPath && (
        <div
          style={{
            backgroundColor: '#f0f0f0',
            display: 'flex',
            flexDirection: 'column',
            padding: '0.5rem',
            flexGrow: 0,
            gap: '0.5rem'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem' }}>
            <Button
              appearance="primary"
              onClick={build}
              style={{ width: '100%' }}
              disabled={disableBuild}
            >
              编译APK
            </Button>
            {progress && (
              <Button appearance="primary" style={{ width: '100%' }} onClick={openOutputFolder}>
                打开编译目录
              </Button>
            )}
          </div>

          <Field
            validationMessage={`${progress?.message ?? ''} ${buildResult?.path ? `- 保存到 ${buildResult.path} ` : ''}`}
            validationState="none"
          >
            <ProgressBar value={(progress?.percentage ?? 0) / 100} />
          </Field>
        </div>
      )}
    </div>
  )
}

export default App
