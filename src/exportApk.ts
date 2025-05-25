import { spawn } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

export interface ProjectInfo {
  gameName: string
  packageName: string
  versionName: string
  versionCode: number
}

const exportApk = async (
  projectInfo: ProjectInfo,
  gamePath: string,
  iconPath: string,
  outputPath: string,
  libPath: string,
  keystore: Keystore,
) => {
  const { gameName, packageName, versionName, versionCode } = projectInfo

  const apkEditorPath = path.join(libPath, 'APKEditor.jar')
  const webgalTemplateApkPath = path.join(libPath, 'webgal-template.apk')
  const javaPath = await getPortableJavaPath(libPath)
  const { apksignerPath, zipalignPath, hasApksigner, hasZipalign } = await getToolPaths(libPath)

  const buildPath = path.join(outputPath, 'build')

  const apkFileName = [packageName, versionName, versionCode].join('-')
  const unsignedApkPath = path.join(outputPath, `${apkFileName}-unsigned.apk`)
  const alignedApkPath = path.join(outputPath, `${apkFileName}-aligned.apk`)
  const signedApkPath = path.join(outputPath, `${apkFileName}-signed.apk`)
  const idsigPath = signedApkPath + '.idsig'

  const hasKeystore = await fs.access(keystore.path)
    .then(() => true)
    .catch(() => false)

  console.log(`Game name: ${gameName}`)
  console.log(`Package name: ${packageName}`)
  console.log(`Version: ${versionName} (${versionCode})`)

  try {
    try {
      await fs.access(buildPath)
      console.log(`Build directory exists, removing: ${buildPath}`)
      await fs.rm(buildPath, { recursive: true, force: true })
      await fs.rm(unsignedApkPath, { force: true })
      await fs.rm(alignedApkPath, { force: true })
      await fs.rm(signedApkPath, { force: true })
      await fs.rm(idsigPath, { force: true })
    } catch (err) {
      console.log(`Build directory: ${buildPath}`)
    }

    // 反编译apk
    await executeCommand(
      javaPath ?? 'java',
      ['-jar', apkEditorPath, 'd', '-i', webgalTemplateApkPath, '-o', buildPath],
      'APK decompilation'
    )

    console.log('Starting to replace package name and game name...')

    // 替换包名
    await replaceTextInFiles(buildPath, 'com.openwebgal.demo', packageName)
    await replaceTextInFiles(buildPath, 'com/openwebgal/demo', packageName.replace(/\./g, '/'))

    // 替换游戏名
    await replaceTextInFiles(buildPath, '<string name="app_name">WebGAL</string>', `<string name="app_name">${projectInfo.gameName}</string>`)

    // 替换版本信息
    await replaceTextInFiles(buildPath, 'android:versionCode="1"', `android:versionCode="${projectInfo.versionCode}"`)
    await replaceTextInFiles(buildPath, 'android:versionName="1.0"', `android:versionName="${projectInfo.versionName}"`)

    console.log('Replacement completed')

    // 查找实际的包路径
    let sourcePath = ''
    let found = false

    // 可能的路径列表
    const possiblePaths = [
      path.join(buildPath, 'smali', 'classes', 'com', 'openwebgal', 'demo'),
      path.join(buildPath, 'smali', 'classes2', 'com', 'openwebgal', 'demo'),
    ]

    for (const pathToCheck of possiblePaths) {
      try {
        await fs.access(pathToCheck)
        sourcePath = pathToCheck
        found = true
        console.log(`Found package directory at: ${sourcePath}`)
        break
      } catch (err) {
        console.log(`Path not found: ${pathToCheck}`)
      }
    }

    if (!found) {
      throw new Error('Could not find package directory in decompiled APK')
    }

    // 移动文件夹
    const packagePath = packageName.split('.')
    const targetDir = path.dirname(sourcePath).replace(/com(\/|\\)openwebgal/, packagePath.slice(0, -1).join(path.sep))
    const targetPath = path.join(targetDir, packagePath[packagePath.length - 1])

    // 确保目标目录存在
    await fs.mkdir(targetDir, { recursive: true })

    console.log(`Moving files from ${sourcePath} to ${targetPath}`)
    await fs.rename(sourcePath, targetPath)
    console.log('Files moved successfully')

    // 复制游戏资源
    const webgalSrcPath = gamePath
    const webgalDestPath = path.join(buildPath, 'root', 'assets', 'webgal')

    console.log(`Copying game resources from ${webgalSrcPath} to ${webgalDestPath}`)
    await copyDir(webgalSrcPath, webgalDestPath)
    console.log('Game resources copied successfully')

    // 复制图标
    const iconSrcPath = iconPath
    const iconDestPath = path.join(buildPath, 'resources', 'package_1', 'res')

    console.log(`Copying icons from ${iconSrcPath} to ${iconDestPath}`)
    // await copyDir(iconSrcPath, iconDestPath)
    // console.log('Icons copied successfully')

    // 编译apk
    await executeCommand(
      javaPath ?? 'java',
      ['-jar', apkEditorPath, 'b', '-i', buildPath, '-o', unsignedApkPath],
      'APK compilation'
    )

    // 对齐
    hasZipalign &&
      await executeCommand(
        zipalignPath,
        ['-v', '-p', '4', unsignedApkPath, alignedApkPath],
        'APK alignment'
      )

    // 签名
    hasApksigner
      && hasKeystore
      && await signApk(
        apksignerPath,
        keystore,
        alignedApkPath,
        signedApkPath,
      )

    await fs.rm(alignedApkPath, { force: true })

  } catch (err) {
    console.error('Error in main process:', err)
    process.exit(1)
  }
}

export default exportApk

export async function getPortableJavaPath(libDir: string) {
  let javaPath: string | null = null

  switch (process.platform) {
    case 'win32':
      javaPath = path.join(libDir, 'jdk-21', 'bin', 'java.exe')
      break
    case 'darwin':
      javaPath = path.join(libDir, 'jdk-21', 'Contents', 'Home', 'bin', 'java')
      break
    case 'linux':
      javaPath = path.join(libDir, 'jdk-21', 'bin', 'java')
      break
    default:
      console.error('Unsupported operating system:', process.platform)
      process.exit(1)
  }

  const hasPortableJava = await fs.access(javaPath)
    .then(() => true)
    .catch(() => false)

  hasPortableJava && console.log(`Attempting to find Java at: ${javaPath}`)

  return hasPortableJava ? javaPath : null
}

export async function getToolPaths(libPath: string) {
  const platform = process.platform
  let apksignerFileName
  let zipalignFileName

  if (platform === 'win32') { // Windows
    apksignerFileName = 'apksigner.bat'
    zipalignFileName = 'zipalign.exe'
  } else { // macOS, Linux
    apksignerFileName = 'apksigner'
    zipalignFileName = 'zipalign'
  }

  const apksignerPath = path.join(libPath, 'build-tools', apksignerFileName)
  const zipalignPath = path.join(libPath, 'build-tools', zipalignFileName)

  const hasApksigner = await fs.access(apksignerPath)
    .then(() => true)
    .catch(() => false)

  const hasZipalign = await fs.access(zipalignPath)
    .then(() => true)
    .catch(() => false)

  return {
    apksignerPath,
    zipalignPath,
    hasApksigner,
    hasZipalign
  }
}

export async function executeCommand(command: string, args: string[], description = '') {
  console.log(`Executing: ${description || command} ${args.join(' ')}`)

  return new Promise<void>((resolve, reject) => {
    try {
      const process = spawn(command, args)

      process.stdout.on('data', (data) => {
        console.log(data.toString())
      })

      process.stderr.on('data', (data) => {
        console.error(data.toString())
      })

      process.on('close', (code) => {
        if (code !== 0) {
          console.error(`Process exited with code ${code}`)
          reject(new Error(`Process exited with code ${code}`))
        } else {
          console.log(`${description || command} completed successfully`)
          resolve()
        }
      })
    } catch (error) {
      console.error(error)
      reject(error)
    }
  })
}

export async function replaceTextInFiles(
  folderPath: string,
  oldText: string,
  newText: string,
  fileExtensions = ['.xml', '.json', '.smali'],
) {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true })

    for (const item of items) {
      const itemPath = path.join(folderPath, item.name)

      if (item.isDirectory()) {
        await replaceTextInFiles(itemPath, oldText, newText, fileExtensions)
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase()
        if (fileExtensions.includes(ext)) {
          try {
            let content = await fs.readFile(itemPath, 'utf8')
            if (content.includes(oldText)) {
              const newContent = content.split(oldText).join(newText)
              await fs.writeFile(itemPath, newContent, 'utf8')
              console.log(`Replaced text in: ${itemPath}`)
            }
          } catch (err) {
            console.error(`Error processing file ${itemPath}:`, err)
          }
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${folderPath}:`, err)
  }
}

export async function copyDir(src: string, dest: string) {
  await fs.mkdir(dest, { recursive: true })

  const entries = await fs.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath)
    } else {
      await fs.copyFile(srcPath, destPath)
    }
  }
}

export interface Keystore {
  path: string
  keyAlias: string
  password: string
  keyPassword: string
}

export async function createKeystore(keystore: Keystore, validity: string, dname: string) {
  try {
    await fs.access(keystore.path)
    console.log(`Keystore exists at: ${keystore.path}`)
    return
  } catch (err) {
    console.log(`Keystore not found at: ${keystore.path}`)
  }

  await executeCommand(
    'keytool',
    [
      '-genkey',
      '-v',
      '-keystore', keystore.path,
      '-alias', keystore.keyAlias,
      '-keyalg', 'RSA',
      '-keysize', '2048',
      '-validity', validity,
      '-storepass', keystore.password,
      '-keypass', keystore.keyPassword,
      '-dname', dname,
    ],
    'Keystore creation'
  )
}

export async function signApk(
  apksignerPath: string,
  keystore: Keystore,
  alignedApkPath: string,
  signedApkPath: string,
) {
  await executeCommand(
    apksignerPath,
    [
      'sign',
      '--ks', keystore.path,
      '--ks-key-alias', keystore.keyAlias,
      '--ks-pass', `pass:${keystore.password}`,
      '--key-pass', `pass:${keystore.keyPassword}`,
      '--v1-signing-enabled', 'true',
      '--v2-signing-enabled', 'true',
      '--v3-signing-enabled', 'true',
      '--v4-signing-enabled', 'true',
      '--out', signedApkPath,
      alignedApkPath,
    ],
    'APK signing'
  )
}