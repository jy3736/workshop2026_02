@echo off
REM ===========================================================================
REM  AI Agent Workshop (2) - Windows 11 one-command setup (.bat)
REM
REM  Installs: VS Code, the ChatGPT desktop app, and the VS Code extensions
REM  used in Module 1 Part 2 (Codex, GitHub Copilot, Python, Markdown, HTML
REM  live preview, MS Office document preview).
REM
REM  Does NOT create accounts: signing in to the ChatGPT app (Part 1) and
REM  registering a GitHub account / applying for GitHub Education (Part 3)
REM  both require a human in a browser and are covered on the tutorial page.
REM
REM  Safe to re-run (idempotent): already-installed items are skipped.
REM
REM  How to run:
REM    - double-click this file, or
REM    - PowerShell:       & "$HOME\Downloads\module1-setup-windows.bat"
REM    - Command Prompt:   "%USERPROFILE%\Downloads\module1-setup-windows.bat"
REM ===========================================================================

setlocal enabledelayedexpansion
chcp 65001 >nul

set "OK_COUNT=0"
set "FAIL_COUNT=0"

echo.
echo ==============================================
echo  AI Agent Workshop - Windows 11 setup
echo ==============================================
echo.

REM ---- 0. Check winget ----------------------------------------------------
where winget >nul 2>&1
if errorlevel 1 (
  echo [ERROR] winget not found. Install "App Installer" from the Microsoft Store, then re-run this script.
  echo.
  pause
  exit /b 1
)

REM ---- 1. VS Code (winget) -------------------------------------------------
call :install_pkg "Microsoft.VisualStudioCode" "code" "VS Code"

REM ---- 2. ChatGPT desktop app (Microsoft Store) --------------------------
call :install_store_pkg "9PLM9XGG6VKS" "ChatGPT desktop app"

REM ---- 3. Make 'code' resolvable in this window ---------------------------
REM  (batch cannot reload the updated PATH on its own)
set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Microsoft VS Code\bin"

REM ---- 4. VS Code extensions ------------------------------------------------
echo ----------------------------------------------
where code >nul 2>&1
if errorlevel 1 (
  echo [WARN] 'code' not on PATH yet, skipping extensions. Reopen the terminal and run this script again.
  call :mark_fail "VS Code extensions" "'code' not on PATH yet"
) else (
  call :install_ext "openai.chatgpt"
  call :install_ext "GitHub.copilot"
  call :install_ext "ms-python.python"
  call :install_ext "yzhang.markdown-all-in-one"
  call :install_ext "ms-vscode.live-server"
  call :install_ext "cweijan.vscode-office"
)

REM ---- 5. Summary ---------------------------------------------------------
echo.
echo ==============================================
echo  Summary
echo ==============================================
echo   OK:   !OK_COUNT!
echo   FAIL: !FAIL_COUNT!
echo.
if "!FAIL_COUNT!"=="0" (
  echo All done! Close and reopen VS Code, then finish Part 1 ^(ChatGPT app sign-in^) and Part 3 ^(GitHub account + Education^) from the tutorial page.
) else (
  echo !FAIL_COUNT! item^(s^) incomplete. Usually fixed by reopening the terminal and running this script again.
)
echo.
pause
endlocal
exit /b 0

REM ===========================================================================
REM  Subroutines
REM ===========================================================================

:install_pkg
REM  %~1 = winget id, %~2 = verify command, %~3 = display name
echo ----------------------------------------------
where %~2 >nul 2>&1
if not errorlevel 1 (
  call echo [%%~3] already installed, skipping.
  call :mark_ok "%~3" "already installed"
  goto :eof
)
echo [%~3] installing...
winget install --id %~1 --source winget --exact --silent --accept-source-agreements --accept-package-agreements
where %~2 >nul 2>&1
if errorlevel 1 (
  call :mark_fail "%~3" "install reported, command not found yet ^(may need to reopen terminal^)"
) else (
  call :mark_ok "%~3" "installed"
)
goto :eof

:install_ext
REM  %~1 = extension id
echo [extension] %~1 ...
call code --install-extension %~1 --force >nul
if errorlevel 1 ( call :mark_fail "ext: %~1" "install failed" ) else ( call :mark_ok "ext: %~1" "installed" )
goto :eof

:install_store_pkg
REM  %~1 = Microsoft Store product id, %~2 = display name
echo ----------------------------------------------
winget list --id %~1 --source msstore --exact >nul 2>&1
if not errorlevel 1 (
  call :mark_ok "%~2" "already installed"
  goto :eof
)
echo [%~2] installing from Microsoft Store...
winget install --id %~1 --source msstore --accept-source-agreements --accept-package-agreements
if errorlevel 1 (
  call :mark_fail "%~2" "Microsoft Store install failed"
) else (
  call :mark_ok "%~2" "installed"
)
goto :eof

:mark_ok
set /a OK_COUNT+=1
echo   [OK]   %~1 - %~2
goto :eof

:mark_fail
set /a FAIL_COUNT+=1
echo   [FAIL] %~1 - %~2
goto :eof
