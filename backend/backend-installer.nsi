!define APP_NAME "Connector Backend"
!define APP_EXE "run_backend.bat"
!define INSTALL_DIR "$PROGRAMFILES64\\ConnectorBackend"
!define ICON_FILE "assets\\icon.ico"

SetCompressor lzma
InstallDir "${INSTALL_DIR}"
OutFile "ConnectorBackendInstaller.exe"
RequestExecutionLevel admin

Icon "${ICON_FILE}"
InstallDirRegKey HKCU "Software\\${APP_NAME}" "Install_Dir"

Page directory
Page instfiles

Section "Install"
  ; ✅ Remove previous DB
  Delete "$APPDATA\\ConnectorBackend\\localDB.sqlite"

  SetOutPath "$INSTDIR"

  ; ✅ Copy backend files
  File /r *.*

  ; ✅ Start Menu + Desktop
  CreateDirectory "$SMPROGRAMS\\${APP_NAME}"
  CreateShortcut "$SMPROGRAMS\\${APP_NAME}\\Start Backend.lnk" "$INSTDIR\\${APP_EXE}" "$INSTDIR" "${ICON_FILE}"
  CreateShortcut "$DESKTOP\\${APP_NAME}.lnk" "$INSTDIR\\${APP_EXE}" "$INSTDIR" "${ICON_FILE}"

  ; ✅ Launch backend
  ExecShell "" "$INSTDIR\\${APP_EXE}"
SectionEnd