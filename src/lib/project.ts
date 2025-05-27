import fs from 'fs/promises'
import path from 'path'
import { ProjectInfo } from './types'

export const isValidPackageName = (packageName: string): boolean => {
  const regex = /^(?=[a-z0-9])(?=.*\.)[a-z0-9_.]*[a-z0-9]$/
  return regex.test(packageName)
}

export const getProjectInfo = async (projectPath: string): Promise<ProjectInfo | null> => {
  try {
    const projectInfo: ProjectInfo = {
      appName: '',
      packageName: '',
      versionName: '1.0',
      versionCode: 1
    }

    const configPath = path.join(projectPath, 'game', 'config.txt')
    const configContent = await fs.readFile(configPath, 'utf8')
    const configLines = configContent
      .split('\n')
      .map((line) => line.replace(/;$/gi, ''))
      .filter((line) => line.trim().length > 0)

    for (const line in configLines) {
      const [key, value] = configLines[line].split(':')
      if (key.toLocaleLowerCase() === 'game_name') {
        projectInfo.appName = value.trim()
      }
      if (key.toLocaleLowerCase() === 'package_name') {
        projectInfo.packageName = value.trim()
      }
      if (key.toLocaleLowerCase() === 'version_name') {
        projectInfo.versionName = value.trim()
      }
      if (key.toLocaleLowerCase() === 'version_code') {
        projectInfo.versionCode = Number(value.trim()) || 1
      }
    }

    console.log('Get project info', projectInfo)

    return projectInfo
  } catch (error) {
    console.error(`Error getting project info: ${error}`)
    return null
  }
}

export const saveProjectInfo = async (
  projectPath: string,
  projectInfo: ProjectInfo
): Promise<void> => {
  console.log('Saving project info', projectInfo)

  try {
    const configPath = path.join(projectPath, 'game', 'config.txt')
    const configContent = await fs.readFile(configPath, 'utf8')
    const configLines = configContent
      .split('\n')
      .map((line) => line.replace(/;$/gi, ''))
      .filter((line) => line.trim().length > 0)

    const configMap = new Map<string, string>()

    for (const line of configLines) {
      const [key, value] = line.split(':')
      configMap.set(key.trim(), value.trim())
    }

    configMap.set('Game_name', projectInfo.appName)
    configMap.set('Package_name', projectInfo.packageName)
    configMap.set('Version_name', projectInfo.versionName)
    configMap.set('Version_code', projectInfo.versionCode.toString())

    const newConfigContent = Array.from(configMap.entries())
      .map(([key, value]) => `${key}:${value};`)
      .join('\n')

    await fs.writeFile(configPath, newConfigContent, 'utf8')
  } catch (error) {
    console.error(`Error saving project info: ${error}`)
  }
}

export const getGradleProjectInfo = async (projectPath: string): Promise<ProjectInfo | null> => {
  try {
    const projectInfo: ProjectInfo = {
      appName: '',
      packageName: '',
      versionName: '1.0',
      versionCode: 1
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
        projectInfo.appName = appNameMatch[1]
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
      projectInfo.packageName = packageMatch[1]
    }

    // 提取 versionCode
    const versionCodeMatch = buildGradleContent.match(/versionCode\s+(\d+)/)
    if (versionCodeMatch && versionCodeMatch[1]) {
      projectInfo.versionCode = parseInt(versionCodeMatch[1], 10)
    }

    // 提取 versionName
    const versionNameMatch = buildGradleContent.match(/versionName\s+["']([^"']+)["']/)
    if (versionNameMatch && versionNameMatch[1]) {
      projectInfo.versionName = versionNameMatch[1]
    }

    if (projectInfo.appName.length === 0 || projectInfo.packageName.length === 0) {
      return null
    }

    return projectInfo
  } catch (error) {
    console.error(`Error extracting project info: ${error}`)
    return null
  }
}
