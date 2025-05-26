import fs from 'fs/promises'
import path from 'path'

export interface ProjectInfo {
  appName: string
  packageName: string
  versionName: string
  versionCode: number
}

export const getGradleProjectInfo = async (projectPath: string): Promise<ProjectInfo | null> => {
  try {
    const result: ProjectInfo = {
      appName: '',
      packageName: '',
      versionCode: 1,
      versionName: '1.0'
    }

    // 从 strings.xml 提取应用名
    try {
      const stringsXmlPath = path.join(
        projectPath,
        'app',
        'src',
        'main',
        'res',
        'values',
        'strings.xml'
      )
      const stringsXmlContent = await fs.readFile(stringsXmlPath, 'utf8')

      const appNameMatch = stringsXmlContent.match(/<string name="app_name">(.*?)<\/string>/)
      if (appNameMatch && appNameMatch[1]) {
        result.appName = appNameMatch[1]
      }
    } catch (stringsErr) {
      console.warn(`Could not read strings.xml: ${stringsErr}`)
    }

    // 从 build.gradle 提取包名和版本信息
    const buildGradlePath = path.join(projectPath, 'app', 'build.gradle')
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

    if (result.appName.length === 0 || result.packageName.length === 0) {
      return null
    }

    return result
  } catch (error) {
    console.error(`Error extracting project info: ${error}`)
    return null
  }
}
