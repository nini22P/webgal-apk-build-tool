import fs from 'fs/promises'
import path from 'path'
import { getBuildToolsPaths } from './buildTools'
import { getKeyProperties, signApk } from './signer'
import { copyDir, getLibPath, replaceTextInFolder } from './files'
import { getJavaPaths } from './java'
import { executeCommand } from './exec'
import { BuildInfo, BuildResult, ProgressCallback } from './types'
import { getProjectInfo, isValidPackageName } from './project'

const noOpProgress: ProgressCallback = () => {}

export const buildApk = async (
  projectPath: string,
  onProgress: ProgressCallback = noOpProgress
): Promise<BuildResult> => {
  onProgress({ message: '正在初始化...', stage: 'INITIALIZING', percentage: 0 })

  const libPath = getLibPath()

  const projectInfo = await getProjectInfo(projectPath)

  onProgress({ message: '正在检查项目信息...', stage: 'RUNNING', percentage: 5 })

  if (!projectInfo) {
    onProgress({ message: '未找到项目信息', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: ''
    }
  }

  if (projectInfo.appName === null || projectInfo.appName.length === 0) {
    onProgress({ message: '未找到应用名', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'App name not found'
    }
  }

  if (!isValidPackageName(projectInfo.packageName)) {
    onProgress({ message: '包名格式错误', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'Package name is invalid'
    }
  }

  if (projectInfo.packageName === null || projectInfo.packageName.length === 0) {
    onProgress({ message: '未找到包名', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'Package name not found'
    }
  }

  if (projectInfo.versionName === null || projectInfo.versionName.length === 0) {
    onProgress({ message: '未找到版本名', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'Version name not found'
    }
  }

  if (projectInfo.versionCode === null || projectInfo.versionCode === 0) {
    onProgress({ message: '未找到版本号', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'Version code error'
    }
  }

  let keystore = await getKeyProperties(projectPath)

  if (
    !keystore ||
    keystore.storeFile.length === 0 ||
    keystore.storePassword.length === 0 ||
    keystore.keyAlias.length === 0 ||
    keystore.keyPassword.length === 0
  ) {
    onProgress({ message: '未找到签名信息', stage: 'WARNING', percentage: 10 })
    console.error('\nKeystore info missing, skip signing')
    keystore = null
  }

  const buildInfo: BuildInfo = {
    projectInfo,
    projectPath,
    outputPath: path.join(
      projectPath,
      '..',
      '..',
      '..',
      'Exported_Games',
      projectPath.split(path.sep).pop()!,
      'apk'
    ),
    libPath,
    keystore,
    onProgress
  }

  onProgress({ message: '正在准备...', stage: 'RUNNING', percentage: 10 })

  return await build(buildInfo)
}

const build = async ({
  projectInfo,
  projectPath,
  outputPath,
  libPath,
  keystore,
  onProgress
}: BuildInfo): Promise<BuildResult> => {
  const apkEditorPath = path.join(libPath, 'APKEditor.jar')

  try {
    await fs.access(apkEditorPath)
  } catch (error) {
    console.error(`APKEditor not found at: ${apkEditorPath}`)
    onProgress({ message: '未找到 APKEditor', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'APKEditor not found',
      error
    }
  }

  const webgalTemplateApkPaths = [
    path.join(projectPath, '..', '..', '..', 'assets', 'templates', 'webgal-template.apk'),
    path.join(libPath, 'webgal-template.apk')
  ]

  let webgalTemplateApkPath: string | null = null
  for (const path of webgalTemplateApkPaths) {
    try {
      await fs.access(path)
      webgalTemplateApkPath = path
      console.log(`WebGAL template found at: ${webgalTemplateApkPath}`)
      break
    } catch (_error) {
      /* empty */
    }
  }

  if (!webgalTemplateApkPath) {
    console.error(`WebGAL template not found at: ${webgalTemplateApkPath}`)
    onProgress({ message: '未找到 WebGAL 模板', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'WebGAL template not found'
    }
  }

  const { javaPath, keytoolPath } = await getJavaPaths(libPath)

  if (!javaPath || !keytoolPath) {
    console.error('JDK not found')
    onProgress({ message: '未找到 JDK', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'JDK not found'
    }
  }

  const { apksignerPath, zipalignPath } = await getBuildToolsPaths(libPath)

  if (!apksignerPath || !zipalignPath) {
    console.error('Build tools not found')
    onProgress({ message: '未找到构建工具', stage: 'ERROR', percentage: 100 })
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

  console.log('\x1b[96m')
  console.log(`App name: ${appName}`)
  console.log(`Package name: ${packageName}`)
  console.log(`Version: ${versionName} (${versionCode})`)
  console.log(`Output directory: ${outputPath}`)
  console.log('\x1b[0m')

  onProgress({ message: '正在清理编译目录...', stage: 'RUNNING', percentage: 10 })

  try {
    await fs.rm(buildPath, { recursive: true, force: true })
    await fs.rm(unsignedApkPath, { force: true })
    await fs.rm(alignedApkPath, { force: true })
    await fs.rm(signedApkPath, { force: true })
    await fs.rm(idsigPath, { force: true })
  } catch (_) {
    /* empty */
  }

  onProgress({ message: '正在反编译模板 APK...', stage: 'RUNNING', percentage: 20 })

  // 反编译apk
  try {
    await executeCommand(
      javaPath ?? 'java',
      ['-jar', apkEditorPath, 'd', '-i', webgalTemplateApkPath, '-o', buildPath],
      'APK decompilation'
    )
  } catch (error) {
    console.error('APK decompilation failed', error)
    onProgress({ message: 'APK 反编译失败', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'APK decompilation failed',
      error
    }
  }

  console.log('\x1b[93m%s\x1b[0m', '\nStarting to replace assets...\n')

  onProgress({ message: '正在替换资源...', stage: 'RUNNING', percentage: 30 })

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
      projectPath,
      '..',
      '..',
      '..',
      'assets',
      'templates',
      'WebGAL_Template'
    )
    const engineDestPath = path.join(buildPath, 'root', 'assets', 'webgal')

    console.log(`Copying engine from ${engineSrcPath} to ${engineDestPath}`)
    onProgress({ message: '正在复制引擎...', stage: 'RUNNING', percentage: 35 })

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
    const webgalSrcPath = path.join(projectPath, 'game')
    const webgalDestPath = path.join(buildPath, 'root', 'assets', 'webgal', 'game')

    console.log(`Copying game resources from ${webgalSrcPath} to ${webgalDestPath}`)
    onProgress({ message: '正在复制游戏资源...', stage: 'RUNNING', percentage: 40 })

    await copyDir(webgalSrcPath, webgalDestPath)
    console.log('Game resources copied successfully')

    // 复制图标
    const iconsPath = path.join(projectPath, 'icons', 'android')
    const resPath = path.join(buildPath, 'resources', 'package_1', 'res')

    const iconSrcIsExists = await fs
      .access(path.join(iconsPath, 'ic_launcher-playstore.png'))
      .then(() => true)
      .catch(() => false)

    if (iconSrcIsExists) {
      console.log(`Copying icons from ${iconsPath} to ${resPath}`)
      onProgress({ message: '正在复制图标...', stage: 'RUNNING', percentage: 60 })
      await copyDir(iconsPath, resPath)
    } else {
      console.log('Skip copying icons')
    }
  } catch (error) {
    console.error('Error replacing assets', error)
    onProgress({ message: '替换资源失败', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'Error replacing assets',
      error
    }
  }

  onProgress({ message: '正在编译 APK...', stage: 'RUNNING', percentage: 70 })

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
    onProgress({ message: '编译 APK 失败', stage: 'ERROR', percentage: 100 })
    return {
      success: false,
      message: 'Build APK failed',
      error
    }
  }

  onProgress({ message: '正在对齐 APK...', stage: 'RUNNING', percentage: 80 })

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
      onProgress({ message: 'APK 对齐失败', stage: 'ERROR', percentage: 100 })
      return {
        success: false,
        message: 'APK alignment failed',
        error
      }
    }

    await fs.rm(unsignedApkPath, { force: true })
    await fs.rename(alignedApkPath, unsignedApkPath)
  }

  onProgress({ message: '正在签名 APK...', stage: 'RUNNING', percentage: 90 })

  // 签名
  if (javaPath && apksignerPath && keystore) {
    try {
      await signApk(javaPath, apksignerPath, keystore, unsignedApkPath, signedApkPath)
    } catch (error) {
      console.error('APK signing failed', error)
      onProgress({
        message: 'APK 签名失败，请检查签名信息是否正确',
        stage: 'ERROR',
        percentage: 100
      })
      return {
        success: false,
        message: 'APK signing failed',
        error
      }
    }

    await fs.rm(unsignedApkPath, { force: true })

    onProgress({ message: '已完成', stage: 'COMPLETED', percentage: 100 })

    return {
      success: true,
      message: 'Build successful',
      path: signedApkPath
    }
  }

  onProgress({ message: '已完成', stage: 'COMPLETED', percentage: 100 })

  return {
    success: true,
    message: 'Build successful',
    path: unsignedApkPath
  }
}

export default build
