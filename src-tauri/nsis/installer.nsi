; OpenChat Custom NSIS Installer Hook
; This file is included by Tauri's NSIS installer
; Checks for Chrome/Chromium and offers to download if not found

!include "LogicLib.nsh"
!include "nsDialogs.nsh"

; Variables
Var ChromeFound
Var DownloadChrome
Var ChromeDialog
Var ChromeCheckbox
Var ChromeLabel1
Var ChromeLabel2

; This function is called by Tauri's installer
Function CheckChrome
  ; Check if Chrome is installed
  StrCpy $ChromeFound "0"
  
  ; Check Chrome paths
  ${If} ${FileExists} "$PROGRAMFILES\Google\Chrome\Application\chrome.exe"
    StrCpy $ChromeFound "1"
  ${ElseIf} ${FileExists} "$PROGRAMFILES64\Google\Chrome\Application\chrome.exe"
    StrCpy $ChromeFound "1"
  ${ElseIf} ${FileExists} "$LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    StrCpy $ChromeFound "1"
  ${ElseIf} ${FileExists} "$PROGRAMFILES\Chromium\Application\chrome.exe"
    StrCpy $ChromeFound "1"
  ${ElseIf} ${FileExists} "$LOCALAPPDATA\Chromium\Application\chrome.exe"
    StrCpy $ChromeFound "1"
  ${ElseIf} ${FileExists} "$PROGRAMFILES\Microsoft\Edge\Application\msedge.exe"
    StrCpy $ChromeFound "1"
  ${ElseIf} ${FileExists} "$PROGRAMFILES (x86)\Microsoft\Edge\Application\msedge.exe"
    StrCpy $ChromeFound "1"
  ${EndIf}
FunctionEnd

; Custom page for Chrome detection
Function ChromeDetectionPage
  Call CheckChrome
  
  ; If Chrome found, skip this page
  ${If} $ChromeFound == "1"
    Abort
  ${EndIf}
  
  ; Create custom dialog
  nsDialogs::Create 1018
  Pop $ChromeDialog
  
  ${If} $ChromeDialog == error
    Abort
  ${EndIf}
  
  ; Title label
  ${NSD_CreateLabel} 0 0 100% 40u "OpenChat benötigt einen Chromium-basierten Browser für erweiterte Web-Funktionen (Web Search, URL Scraping).$\r$\n$\r$\nKein kompatibler Browser wurde gefunden."
  Pop $ChromeLabel1
  
  ; Checkbox for Chrome download
  ${NSD_CreateCheckbox} 10u 50u 100% 15u "&Google Chrome automatisch herunterladen und installieren"
  Pop $ChromeCheckbox
  ${NSD_Check} $ChromeCheckbox
  
  ; Info label
  ${NSD_CreateLabel} 10u 75u 100% 60u "Hinweis: Sie können auch manuell einen der folgenden Browser installieren:$\r$\n$\r$\n  • Google Chrome$\r$\n  • Microsoft Edge$\r$\n  • Chromium$\r$\n$\r$\nOhne Browser funktioniert die Web-Suche nur eingeschränkt."
  Pop $ChromeLabel2
  
  nsDialogs::Show
FunctionEnd

; Handle Chrome download
Function ChromeDetectionPageLeave
  ${NSD_GetState} $ChromeCheckbox $0
  
  ${If} $0 == ${BST_CHECKED}
    DetailPrint "Lade Google Chrome herunter..."
    
    ; Use inetc plugin for better download (if available), otherwise use NSISdl
    inetc::get /CAPTION "Chrome wird heruntergeladen..." /CANCELTEXT "Abbrechen" "https://dl.google.com/chrome/install/latest/chrome_installer.exe" "$TEMP\chrome_installer.exe" /END
    Pop $0
    
    ${If} $0 == "OK"
      DetailPrint "Chrome-Installer heruntergeladen. Starte Installation..."
      
      ; Run Chrome installer
      ExecWait '"$TEMP\chrome_installer.exe" /silent /install' $0
      
      ${If} $0 == 0
        DetailPrint "Chrome erfolgreich installiert!"
        MessageBox MB_ICONINFORMATION "Google Chrome wurde erfolgreich installiert.$\r$\nOpenChat kann jetzt alle Web-Funktionen nutzen."
      ${Else}
        DetailPrint "Chrome-Installation fehlgeschlagen (Exit Code: $0)"
        MessageBox MB_ICONEXCLAMATION "Die Chrome-Installation konnte nicht abgeschlossen werden.$\r$\nSie können Chrome später manuell von https://www.google.com/chrome installieren."
      ${EndIf}
      
      ; Clean up
      Delete "$TEMP\chrome_installer.exe"
    ${Else}
      DetailPrint "Chrome-Download fehlgeschlagen oder abgebrochen"
      MessageBox MB_ICONEXCLAMATION "Der Chrome-Download wurde abgebrochen oder ist fehlgeschlagen.$\r$\nBitte installieren Sie Chrome manuell von https://www.google.com/chrome"
    ${EndIf}
  ${EndIf}
FunctionEnd

; Hook into Tauri's installer
!macro customInstall
  ; Add custom page before installation
  !insertmacro MUI_PAGE_CUSTOM ChromeDetectionPage ChromeDetectionPageLeave
!macroend
