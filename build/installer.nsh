; Remove the app's own data folder when the app is uninstalled.
; The ledger and settings live in ~/.freshwater, which electron-builder's
; deleteAppDataOnUninstall does not cover (it only removes %APPDATA%\Freshwater).
; Skipped during an update, so installing a new version keeps the history.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$PROFILE\.freshwater"
  ${endIf}
!macroend
