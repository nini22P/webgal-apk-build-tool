export interface BuildInfo {
  projectInfo: ProjectInfo
  projectPath: string
  outputPath: string
  libPath: string
  keystore?: Keystore | null
  onProgress: ProgressCallback
}

export interface BuildResult {
  success: boolean
  message: string
  path?: string
  error?: unknown
}

export type BuildStage =
  | 'NOT_STARTED'
  | 'INITIALIZING'
  | 'RUNNING'
  | 'WARNING'
  | 'ERROR'
  | 'COMPLETED'

export interface ProgressData {
  message: string
  stage: BuildStage
  percentage: number
}

export type ProgressCallback = (progressData: ProgressData) => void

export interface BuildToolsPaths {
  apksignerPath: string | null
  zipalignPath: string | null
}

export interface JavaPaths {
  javaPath: string | null
  keytoolPath: string | null
}

export interface ProjectInfo {
  appName: string
  packageName: string
  versionName: string
  versionCode: number
  path?: string
}

export interface Keystore {
  storeFile: string
  storePassword: string
  keyAlias: string
  keyPassword: string
  validity?: number
  dname?: Dname
}

export interface Dname {
  firstAndLastName?: string
  organizationalUnit?: string
  organization?: string
  cityOrLocality?: string
  stateOrProvince?: string
  countryCode?: string
}
