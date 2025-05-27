import { buildApk } from './build'

const main = async (): Promise<void> => {
  const projectPath = process.argv[2]

  if (!projectPath) {
    console.error('No project path specified')
    process.exit(1)
  }

  const result = await buildApk(projectPath)
  console.log('')
  console.log(result)
}

main()
