import fs from 'fs/promises'
import { executeCommand } from './exec'
import { getJavaPaths } from './java'
import path from 'path'
import { Keystore } from './types'

export const getKeyProperties = async (projectPath: string): Promise<Keystore | null> => {
  const keystore: Keystore = {
    storeFile: '',
    storePassword: '',
    keyAlias: '',
    keyPassword: ''
  }

  const keyPropertiesPath = path.join(projectPath, 'key.properties')

  try {
    await fs.access(keyPropertiesPath)
  } catch (_error) {
    console.error(`Key properties not found at: ${keyPropertiesPath}`)
    return keystore
  }

  const keyPropertiesContent = await fs.readFile(keyPropertiesPath, 'utf8')
  const keyPropertiesLines = keyPropertiesContent
    .split('\n')
    .filter((line) => line.trim().length > 0)

  for (const line of keyPropertiesLines) {
    const [key, value] = line.split('=')
    if (key === 'storeFile') {
      keystore.storeFile = value.trim()
    }
    if (key === 'storePassword') {
      keystore.storePassword = value.trim()
    }
    if (key === 'keyAlias') {
      keystore.keyAlias = value.trim()
    }
    if (key === 'keyPassword') {
      keystore.keyPassword = value.trim()
    }
  }

  return keystore
}

export const saveKeyProperties = async (projectPath: string, keystore: Keystore): Promise<void> => {
  try {
    const keyPropertiesPath = path.join(projectPath, 'key.properties')

    console.log('Saving key properties', keyPropertiesPath)

    const keyPropertiesContent = `storeFile=${keystore.storeFile}\nstorePassword=${keystore.storePassword}\nkeyAlias=${keystore.keyAlias}\nkeyPassword=${keystore.keyPassword}`
    await fs.writeFile(keyPropertiesPath, keyPropertiesContent, 'utf8')
  } catch (error) {
    console.error(`Error saving key properties: ${error}`)
  }
}

export const createKeystore = async (
  keytoolPath: string,
  keystore: Keystore,
  validity: string,
  dname: string
): Promise<Keystore | null> => {
  const hasKeystore = await fs
    .access(keystore.storeFile)
    .then(() => true)
    .catch(() => false)

  if (hasKeystore) return keystore

  try {
    await executeCommand(
      keytoolPath ?? 'keytool',
      [
        '-genkey',
        '-v',
        '-keystore',
        keystore.storeFile,
        '-alias',
        keystore.keyAlias,
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        validity,
        '-storepass',
        keystore.storePassword,
        '-keypass',
        keystore.keyPassword,
        '-dname',
        dname
      ],
      'Keystore creation'
    )
  } catch (error) {
    console.error('Keystore creation failed', error)
    return null
  }

  return keystore
}

export const signApk = async (
  javaPath: string,
  apksignerPath: string,
  keystore: Keystore,
  alignedApkPath: string,
  signedApkPath: string
): Promise<void> => {
  await executeCommand(
    javaPath,
    [
      '-jar',
      apksignerPath,
      'sign',
      '--ks',
      keystore.storeFile,
      '--ks-key-alias',
      keystore.keyAlias,
      '--ks-pass',
      `pass:${keystore.storePassword}`,
      '--key-pass',
      `pass:${keystore.keyPassword}`,
      '--v1-signing-enabled',
      'true',
      '--v2-signing-enabled',
      'true',
      '--v3-signing-enabled',
      'true',
      '--v4-signing-enabled',
      'true',
      '--out',
      signedApkPath,
      alignedApkPath
    ],
    'APK signing'
  )
}

export const createDebugKeystore = async (libPath: string): Promise<Keystore | null> => {
  const keystorePath = path.join(libPath, 'debug.keystore')
  const keystore: Keystore = {
    storeFile: keystorePath,
    storePassword: 'android',
    keyAlias: 'androiddebugkey',
    keyPassword: 'android'
  }

  const { keytoolPath } = await getJavaPaths(libPath)

  if (!keytoolPath) {
    return null
  }

  return await createKeystore(keytoolPath, keystore, '10000', 'CN=Android Debug,O=Android,C=US')
}
