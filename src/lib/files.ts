import fs from 'fs/promises'
import path from 'path'

export const getExecPath = (): string => path.dirname(process.execPath)

export const getLibPath = (): string => path.join(getExecPath(), 'lib')

export const replaceTextInFolder = async (
  folderPath: string,
  oldText: string,
  newText: string,
  fileExtensions = ['.xml', '.json', '.smali']
): Promise<void> => {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true })

    for (const item of items) {
      const itemPath = path.join(folderPath, item.name)

      if (item.isDirectory()) {
        await replaceTextInFolder(itemPath, oldText, newText, fileExtensions)
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase()
        if (fileExtensions.includes(ext)) {
          try {
            const content = await fs.readFile(itemPath, 'utf8')
            if (content.includes(oldText)) {
              const newContent = content.split(oldText).join(newText)
              await fs.writeFile(itemPath, newContent, 'utf8')
              console.log(`Replaced text in: ${itemPath}`)
            }
          } catch (error) {
            console.error(`Error processing file ${itemPath}:`, error)
          }
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${folderPath}:`, error)
  }
}

export const copyDir = async (src: string, dest: string): Promise<void> => {
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
