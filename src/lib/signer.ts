import fs from 'fs/promises'
import { executeCommand } from './exec'
import { getJavaPaths } from './java'
import path from 'path'

export interface Keystore {
  path: string
  keyAlias: string
  password: string
  keyPassword: string
}

export const createKeystore = async (
  keytoolPath: string,
  keystore: Keystore,
  validity: string,
  dname: string
): Promise<Keystore | null> => {
  const hasKeystore = await fs
    .access(keystore.path)
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
        keystore.path,
        '-alias',
        keystore.keyAlias,
        '-keyalg',
        'RSA',
        '-keysize',
        '2048',
        '-validity',
        validity,
        '-storepass',
        keystore.password,
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
      keystore.path,
      '--ks-key-alias',
      keystore.keyAlias,
      '--ks-pass',
      `pass:${keystore.password}`,
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
    path: keystorePath,
    keyAlias: 'androiddebugkey',
    password: 'android',
    keyPassword: 'android'
  }

  const { keytoolPath } = await getJavaPaths(libPath)

  if (!keytoolPath) {
    return null
  }

  return await createKeystore(keytoolPath, keystore, '10000', 'CN=Android Debug,O=Android,C=US')
}
