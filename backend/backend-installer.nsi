!define APP_NAME "Connector Backend"
!define INSTALL_DIR "$PROGRAMFILES64\\ConnectorBackend"
!define ICON_FILE "assets\\icon.ico"
!define BACKEND_VBS "$INSTDIR\\obfuscated\\silent_launcher.vbs"
!define UNINSTALL_EXE "$INSTDIR\\Uninstall.exe"

SetCompressor lzma
InstallDir "${INSTALL_DIR}"
OutFile "ConnectorBackendInstaller.exe"
RequestExecutionLevel admin

Icon "${ICON_FILE}"
InstallDirRegKey HKCU "Software\\${APP_NAME}" "Install_Dir"

Page directory
Page instfiles
UninstPage uninstConfirm
UninstPage instfiles

Section "Install"
  ; ✅ Remove existing local DB
  Delete "$APPDATA\\ConnectorBackend\\localDB.sqlite"

  ; ✅ Set installation output path
  SetOutPath "$INSTDIR"

  ; ✅ Copy obfuscated backend folder
  File /r obfuscated\*

  ; ✅ Write Uninstaller
  WriteUninstaller "${UNINSTALL_EXE}"

  ; ✅ Register Uninstaller in Registry
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "UninstallString" "${UNINSTALL_EXE}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "DisplayIcon" "${ICON_FILE}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "Publisher" "Your Company Name"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}" "InstallLocation" "$INSTDIR"

  ; ✅ Create Start Menu and Desktop shortcuts
  CreateDirectory "$SMPROGRAMS\\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\\${APP_NAME}\\Start Backend.lnk" "${BACKEND_VBS}" "$INSTDIR\\obfuscated" "${ICON_FILE}"
  CreateShortcut "$DESKTOP\\${APP_NAME}.lnk" "${BACKEND_VBS}" "$INSTDIR\\obfuscated" "${ICON_FILE}"

  ; ✅ Hide backend folder
  SetFileAttributes "$INSTDIR\\obfuscated" HIDDEN

  ; ✅ Launch backend silently via VBS
  ExecShell "" "${BACKEND_VBS}"
SectionEnd

Section "Uninstall"
  ; ✅ Remove Uninstall registry key
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}"

  ; ✅ Remove local DB
  Delete "$APPDATA\\ConnectorBackend\\localDB.sqlite"

  ; ✅ Remove installed folder
  RMDir /r "$INSTDIR"

  ; ✅ Remove shortcuts
  Delete "$SMPROGRAMS\\${APP_NAME}\\Start Backend.lnk"
  Delete "$DESKTOP\\${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\\${APP_NAME}"
SectionEnd