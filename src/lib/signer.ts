import fs from 'fs/promises'
import { executeCommand } from './exec'
import { getJavaPaths } from './java'
import path from 'path'
import { Dname, Keystore } from './types'

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

  console.log('Get key properties at: ', keyPropertiesPath)

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

export const dnameToString = (dname: Dname): string | null => {
  const dnameParts: string[] = []

  if (dname.firstAndLastName?.length === 0) return null

  if (dname.firstAndLastName && dname.firstAndLastName.length > 0) {
    dnameParts.push(`CN=${dname.firstAndLastName}`)
  }
  if (dname.organizationalUnit && dname.organizationalUnit.length > 0) {
    dnameParts.push(`OU=${dname.organizationalUnit}`)
  }
  if (dname.organization && dname.organization.length > 0) {
    dnameParts.push(`O=${dname.organization}`)
  }
  if (dname.cityOrLocality && dname.cityOrLocality.length > 0) {
    dnameParts.push(`L=${dname.cityOrLocality}`)
  }
  if (dname.stateOrProvince && dname.stateOrProvince.length > 0) {
    dnameParts.push(`ST=${dname.stateOrProvince}`)
  }
  if (dname.countryCode && dname.countryCode.length > 0) {
    dnameParts.push(`C=${dname.countryCode}`)
  }
  return dnameParts.join(',')
}

export const createKeystore = async (
  keytoolPath: string,
  keystore: Keystore,
  overWrite: boolean = false
): Promise<Keystore | null> => {
  const hasKeystore = await fs
    .access(keystore.storeFile)
    .then(() => true)
    .catch(() => false)

  if (hasKeystore) {
    if (!overWrite) return null
    await fs.rm(keystore.storeFile, { force: true })
  }

  if (!keystore.validity) return null

  const validity = (keystore.validity * 365).toString()

  if (!keystore.dname) return null

  const dname = dnameToString(keystore.dname)

  if (!dname) return null

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
    console.log('Keystore created successfully at:', keystore.storeFile)
  } catch (error) {
    console.error('Keystore creation failed', error)
    return null
  }

  return keystore
}

export const signApk = async (
  javaPath: string,
  uberApkSignerPath: string,
  keystore: Keystore,
  inputPath: string,
  outputPath: string
): Promise<void> => {
  await executeCommand(
    javaPath,
    [
      '-jar',
      uberApkSignerPath,
      '-a',
      inputPath,
      '--out',
      outputPath,
      '--ks',
      keystore.storeFile,
      '--ksAlias',
      keystore.keyAlias,
      '--ksPass',
      keystore.storePassword,
      '--ksKeyPass',
      keystore.keyPassword
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

  return await createKeystore(keytoolPath, keystore)
}
