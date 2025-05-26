import { useMemo, useState } from 'react'
import styles from './app.module.css'
import { Button, Input, Text } from '@fluentui/react-components'

const App = (): React.JSX.Element => {
  const [gamePath, setGamePath] = useState<string | null>(null)
  const [keystorePath, setKeystorePath] = useState<string | null>(null)

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

  const build = async (): Promise<void> => {
    await window.electron.ipcRenderer.invoke('build-apk', gamePath)
  }

  const disableBuild = useMemo(() => !gamePath || gamePath.length === 0, [gamePath])

  return (
    <div className={styles.app}>
      <Text>WebGAL游戏目录</Text>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Input
          type="text"
          style={{ flex: 1 }}
          value={gamePath || ''}
          onChange={(_ev, data) => setGamePath(data.value)}
        />
        <Button
          appearance="primary"
          onClick={async () => {
            const result = await selectFolder()
            setGamePath(result)
          }}
        >
          选择文件夹
        </Button>
      </div>
      {/* <Text>密钥文件</Text>
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Input
          type="text"
          style={{ flex: 1 }}
          value={keystorePath || ''}
          onChange={(_ev, data) => setKeystorePath(data.value)}
        />
        <Button
          appearance="primary"
          onClick={async () => {
            const result = await selectKeystore()
            setKeystorePath(result)
          }}
        >
          选择文件
        </Button>
      </div> */}
      <Button
        appearance="primary"
        onClick={build}
        style={{ width: '100%' }}
        disabled={disableBuild}
      >
        编译APK
      </Button>
    </div>
  )
}

export default App
