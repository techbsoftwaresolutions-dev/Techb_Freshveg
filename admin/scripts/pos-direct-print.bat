@echo off
rem ---------------------------------------------------------------------------
rem  Hosur Basket POS - direct printing
rem
rem  Opens the admin POS in Chrome with "kiosk printing" on: bills go straight
rem  to the Windows DEFAULT printer - no print dialog, no "Save as PDF" file
rem  window. Set the 80mm thermal printer as the default printer first:
rem    Windows Settings > Bluetooth & devices > Printers & scanners >
rem    (thermal printer) > Set as default
rem    (and turn OFF "Let Windows manage my default printer").
rem
rem  Chrome must be fully closed before running this (kiosk printing only
rem  applies to a fresh Chrome), so this uses its own profile folder and can
rem  run next to your normal Chrome windows.
rem
rem  Change POS_URL if the admin runs on another address.
rem ---------------------------------------------------------------------------
set POS_URL=http://localhost:5180/pos

set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe
if not exist "%CHROME%" (
  echo Google Chrome was not found. Install Chrome or edit this file with its path.
  pause
  exit /b 1
)

start "" "%CHROME%" --kiosk-printing --user-data-dir="%LocalAppData%\HosurBasketPOS" --app=%POS_URL%
