import * as path from 'path'
import * as fs from 'fs/promises'
import fetch from 'node-fetch'
import extract from 'extract-zip'

type Platform = 'windows' | 'mac' | 'linux'
interface DownloadableFile {
  url: string
  fileName: string
}

let platform: Platform

switch (process.platform) {
  case 'win32':
    platform = 'windows'
    console.log('Detected Platform:', platform)
    break
  case 'darwin':
    platform = 'mac'
    console.log('Detected Platform:', platform)
    break
  case 'linux':
    platform = 'linux'
    console.log('Detected Platform:', platform)
    break
  default:
    console.error('Unsupported operating system:', process.platform)
    process.exit(1)
}

async function downloadFile(url: string, destPath: string): Promise<void> {
  console.log(`Download ${url} to ${destPath}`)
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await fs.writeFile(destPath, buffer)
    console.log(`Successfully downloaded ${url} to ${destPath}`)
  } catch (error) {
    console.error(`Error downloading file from ${url}:`, error)
    throw error
  }
}

async function downloadFiles(files: DownloadableFile[], destDir: string): Promise<void> {
  for (const file of files) {
    try {
      console.log(`Downloading ${file.url} to ${path.join(destDir, file.fileName)}`);
      await downloadFile(file.url, path.join(destDir, file.fileName));
    } catch (error) {
      console.error(`Error downloading file from ${file.url}. Aborting sequence.`, error);
      throw error;
    }
  }
}

async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true })
    console.log(`Ensured directory exists: ${dirPath}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      console.error(`Error ensuring directory ${dirPath}:`, error)
      throw error
    }
  }
}

async function downloadJDK(destDir: string): Promise<void> {
  const jdkUrl = `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.7%2B6/OpenJDK21U-jdk_x64_${platform}_hotspot_21.0.7_6.${platform === 'windows' ? 'zip' : 'tar.gz'}`
  const jdkFileName = `jdk-21.${platform === 'windows' ? 'zip' : 'tar.gz'}`
  const jdkDestPath = path.join(destDir, jdkFileName)

  await downloadFile(jdkUrl, jdkDestPath)
  await extractZip(jdkDestPath, destDir)
  await fs.rename(path.join(destDir, `jdk-21.0.7+6`), path.join(destDir, 'jdk-21'))
  await fs.rm(jdkDestPath)
}

async function downloadBuildTools(destDir: string): Promise<void> {
  const buildToolsUrl = `https://dl.google.com/android/repository/build-tools_r36_${platform}.zip`
  const buildToolsFileName = 'build-tools.zip'
  const buildToolsDestPath = path.join(destDir, buildToolsFileName)

  await downloadFile(buildToolsUrl, buildToolsDestPath)
  await extractZip(buildToolsDestPath, destDir)
  await fs.rename(path.join(destDir, 'android-16'), path.join(destDir, 'build-tools'))
  await fs.rm(buildToolsDestPath)
}

async function extractZip(zipPath: string, destDir: string): Promise<void> {
  try {
    await extract(zipPath, { dir: destDir })
    console.log('Extraction complete')
  } catch (err) {
    console.error('Error extracting zip:', err)
  }
}

async function main() {
  const libDir = path.join(__dirname, 'dist', 'lib')
  await ensureDir(libDir)

  const files: DownloadableFile[] = [
    {
      url: 'https://github.com/REAndroid/APKEditor/releases/download/V1.4.3/APKEditor-1.4.3.jar',
      fileName: 'APKEditor.jar',
    },
    {
      url: 'https://github.com/OpenWebGAL/WebGAL-Android/releases/latest/download/webgal-template.apk',
      fileName: 'webgal-template.apk',
    },
  ]

  await downloadFiles(files, libDir)
  await downloadBuildTools(libDir)
  await downloadJDK(libDir)

  console.log('All files processed in sequence.');
}

main()