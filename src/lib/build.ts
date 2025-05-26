import fs from 'fs/promises'
import path from 'path'
import { getBuildToolsPaths } from './buildTools'
import { Keystore, signApk } from './signer'
import { copyDir, getLibPath, replaceTextInFolder } from './files'
import { getJavaPaths } from './java'
import { executeCommand } from './exec'
import { ProjectInfo } from './project'

export interface BuildInfo {
  projectInfo: ProjectInfo
  gamePath: string
  outputPath: string
  libPath: string
  keystore?: Keystore | null
}

export interface Result {
  success: boolean
  message: string
  error?: unknown
}

export const buildApk = async (gamePath: string): Promise<Result> => {
  const libPath = getLibPath()
  const buildInfo: BuildInfo = {
    projectInfo: {
      appName: 'WebGAL',
      packageName: 'com.webgal.game',
      versionName: '1.0',
      versionCode: 1
    },
    gamePath,
    outputPath: path.join(gamePath, '..', '..', '..', 'Exported_Games'),
    libPath,
    keystore: null
  }
  console.log(buildInfo)
  return await build(buildInfo)
}

const build = async ({
  projectInfo,
  gamePath,
  outputPath,
  libPath,
  keystore
}: BuildInfo): Promise<Result> => {
  const apkEditorPath = path.join(libPath, 'APKEditor.jar')

  try {
    await fs.access(apkEditorPath)
  } catch (error) {
    console.error(`APKEditor not found at: ${apkEditorPath}`)
    return {
      success: false,
      message: 'APKEditor not found',
      error
    }
  }

  const webgalTemplateApkPath = path.join(libPath, 'webgal-template.apk')

  try {
    await fs.access(webgalTemplateApkPath)
  } catch (error) {
    console.error(`WebGAL template not found at: ${webgalTemplateApkPath}`)
    return {
      success: false,
      message: 'WebGAL template not found',
      error
    }
  }

  const { javaPath, keytoolPath } = await getJavaPaths(libPath)

  if (!javaPath || !keytoolPath) {
    console.error('JDK not found')
    return {
      success: false,
      message: 'JDK not found'
    }
  }

  const { apksignerPath, zipalignPath } = await getBuildToolsPaths(libPath)

  if (!apksignerPath || !zipalignPath) {
    console.error('Build tools not found')
    return {
      success: false,
      message: 'Build tools not found'
    }
  }

  const buildPath = path.join(outputPath, 'build')

  const { appName, packageName, versionName, versionCode } = projectInfo

  const apkFileName = [packageName, versionName, `build${versionCode}`].join('-')
  const unsignedApkPath = path.join(outputPath, `${apkFileName}-unsigned.apk`)
  const alignedApkPath = path.join(outputPath, `${apkFileName}-aligned.apk`)
  const signedApkPath = path.join(outputPath, `${apkFileName}-signed.apk`)
  const idsigPath = signedApkPath + '.idsig'

  console.log(`App name: ${appName}`)
  console.log(`Package name: ${packageName}`)
  console.log(`Version: ${versionName} (${versionCode})`)
  console.log(`Output directory: ${outputPath}`)
  console.log('')

  try {
    await fs.rm(buildPath, { recursive: true, force: true })
    await fs.rm(unsignedApkPath, { force: true })
    await fs.rm(alignedApkPath, { force: true })
    await fs.rm(signedApkPath, { force: true })
    await fs.rm(idsigPath, { force: true })
  } catch (_) {
    /* empty */
  }

  // 反编译apk
  try {
    await executeCommand(
      javaPath ?? 'java',
      ['-jar', apkEditorPath, 'd', '-i', webgalTemplateApkPath, '-o', buildPath],
      'APK decompilation'
    )
  } catch (error) {
    console.error('APK decompilation failed', error)
    return {
      success: false,
      message: 'APK decompilation failed',
      error
    }
  }

  console.log('Starting to replace assets...')

  try {
    // 替换包名
    await replaceTextInFolder(buildPath, 'com.openwebgal.demo', packageName)
    await replaceTextInFolder(buildPath, 'com/openwebgal/demo', packageName.replace(/\./g, '/'))

    // 替换游戏名
    await replaceTextInFolder(
      buildPath,
      '<string name="app_name">WebGAL</string>',
      `<string name="app_name">${projectInfo.appName}</string>`
    )

    // 替换版本信息
    await replaceTextInFolder(
      buildPath,
      'android:versionCode="1"',
      `android:versionCode="${projectInfo.versionCode}"`
    )
    await replaceTextInFolder(
      buildPath,
      'android:versionName="1.0"',
      `android:versionName="${projectInfo.versionName}"`
    )

    console.log('Replacement completed')

    // 查找实际的包路径
    let sourcePath = ''
    let found = false

    // 可能的路径列表
    const possiblePaths = [
      path.join(buildPath, 'smali', 'classes', 'com', 'openwebgal', 'demo'),
      path.join(buildPath, 'smali', 'classes2', 'com', 'openwebgal', 'demo')
    ]

    for (const pathToCheck of possiblePaths) {
      try {
        await fs.access(pathToCheck)
        sourcePath = pathToCheck
        found = true
        console.log(`Found package directory at: ${sourcePath}`)
        break
      } catch (_error) {
        /* empty */
      }
    }

    if (!found) {
      console.error('Could not find package directory in decompiled APK')
      return {
        success: false,
        message: 'Could not find package directory in decompiled APK'
      }
    }

    // 移动文件夹
    const packagePath = packageName.split('.')
    const targetDir = path
      .dirname(sourcePath)
      .replace(/com(\/|\\)openwebgal/, packagePath.slice(0, -1).join(path.sep))
    const targetPath = path.join(targetDir, packagePath[packagePath.length - 1])

    // 确保目标目录存在
    await fs.mkdir(targetDir, { recursive: true })

    console.log(`Moving files from ${sourcePath} to ${targetPath}`)
    await fs.rename(sourcePath, targetPath)
    console.log('Files moved successfully')

    // 复制引擎

    const engineSrcPath = path.join(
      gamePath,
      '..',
      '..',
      '..',
      'assets',
      'templates',
      'WebGAL_Template'
    )
    const engineDestPath = path.join(buildPath, 'root', 'assets', 'webgal')

    console.log(`Copying engine from ${engineSrcPath} to ${engineDestPath}`)
    await copyDir(engineSrcPath, engineDestPath)
    console.log('Engine copied successfully')

    // 删除不需要的文件
    await fs.rm(path.join(engineDestPath, 'game'), { recursive: true, force: true })
    await fs.rm(path.join(engineDestPath, 'webgal-serviceworker.js'), {
      recursive: true,
      force: true
    })
    await fs.rm(path.join(engineDestPath, 'icons'), { recursive: true, force: true })

    // 复制游戏资源
    const webgalSrcPath = path.join(gamePath, 'game')
    const webgalDestPath = path.join(buildPath, 'root', 'assets', 'webgal', 'game')

    console.log(`Copying game resources from ${webgalSrcPath} to ${webgalDestPath}`)
    await copyDir(webgalSrcPath, webgalDestPath)
    console.log('Game resources copied successfully')

    // 复制图标
    const iconsPath = path.join(gamePath, 'icons', 'android')
    const resPath = path.join(buildPath, 'resources', 'package_1', 'res')

    const iconSrcIsExists = await fs
      .access(path.join(iconsPath, 'ic_launcher-playstore.png'))
      .then(() => true)
      .catch(() => false)

    if (iconSrcIsExists) {
      console.log(`Copying icons from ${iconsPath} to ${resPath}`)
      await copyDir(iconsPath, resPath)
    } else {
      console.log('Skip copying icons')
    }
  } catch (error) {
    console.error('Error replacing assets', error)
    return {
      success: false,
      message: 'Error replacing assets',
      error
    }
  }

  // 编译apk
  try {
    await executeCommand(
      javaPath ?? 'java',
      ['-jar', apkEditorPath, 'b', '-i', buildPath, '-o', unsignedApkPath],
      'Build APK'
    )

    // console.log('Cleaning build path')
    // await fs.rm(buildPath, { recursive: true, force: true })
  } catch (error) {
    console.error('Build APK failed', error)
    return {
      success: false,
      message: 'Build APK failed',
      error
    }
  }

  // 对齐
  if (zipalignPath) {
    try {
      await executeCommand(
        zipalignPath,
        ['-v', '-p', '4', unsignedApkPath, alignedApkPath],
        'APK alignment'
      )
    } catch (error) {
      console.error('APK alignment failed', error)
      return {
        success: false,
        message: 'APK alignment failed',
        error
      }
    }

    await fs.rm(unsignedApkPath, { force: true })
    await fs.rename(alignedApkPath, unsignedApkPath)
  }

  // 签名
  if (javaPath && apksignerPath && keystore) {
    try {
      await signApk(javaPath, apksignerPath, keystore, unsignedApkPath, signedApkPath)
    } catch (error) {
      console.error('APK signing failed', error)
      return {
        success: false,
        message: 'APK signing failed',
        error
      }
    }

    await fs.rm(unsignedApkPath, { force: true })
  }

  return {
    success: true,
    message: 'Build successful'
  }
}

export default build
