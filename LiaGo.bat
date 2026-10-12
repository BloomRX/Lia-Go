@echo off
rem ============================================================
rem  Lia Go - automacao de desenvolvimento em um duplo clique
rem  Nao instala nada silenciosamente, nao publica em main e
rem  nao imprime segredo (a senha do banco aparece oculta).
rem ============================================================
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"
set "PYTHONUTF8=1"
chcp 65001 >nul 2>nul

where node >nul 2>nul
if errorlevel 1 (
    echo ERRO: Node.js nao encontrado.
    echo Instale o Node 22 LTS em https://nodejs.org e rode este arquivo de novo.
    set "RC=1"
    goto :fim
)

if not "%~1"=="" goto :comargumento

:menu
echo.
echo ==== LIA GO ====
echo  1  Tudo: banco + testes + relatorio + sincronizar (recomendado)
echo  2  Somente testes e relatorio
echo  3  Desenvolvimento: subir banco, API e app web
echo  4  Subir banco de dados e aplicar migracoes
echo  5  Preparar build Android (exige Android Studio + JDK 21)
echo  6  Sincronizar com o GitHub (commit, rebase e push da branch)
echo  7  Ver relatorios gerados
echo  8  Diagnostico do ambiente (DevKit)
echo  9  Reinstalar dependencias (usar quando algo estiver estranho)
echo  0  Sair
echo.
set /p OPCAO="Escolha: "
if "%OPCAO%"=="1" goto :auto
if "%OPCAO%"=="2" goto :testes
if "%OPCAO%"=="3" goto :dev
if "%OPCAO%"=="4" goto :banco
if "%OPCAO%"=="5" goto :android
if "%OPCAO%"=="6" goto :sincronizar
if "%OPCAO%"=="7" goto :relatorios
if "%OPCAO%"=="8" goto :diagnostico
if "%OPCAO%"=="9" goto :instalar
if "%OPCAO%"=="0" goto :sair
echo Opcao invalida.
goto :menu

:comargumento
if /i "%~1"=="auto" goto :auto
if /i "%~1"=="testes" goto :testes
if /i "%~1"=="dev" goto :dev
if /i "%~1"=="banco" goto :banco
if /i "%~1"=="android" goto :android
if /i "%~1"=="sincronizar" goto :sincronizar
if /i "%~1"=="relatorios" goto :relatorios
if /i "%~1"=="diagnostico" goto :diagnostico
if /i "%~1"=="instalar" goto :instalar
echo Comandos: auto ^| testes ^| dev ^| banco ^| android ^| sincronizar ^| instalar ^| relatorios ^| diagnostico
set "RC=1"
goto :fim

:auto
node "%~dp0tools\dev.mjs" auto
set "RC=%ERRORLEVEL%"
goto :fim

:testes
node "%~dp0tools\dev.mjs" testes
set "RC=%ERRORLEVEL%"
goto :fim

:dev
node "%~dp0tools\dev.mjs" dev
set "RC=%ERRORLEVEL%"
goto :fim

:banco
node "%~dp0tools\dev.mjs" banco
set "RC=%ERRORLEVEL%"
goto :fim

:android
node "%~dp0tools\dev.mjs" android
set "RC=%ERRORLEVEL%"
goto :fim

:sincronizar
node "%~dp0tools\dev.mjs" sincronizar
set "RC=%ERRORLEVEL%"
goto :fim

:relatorios
node "%~dp0tools\dev.mjs" relatorios
set "RC=%ERRORLEVEL%"
goto :fim

:instalar
node "%~dp0tools\dev.mjs" instalar
set "RC=%ERRORLEVEL%"
goto :fim

:diagnostico
call "%~dp0DevKit.bat" diagnose
set "RC=%ERRORLEVEL%"
goto :fim

:sair
set "RC=0"

:fim
if not "%RC%"=="0" echo.
if not "%RC%"=="0" echo O Lia Go terminou com erro. Leia a mensagem acima.
if "%~1"=="" pause
exit /b %RC%
