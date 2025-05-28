# WebGAL APK Build Tool

## 如何使用

选择 WebGAL Terre 编辑器 `public/games` 下的游戏项目文件夹，会自动读取 `<游戏文件夹>/game/config.txt` 中的项目信息和 `<游戏文件夹>/key.properties` 中的签名信息，如果修改了条目会自动同步到文件中。

填写好项目信息和签名信息后，点击 `编译APK` 按钮即可开始编译。

## 如何构建

```bash
npm run build:unpack
npm run download-lib
```
