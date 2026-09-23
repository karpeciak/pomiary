@echo off
rem Buduje app-debug.apk. Katalog tymczasowy z samymi znakami ASCII - sciezka uzytkownika zawiera "l" z kreska,
rem a Java na Windows nie tworzy wtedy lokalnego gniazda ("Unable to establish loopback connection").
cd /d "%~dp0"
if not exist ".tmp" mkdir ".tmp"
set "GRADLE_OPTS=-Djdk.net.unixdomain.tmpdir=%~dp0.tmp -Djava.io.tmpdir=%~dp0.tmp"
set "JAVA_TOOL_OPTIONS=-Djdk.net.unixdomain.tmpdir=%~dp0.tmp -Djava.io.tmpdir=%~dp0.tmp"
call "%~dp0gradlew.bat" assembleDebug
if errorlevel 1 exit /b 1
echo.
echo Gotowe: %~dp0app\build\outputs\apk\debug\app-debug.apk
