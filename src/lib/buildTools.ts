import path from 'path'
import fs from 'fs/promises'
import { findExecutable } from './exec'
import { BuildToolsPaths } from './types'

export const getBuildToolsPaths = async (libPath: string): Promise<BuildToolsPaths> => {
  let apksignerPath: string | null = null
  let zipalignPath: string | null = null

  apksignerPath = await findExecutable('apksigner')
  zipalignPath = await findExecutable('zipalign')

  if (apksignerPath && zipalignPath) {
    return { apksignerPath, zipalignPath }
  }

  const platform = process.platform
  const apksignerFileName = 'apksigner.jar'
  const zipalignFileName = `zipalign${platform === 'win32' ? '.exe' : ''}`

  apksignerPath = path.join(libPath, 'build-tools', 'lib', apksignerFileName)
  zipalignPath = path.join(libPath, 'build-tools', zipalignFileName)

  const hasApksigner = await fs
    .access(apksignerPath)
    .then(() => true)
    .catch(() => false)

  const hasZipalign = await fs
    .access(zipalignPath)
    .then(() => true)
    .catch(() => false)

  return {
    apksignerPath: hasApksigner ? apksignerPath : null,
    zipalignPath: hasZipalign ? zipalignPath : null
  }
}
