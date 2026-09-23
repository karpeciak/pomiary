@echo off
rem Publiczny adres HTTPS dla API (port 3000) - potrzebny aplikacjom na telefonach.
rem Sciezka do ngroka podana wprost, bo npm gubi cudzyslowy przy spacji w nazwie uzytkownika.
set "NGROK=%LOCALAPPDATA%\Microsoft\WindowsApps\ngrok.exe"
if not exist "%NGROK%" set "NGROK=ngrok"
"%NGROK%" http 3000 --url=causation-these-attendee.ngrok-free.dev
