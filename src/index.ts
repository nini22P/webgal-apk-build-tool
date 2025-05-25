import fs from 'fs/promises'
import path from 'path'
import exportApk, { createKeystore, Keystore, ProjectInfo } from './exportApk'

async function extractProjectInfo(androidProjectPath: string): Promise<ProjectInfo | null> {
  try {
    const result: ProjectInfo = {
      gameName: '',
      packageName: '',
      versionCode: 1,
      versionName: '1.0',
    }

    // 从 strings.xml 提取游戏名
    try {
      const stringsXmlPath = path.join(androidProjectPath, 'app', 'src', 'main', 'res', 'values', 'strings.xml')
      const stringsXmlContent = await fs.readFile(stringsXmlPath, 'utf8')

      const gameNameMatch = stringsXmlContent.match(/<string name="app_name">(.*?)<\/string>/)
      if (gameNameMatch && gameNameMatch[1]) {
        result.gameName = gameNameMatch[1]
      }
    } catch (stringsErr) {
      console.warn(`Could not read strings.xml: ${stringsErr}`)
    }

    // 从 build.gradle 提取包名和版本信息
    const buildGradlePath = path.join(androidProjectPath, 'app', 'build.gradle')
    const buildGradleContent = await fs.readFile(buildGradlePath, 'utf8')

    // 提取包名
    const packageMatch = buildGradleContent.match(/applicationId\s+["']([^"']+)["']/)
    if (packageMatch && packageMatch[1]) {
      result.packageName = packageMatch[1]
    }

    // 提取 versionCode
    const versionCodeMatch = buildGradleContent.match(/versionCode\s+(\d+)/)
    if (versionCodeMatch && versionCodeMatch[1]) {
      result.versionCode = parseInt(versionCodeMatch[1], 10)
    }

    // 提取 versionName
    const versionNameMatch = buildGradleContent.match(/versionName\s+["']([^"']+)["']/)
    if (versionNameMatch && versionNameMatch[1]) {
      result.versionName = versionNameMatch[1]
    }

    if (result.gameName.length === 0 || result.packageName.length === 0) {
      return null
    }

    return result
  } catch (err) {
    console.error(`Error extracting project info: ${err}`)
    return null
  }
}

async function main() {
  const executableDir = path.dirname(process.execPath)
  console.log(`Executable directory: ${executableDir}`)
  process.chdir(executableDir)

  const args = process.argv.slice(2)
  const androidProjectPath = args[0]

  if (!androidProjectPath) {
    console.error('Usage: webgal-apk-build-tool <android_project_path>')
    process.exit(1)
  }

  const projectInfo = await extractProjectInfo(androidProjectPath)

  const gameName = projectInfo?.gameName
  const packageName = projectInfo?.packageName
  const versionName = projectInfo?.versionName
  const versionCode = projectInfo?.versionCode

  if (!gameName || !packageName || !versionName || !versionCode) {
    console.error('Could not extract package name or game name from the project')
    process.exit(1)
  }

  const gamePath = path.join(androidProjectPath, 'app', 'src', 'main', 'assets', 'webgal')
  const iconPath = path.join(androidProjectPath, 'app', 'src', 'main', 'res')
  const outputPath = path.join(executableDir, 'output')
  const libPath = path.join(executableDir, 'lib')

  // 测试用
  const debugKeystore: Keystore = {
    path: path.join(executableDir, 'debug.keystore'),
    keyAlias: 'androiddebugkey',
    password: 'android',
    keyPassword: 'android',
  }

  await exportApk(projectInfo, gamePath, iconPath, outputPath, libPath, debugKeystore)

}

main()
