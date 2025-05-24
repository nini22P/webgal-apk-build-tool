const fs = require('fs').promises; // 使用 Promise 版本的 fs
const path = require('path');
const { spawn } = require('child_process');

const javaPath = './lib/jdk-21.0.5+11/bin/java.exe';
const apkEditorPath = './lib/APKEditor.jar';
const webgalTemplateApkPath = './lib/webgal-template.apk';
const outputPath = path.join(__dirname, 'output');
const buildPath = path.join(outputPath, 'build');

async function replaceTextInFiles(folderPath, oldText, newText, fileExtensions = ['.xml', '.json', '.smali']) {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(folderPath, item.name);

      if (item.isDirectory()) {
        await replaceTextInFiles(itemPath, oldText, newText, fileExtensions);
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (fileExtensions.includes(ext)) {
          try {
            let content = await fs.readFile(itemPath, 'utf8');
            if (content.includes(oldText)) {
              const newContent = content.split(oldText).join(newText);
              await fs.writeFile(itemPath, newContent, 'utf8');
              console.log(`Replaced text in: ${itemPath} ✅`);
            }
          } catch (err) {
            console.error(`Error processing file ${itemPath}:`, err);
          }
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${folderPath}:`, err);
  }
}

async function executeCommand(command, args, description = '') {
  console.log(`Executing: ${description || command} ${args.join(' ')}`);

  return new Promise((resolve, reject) => {
    try {
      const process = spawn(command, args);

      process.stdout.on('data', (data) => {
        console.log(data.toString());
      });

      process.stderr.on('data', (data) => {
        console.error(data.toString());
      });

      process.on('close', (code) => {
        if (code !== 0) {
          console.error(`Process exited with code ${code}`);
          reject(new Error(`Process exited with code ${code}`));
        } else {
          console.log(`${description || command} completed successfully`);
          resolve();
        }
      });
    } catch (error) {
      console.error(error);
      reject(error);
    }
  });
}

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });

  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function extractProjectInfo(androidProjectPath) {
  try {
    const result = {
      gameName: null,
      packageName: null,
      versionCode: 1,
      versionName: '1.0',
    };

    // 从 strings.xml 提取游戏名
    try {
      const stringsXmlPath = path.join(androidProjectPath, 'app', 'src', 'main', 'res', 'values', 'strings.xml');
      const stringsXmlContent = await fs.readFile(stringsXmlPath, 'utf8');

      const gameNameMatch = stringsXmlContent.match(/<string name="app_name">(.*?)<\/string>/);
      if (gameNameMatch && gameNameMatch[1]) {
        result.gameName = gameNameMatch[1];
      }
    } catch (stringsErr) {
      console.warn(`Could not read strings.xml: ${stringsErr.message}`);
    }

    // 从 build.gradle 提取包名和版本信息
    const buildGradlePath = path.join(androidProjectPath, 'app', 'build.gradle');
    const buildGradleContent = await fs.readFile(buildGradlePath, 'utf8');

    // 提取包名
    const packageMatch = buildGradleContent.match(/applicationId\s+["']([^"']+)["']/);
    if (packageMatch && packageMatch[1]) {
      result.packageName = packageMatch[1];
    }

    // 提取 versionCode
    const versionCodeMatch = buildGradleContent.match(/versionCode\s+(\d+)/);
    if (versionCodeMatch && versionCodeMatch[1]) {
      result.versionCode = parseInt(versionCodeMatch[1], 10);
    }

    // 提取 versionName
    const versionNameMatch = buildGradleContent.match(/versionName\s+["']([^"']+)["']/);
    if (versionNameMatch && versionNameMatch[1]) {
      result.versionName = versionNameMatch[1];
    }

    return result;
  } catch (err) {
    console.error(`Error extracting project info: ${err.message}`);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const androidProjectPath = args[0];

  if (!androidProjectPath) {
    console.error('Usage: node webgal-apk.js <android_project_path> [package_name]');
    process.exit(1);
  }

  const projectInfo = await extractProjectInfo(androidProjectPath);

  const gameName = projectInfo.gameName;
  const packageName = projectInfo.packageName;

  if (!packageName || !gameName) {
    console.error('Could not extract package name or game name from the project');
    process.exit(1);
  }

  console.log(`Game name: ${projectInfo.gameName}`);
  console.log(`Package name: ${packageName}`);
  console.log(`Version: ${projectInfo.versionName} (${projectInfo.versionCode})`);

  try {
    try {
      await fs.access(outputPath);
      console.log(`Output directory exists, removing: ${outputPath}`);
      await fs.rm(outputPath, { recursive: true, force: true });
    } catch (err) {
      console.log(`Output directory does not exist, will create: ${outputPath}`);
    }

    console.log(`Creating output directory: ${outputPath}`);
    await fs.mkdir(outputPath);

    // 反编译apk
    await executeCommand(
      javaPath,
      ['-jar', apkEditorPath, 'd', '-i', webgalTemplateApkPath, '-o', buildPath],
      'APK decompilation'
    );

    console.log('Starting to replace package name and game name...');

    // 替换包名
    await replaceTextInFiles(buildPath, 'com.openwebgal.demo', packageName);
    await replaceTextInFiles(buildPath, 'com/openwebgal/demo', packageName.replace(/\./g, '/'));

    // 替换游戏名
    await replaceTextInFiles(buildPath, '<string name="app_name">WebGAL</string>', `<string name="app_name">${projectInfo.gameName}</string>`);

    // 替换版本信息
    await replaceTextInFiles(buildPath, 'android:versionCode="1"', `android:versionCode="${projectInfo.versionCode}"`);
    await replaceTextInFiles(buildPath, 'android:versionName="1.0"', `android:versionName="${projectInfo.versionName}"`);

    console.log('Replacement completed');

    // 查找实际的包路径
    let sourcePath = '';
    let found = false;

    // 可能的路径列表
    const possiblePaths = [
      path.join(buildPath, 'smali', 'classes', 'com', 'openwebgal', 'demo'),
      path.join(buildPath, 'smali', 'classes2', 'com', 'openwebgal', 'demo'),
    ];

    for (const pathToCheck of possiblePaths) {
      try {
        await fs.access(pathToCheck);
        sourcePath = pathToCheck;
        found = true;
        console.log(`Found package directory at: ${sourcePath}`);
        break;
      } catch (err) {
        console.log(`Path not found: ${pathToCheck}`);
      }
    }

    if (!found) {
      throw new Error('Could not find package directory in decompiled APK');
    }

    // 移动文件夹
    const packagePath = packageName.split('.');
    const targetDir = path.dirname(sourcePath).replace(/com(\/|\\)openwebgal/, packagePath.slice(0, -1).join(path.sep));
    const targetPath = path.join(targetDir, packagePath[packagePath.length - 1]);

    // 确保目标目录存在
    await fs.mkdir(targetDir, { recursive: true });

    console.log(`Moving files from ${sourcePath} to ${targetPath}`);
    await fs.rename(sourcePath, targetPath);
    console.log('Files moved successfully');

    // 复制游戏资源
    const webgalSrcPath = path.join(androidProjectPath, 'app', 'src', 'main', 'assets', 'webgal');
    const webgalDestPath = path.join(buildPath, 'root', 'assets', 'webgal');

    console.log(`Copying game resources from ${webgalSrcPath} to ${webgalDestPath}`);
    await copyDir(webgalSrcPath, webgalDestPath);
    console.log('Game resources copied successfully');

    // 复制图标
    // const iconSrcPath = path.join(androidProjectPath, 'app', 'src', 'main', 'res');
    // const iconDestPath = path.join(buildPath, 'resources', 'package_1', 'res');

    // console.log(`Copying icons from ${iconSrcPath} to ${iconDestPath}`);
    // await copyDir(iconSrcPath, iconDestPath);
    // console.log('Icons copied successfully');

    // 编译apk
    await executeCommand(
      javaPath,
      ['-jar', apkEditorPath, 'b', '-i', buildPath, '-o', path.join(outputPath, `${packageName}.apk`)],
      'APK compilation'
    );

  } catch (err) {
    console.error('Error in main process:', err);
    process.exit(1);
  }
}

main();
