import { spawn, spawnSync } from 'child_process'

export const executeCommand = async (
  command: string,
  args: string[],
  description = ''
): Promise<void> => {
  console.log(
    '\x1b[93m%s\x1b[0m',
    `\n${command} ${args.join(' ')}\n`.replace(
      /((--ksPass|--ksKeyPass|-storepass|-keypass)\s+|(pass:))\S+/g,
      '$1***'
    )
  )

  return new Promise<void>((resolve, reject) => {
    try {
      const process = spawn(command, args)

      process.stdout.on('data', (data) => console.log(data.toString()))

      process.stderr.on('data', (data) => console.error(data.toString()))

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

export const findExecutable = async (command: string): Promise<string | null> => {
  try {
    const process = spawnSync(command)
    if (process.error) {
      return null
    }
    return command
  } catch (_error) {
    return null
  }
}
