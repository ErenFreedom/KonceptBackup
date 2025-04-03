!define APP_NAME "Connector Backend"
!define APP_EXE "run_backend.bat"
!define INSTALL_DIR "$PROGRAMFILES64\\ConnectorBackend"
!define ICON_FILE "assets\\icon.ico"       ; Optional - use your own .ico

SetCompressor lzma
InstallDir "${INSTALL_DIR}"
OutFile "ConnectorBackendInstaller.exe"
RequestExecutionLevel admin

Icon "${ICON_FILE}"                        ; Installer window icon
InstallDirRegKey HKCU "Software\\${APP_NAME}" "Install_Dir"

Page directory
Page instfiles

Section "Install"
  SetOutPath "$INSTDIR"

  ; ✅ Copy all backend files
  File /r *.*

  ; ✅ Create Start Menu folder
  CreateDirectory "$SMPROGRAMS\\${APP_NAME}"

  ; ✅ Create Start Menu and Desktop shortcuts
  CreateShortcut "$SMPROGRAMS\\${APP_NAME}\\Start Backend.lnk" "$INSTDIR\\${APP_EXE}" "$INSTDIR" "${ICON_FILE}"
  CreateShortcut "$DESKTOP\\${APP_NAME}.lnk" "$INSTDIR\\${APP_EXE}" "$INSTDIR" "${ICON_FILE}"

  ; ✅ Optional: launch backend immediately after install
  ExecShell "" "$INSTDIR\\${APP_EXE}"
SectionEnd