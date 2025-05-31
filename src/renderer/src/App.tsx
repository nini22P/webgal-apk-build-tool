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
  Menu,
  MenuItem,
  MenuList,
  MenuPopover,
  MenuTrigger,
  Option,
  ProgressBar,
  Text,
  Title3
} from '@fluentui/react-components'
import { bundleIcon, LocalLanguageFilled, LocalLanguageRegular } from '@fluentui/react-icons'
import { version } from '~build/package'
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
import { getTranslations, Language, languages } from '../../locales/i18n'

const LocalLanguageIcon = bundleIcon(LocalLanguageFilled, LocalLanguageRegular)

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

  const [language, setLanguage] = useState<Language>(languages.zhCn)
  const t = useMemo(() => getTranslations(language), [language])

  useLocalStorage('language', languages.zhCn, language, setLanguage)
  useLocalStorage('projectPath', null, projectPath, setProjectPath)

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
    document.title = `${t.title} ${version}`
  }, [t])

  return (
    <div className={styles.app}>
      <div className={styles.container}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 0 0.5rem 0.25rem'
          }}
        >
          <Title3>
            {t.title} {version}
          </Title3>
          <div
            style={{ display: 'flex', flexDirection: 'row', gap: '0.5rem', alignItems: 'center' }}
          >
            <Link
              href="https://github.com/OpenWebGAL/webgal-apk-build-tool"
              title="https://github.com/OpenWebGAL/webgal-apk-build-tool"
              target="_blank"
              style={{ fontWeight: 500 }}
            >
              GitHub
            </Link>
            <Menu positioning={{ autoSize: true }}>
              <MenuTrigger disableButtonEnhancement>
                <Button icon={<LocalLanguageIcon />} appearance="subtle" style={{ minWidth: '0' }}>
                  {language.name}
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItem
                    onClick={() => {
                      setLanguage(languages.zhCn)
                    }}
                  >
                    简体中文
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      setLanguage(languages.en)
                    }}
                  >
                    English
                  </MenuItem>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        </div>
        <Text>{t.project_path}</Text>
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
            {t.select}
          </Button>
        </div>
        {projectPath && (
          <>
            {projectInfo && (
              <>
                <Text>{t.app_name}</Text>
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
                  {t.package_name}
                  <InfoLabel info={t.package_name_info} />
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

                <Text>{t.version_name}</Text>
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
                  {t.version_code}
                  <InfoLabel info={t.version_code_info} />
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
                <Text>{t.keystore_file_path}</Text>
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
                        {t.new}
                      </Button>
                    </DialogTrigger>
                    <DialogSurface>
                      <DialogBody>
                        <DialogTitle>{t.create_keystore_dialog_title}</DialogTitle>
                        <DialogContent className={styles.container}>
                          <Text>
                            {t.keystore_file_path} <span style={{ color: 'red' }}>*</span>
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
                              {t.select}
                            </Button>
                          </div>

                          <Text>
                            {t.keystore_password}{' '}
                            <InfoLabel info={t.keystore_password_info} required />
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
                            {t.key_alias} <span style={{ color: 'red' }}>*</span>
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
                            {t.key_password}
                            <InfoLabel info={t.keystore_password_info} required />
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
                            {t.validity_years} <span style={{ color: 'red' }}>*</span>
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
                            {t.full_name} <span style={{ color: 'red' }}>*</span>
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

                          <Text>{t.organizational_unit}</Text>
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

                          <Text>{t.organization}</Text>
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

                          <Text>{t.city_or_locality}</Text>
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

                          <Text>{t.state_or_province}</Text>
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

                          <Text>{t.country_code}</Text>
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
                            <Button onClick={() => setNewKeystore(emptyKeystore)}>
                              {t.cancel}
                            </Button>
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
                            {t.create}
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
                    {t.select}
                  </Button>
                </div>

                <Text>
                  {t.keystore_password} <InfoLabel info={t.keystore_password_info} />
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

                <Text>
                  {t.key_alias} <span style={{ color: 'red' }}>*</span>
                </Text>
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
                  {t.key_password} <InfoLabel info={t.keystore_password_info} />
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
              {t.build_apk}
            </Button>
            {progress && (
              <Button
                appearance="primary"
                style={{ width: '100%' }}
                onClick={() => openOutputFolder(projectPath)}
              >
                {t.open_output_folder}
              </Button>
            )}
          </div>

          <Field
            validationMessage={`${progress?.message ?? ''} ${buildResult?.path ? `- ${t.saved_to} ${buildResult.path} ` : ''}`}
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
