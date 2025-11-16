import path from 'path'
import fs from 'fs/promises'
import { findExecutable } from './exec'
import { JavaPaths } from './types'

export const getJavaPaths = async (libDir: string): Promise<JavaPaths> => {
  let javaPath: string | null = null
  let keytoolPath: string | null = null

  javaPath = await findExecutable('java')
  keytoolPath = await findExecutable('keytool')

  if (javaPath && keytoolPath) {
    return { javaPath, keytoolPath }
  }

  switch (process.platform) {
    case 'win32':
      javaPath = path.join(libDir, 'jdk', 'bin', 'java.exe')
      keytoolPath = path.join(libDir, 'jdk', 'bin', 'keytool.exe')
      break
    case 'darwin':
      javaPath = path.join(libDir, 'jdk', 'Contents', 'Home', 'bin', 'java')
      keytoolPath = path.join(libDir, 'jdk', 'Contents', 'Home', 'bin', 'keytool')
      break
    case 'linux':
      javaPath = path.join(libDir, 'jdk', 'bin', 'java')
      keytoolPath = path.join(libDir, 'jdk', 'bin', 'keytool')
      break
    default:
      console.error('Unsupported operating system:', process.platform)
      process.exit(1)
  }

  const hasJava = await fs
    .access(javaPath)
    .then(() => true)
    .catch(() => false)

  const hasKeytool = await fs
    .access(keytoolPath)
    .then(() => true)
    .catch(() => false)

  return {
    javaPath: hasJava ? javaPath : null,
    keytoolPath: hasKeytool ? keytoolPath : null
  }
}
