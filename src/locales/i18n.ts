import en from './en'
import zhCn from './zhCn'

export interface Language {
  name: string
  code: string
}

export const languages = {
  en: { name: 'English', code: 'en' },
  zhCn: { name: '简体中文', code: 'zh-cn' }
}

export interface Translations {
  title: string
  project_path: string
  select: string
  app_name: string
  package_name: string
  package_name_info: string
  version_name: string
  version_code: string
  version_code_info: string
  keystore_file_path: string
  new: string
  keystore_password: string
  keystore_password_info: string
  key_alias: string
  key_password: string
  build_apk: string
  open_output_folder: string

  create_keystore_dialog_title: string
  validity_years: string
  first_and_last_name: string
  organizational_unit: string
  organization: string
  city_or_locality: string
  state_or_province: string
  country_code: string
  create: string
  cancel: string
  required_field: string
  saved_to: string
  error_opening_folder: string

  initializing: string
  checking_project_info: string
  project_info_not_found: string
  app_name_not_found: string
  package_name_invalid: string
  package_name_not_found: string
  version_name_not_found: string
  version_code_error: string
  keystore_info_missing_skip_signing: string
  preparing: string
  apkeditor_not_found: string
  uber_apk_signer_not_found: string
  webgal_template_not_found: string
  jdk_not_found: string
  cleaning_build_dir: string
  decompiling_template_apk: string
  apk_decompilation_failed: string
  replacing_assets: string
  copying_engine: string
  copying_game_assets: string
  copying_icons: string
  skip_copying_icons: string
  replacing_assets_failed: string
  building_apk: string
  build_apk_failed: string
  aligning_apk: string
  apk_alignment_failed: string
  signing_apk: string
  apk_signing_failed_check_info: string
  completed: string
}

export function getTranslations(language: Language): Translations {
  switch (language.code) {
    case languages.en.code:
      return en
    case languages.zhCn.code:
      return zhCn
    default:
      return en
  }
}
