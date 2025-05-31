import { useEffect, useMemo, useState } from 'react'
import styles from './app.module.css'
import {
  Button,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  DialogTrigger,
  Field,
  InfoLabel,
  Input,
  Link,
  Option,
  ProgressBar,
  Text,
  Title3
} from '@fluentui/react-components'
import { version } from '~build/package';
import { BuildResult, Keystore, ProgressData, ProjectInfo } from 'src/lib/types'
import useSWR from 'swr'
import useLocalStorage from './hooks/useLocalStorage'
import {
  buildApk,
  createKeystore,
  openOutputFolder,
  saveKeyProperties,
  saveProjectInfo,
  selectFolder,
  selectKeystore,
  selectSaveKeystore
} from './invoke'

const App = (): React.JSX.Element => {
  const emptyKeystore: Keystore = {
    storeFile: '',
    storePassword: '',
    keyAlias: '',
    keyPassword: '',
    validity: 25,
    dname: {
      firstAndLastName: '',
      organizationalUnit: '',
      organization: '',
      cityOrLocality: '',
      stateOrProvince: '',
      countryCode: ''
    }
  }

  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null)
  const [allProjectInfo, setAllprojectInfo] = useState<ProjectInfo[]>([])
  const [keystore, setKeystore] = useState<Keystore | null>(null)
  const [newKeystore, setNewKeystore] = useState<Keystore>(emptyKeystore)
  const [progress, setProgress] = useState<ProgressData | null>(null)
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null)
  const [open, setOpen] = useState(false)
  const [isFileDialogActive, setIsFileDialogActive] = useState(false)

  useLocalStorage('projectPath', projectPath, setProjectPath)

  const isValidPackageName = (packageName: string): boolean => {
    const regex = /^(?=[a-z])(?=.*\.)[a-z0-9_.]*[a-z0-9]$/
    return regex.test(packageName)
  }

  const build = async (): Promise<void> => {
    setBuildResult(null)
    if (projectPath === null) return
    const result = await buildApk(projectPath)
    console.log(result)
    setBuildResult(result)
    openOutputFolder(projectPath)
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
      keystore.storePassword.length < 6 ||
      keystore.keyAlias.length === 0 ||
      keystore.keyPassword.length < 6 ||
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
    },
    {
      revalidateOnFocus: !isFileDialogActive
    }
  )

  useSWR(
    projectPath ? ['get-all-project-info', `${projectPath}/..`] : null,
    async ([_event, path]: [string, string]): Promise<ProjectInfo[]> => {
      const info = await window.electron.ipcRenderer.invoke('get-all-project-info', path)
      setAllprojectInfo(info)
      return info
    }
  )

  useEffect(() => {
    window.electron.ipcRenderer.on('build-progress', (_event, progressData) => {
      console.log('Build Progress:', progressData)
      setProgress(progressData)
    })
  }, [])

  useEffect(() => {
    document.title = `WebGAL APK 编译工具 ${version}`
  }, [])

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 0.5rem 0.5rem 0.25rem'
          }}
        >
          <Title3>WebGAL APK 编译工具 {version}</Title3>
          <Link
            href="https://github.com/OpenWebGAL/webgal-apk-build-tool"
            title="https://github.com/OpenWebGAL/webgal-apk-build-tool"
            target="_blank"
          >
            GitHub
          </Link>
        </div>
        <Text>项目路径</Text>
        <div className={styles.inputContainer}>
          <Combobox
            key={projectPath}
            style={{ flex: 1 }}
            value={projectPath || ''}
            selectedOptions={projectPath ? [projectPath] : []}
            onOptionSelect={(_ev, data) => data.optionValue && setProjectPath(data.optionValue)}
          >
            {allProjectInfo.map((item) => (
              <Option key={item.path} value={item.path} text={item.appName}>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    paddingLeft: '0.25rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    textWrap: 'nowrap'
                  }}
                >
                  <div style={{ fontWeight: '500' }}>{item.appName}</div>
                  <div style={{ color: 'gray', fontSize: '0.8rem' }}>{item.packageName}</div>
                  {item.path}
                </div>
              </Option>
            ))}
          </Combobox>
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
                  <InfoLabel info="包名只能包含小写字母、数字、下划线（_）或点（.），以小写字母开头。包含至少一个点（.），且点（.）不能在开头或结尾。" />
                </Text>
                <div className={styles.inputContainer}>
                  <Input
                    spellCheck={false}
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
                <Text>密钥库文件路径</Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="text"
                    style={{ flex: 1 }}
                    value={keystore.storeFile}
                    onChange={(_ev, data) => {
                      setKeystore({ ...keystore, storeFile: data.value })
                      saveKeyProperties(projectPath, { ...keystore, storeFile: data.value })
                    }}
                  />

                  <Dialog
                    open={open}
                    onOpenChange={(_event, isOpen) => {
                      setOpen(isOpen.open)
                      setNewKeystore(emptyKeystore)
                    }}
                  >
                    <DialogTrigger disableButtonEnhancement>
                      <Button appearance="primary" style={{ minWidth: '0' }}>
                        新建
                      </Button>
                    </DialogTrigger>
                    <DialogSurface>
                      <DialogBody>
                        <DialogTitle>新建密钥库文件</DialogTitle>
                        <DialogContent className={styles.container}>
                          <Text>
                            密钥库文件路径 <span style={{ color: 'red' }}>*</span>
                          </Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="text"
                              style={{ flex: 1 }}
                              value={newKeystore.storeFile}
                              onChange={(_ev, data) => {
                                setNewKeystore({ ...newKeystore, storeFile: data.value })
                              }}
                            />
                            <Button
                              appearance="primary"
                              style={{ minWidth: '0' }}
                              onClick={async () => {
                                const result = await selectSaveKeystore()
                                if (!result) return
                                setNewKeystore({ ...newKeystore, storeFile: result })
                              }}
                            >
                              选择
                            </Button>
                          </div>

                          <Text>
                            密钥库文件密码 <InfoLabel info={'密码长度至少6位'} required />
                          </Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="password"
                              style={{ flex: 1 }}
                              value={newKeystore.storePassword}
                              onChange={(_ev, data) => {
                                setNewKeystore({ ...newKeystore, storePassword: data.value })
                              }}
                            />
                          </div>

                          <Text>
                            密钥别名 <span style={{ color: 'red' }}>*</span>
                          </Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="text"
                              style={{ flex: 1 }}
                              value={newKeystore.keyAlias}
                              onChange={(_ev, data) => {
                                setNewKeystore({ ...newKeystore, keyAlias: data.value })
                              }}
                            />
                          </div>

                          <Text>
                            密钥密码
                            <InfoLabel info={'密码长度至少6位'} required />
                          </Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="password"
                              style={{ flex: 1 }}
                              value={newKeystore.keyPassword}
                              onChange={(_ev, data) => {
                                setNewKeystore({ ...newKeystore, keyPassword: data.value })
                              }}
                            />
                          </div>

                          <Text>
                            有效期（年） <span style={{ color: 'red' }}>*</span>
                          </Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="number"
                              step={1}
                              min={1}
                              style={{ flex: 1 }}
                              value={newKeystore.validity?.toString()}
                              onChange={(_ev, data) => {
                                setNewKeystore({ ...newKeystore, validity: Number(data.value) })
                              }}
                            />
                          </div>

                          <Text>
                            全名 <span style={{ color: 'red' }}>*</span>
                          </Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="text"
                              style={{ flex: 1 }}
                              value={newKeystore.dname?.firstAndLastName || ''}
                              onChange={(_ev, data) => {
                                setNewKeystore({
                                  ...newKeystore,
                                  dname: { ...newKeystore.dname, firstAndLastName: data.value }
                                })
                              }}
                            />
                          </div>

                          <Text>组织单位</Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="text"
                              style={{ flex: 1 }}
                              value={newKeystore.dname?.organizationalUnit || ''}
                              onChange={(_ev, data) => {
                                setNewKeystore({
                                  ...newKeystore,
                                  dname: { ...newKeystore.dname, organizationalUnit: data.value }
                                })
                              }}
                            />
                          </div>

                          <Text>组织</Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="text"
                              style={{ flex: 1 }}
                              value={newKeystore.dname?.organization || ''}
                              onChange={(_ev, data) => {
                                setNewKeystore({
                                  ...newKeystore,
                                  dname: { ...newKeystore.dname, organization: data.value }
                                })
                              }}
                            />
                          </div>

                          <Text>城市或区域</Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="text"
                              style={{ flex: 1 }}
                              value={newKeystore.dname?.cityOrLocality || ''}
                              onChange={(_ev, data) => {
                                setNewKeystore({
                                  ...newKeystore,
                                  dname: { ...newKeystore.dname, cityOrLocality: data.value }
                                })
                              }}
                            />
                          </div>

                          <Text>省份或州</Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="text"
                              style={{ flex: 1 }}
                              value={newKeystore.dname?.stateOrProvince || ''}
                              onChange={(_ev, data) => {
                                setNewKeystore({
                                  ...newKeystore,
                                  dname: { ...newKeystore.dname, stateOrProvince: data.value }
                                })
                              }}
                            />
                          </div>

                          <Text>国家代码</Text>
                          <div className={styles.inputContainer}>
                            <Input
                              type="text"
                              style={{ flex: 1 }}
                              value={newKeystore.dname?.countryCode || ''}
                              onChange={(_ev, data) => {
                                setNewKeystore({
                                  ...newKeystore,
                                  dname: { ...newKeystore.dname, countryCode: data.value }
                                })
                              }}
                            />
                          </div>
                        </DialogContent>
                        <DialogActions>
                          <DialogTrigger disableButtonEnhancement>
                            <Button onClick={() => setNewKeystore(emptyKeystore)}>取消</Button>
                          </DialogTrigger>
                          <Button
                            appearance="primary"
                            disabled={
                              !newKeystore.storeFile ||
                              !newKeystore.storePassword ||
                              newKeystore.storePassword.length < 6 ||
                              !newKeystore.keyAlias ||
                              !newKeystore.keyPassword ||
                              newKeystore.keyPassword.length < 6 ||
                              !newKeystore.dname ||
                              !newKeystore.dname.firstAndLastName
                            }
                            onClick={async () => {
                              if (!newKeystore.storeFile) return
                              if (!newKeystore.storePassword) return
                              if (newKeystore.storePassword.length < 6) return
                              if (!newKeystore.keyAlias) return
                              if (!newKeystore.keyPassword) return
                              if (newKeystore.keyPassword.length < 6) return
                              if (!newKeystore.dname) return
                              if (!newKeystore.dname.firstAndLastName) return

                              const keystore = await createKeystore(newKeystore)
                              if (!keystore) return
                              setKeystore(keystore)
                              saveKeyProperties(projectPath, keystore)
                              setOpen(false)
                            }}
                          >
                            创建
                          </Button>
                        </DialogActions>
                      </DialogBody>
                    </DialogSurface>
                  </Dialog>

                  <Button
                    appearance="primary"
                    style={{ minWidth: '0' }}
                    onClick={async () => {
                      setIsFileDialogActive(true)
                      const result = await selectKeystore()
                      if (!result) return
                      setKeystore({ ...keystore, storeFile: result })
                      saveKeyProperties(projectPath, { ...keystore, storeFile: result })
                      setTimeout(() => setIsFileDialogActive(false), 500)
                    }}
                  >
                    选择
                  </Button>
                </div>

                <Text>
                  密钥库文件密码 <InfoLabel info={'密码长度至少6位'} />
                </Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="password"
                    style={{ flex: 1 }}
                    value={keystore.storePassword}
                    onChange={(_ev, data) => {
                      setKeystore({ ...keystore, storePassword: data.value })
                      saveKeyProperties(projectPath, { ...keystore, storePassword: data.value })
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
                      setKeystore({ ...keystore, keyAlias: data.value })
                      saveKeyProperties(projectPath, { ...keystore, keyAlias: data.value })
                    }}
                  />
                </div>

                <Text>
                  密钥密码 <InfoLabel info={'密码长度至少6位'} />
                </Text>
                <div className={styles.inputContainer}>
                  <Input
                    type="password"
                    style={{ flex: 1 }}
                    value={keystore.keyPassword}
                    onChange={(_ev, data) => {
                      setKeystore({ ...keystore, keyPassword: data.value })
                      saveKeyProperties(projectPath, { ...keystore, keyPassword: data.value })
                    }}
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {projectPath && projectInfo && (
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
              <Button
                appearance="primary"
                style={{ width: '100%' }}
                onClick={() => openOutputFolder(projectPath)}
              >
                打开输出目录
              </Button>
            )}
          </div>

          <Field
            validationMessage={`${progress?.message ?? ''} ${buildResult?.path ? `- 保存到 ${buildResult.path} ` : ''}`}
            validationState={
              progress?.stage === 'ERROR'
                ? 'error'
                : progress?.stage === 'COMPLETED'
                  ? 'success'
                  : 'none'
            }
          >
            <ProgressBar
              value={(progress?.percentage ?? 0) / 100}
              color={
                progress?.stage === 'ERROR'
                  ? 'error'
                  : progress?.stage === 'COMPLETED'
                    ? 'success'
                    : 'brand'
              }
            />
          </Field>
        </div>
      )}
    </div>
  )
}

export default App
