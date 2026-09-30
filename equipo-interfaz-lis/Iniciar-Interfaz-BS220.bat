@echo off
cd /d "%~dp0"
echo ============================================================
echo   BIOsoft - Interfaz con el equipo Mindray BS-220
echo ============================================================
echo.
echo No cierres esta ventana mientras trabajes con el equipo.
echo Cuando abajo aparezca "Escuchando en el puerto" y
echo "Sesion iniciada", ya puedes correr tus muestras
echo normalmente en el equipo.
echo.
node index-hl7.js config-bs220.json
echo.
echo ============================================================
echo El programa se detuvo. Si tu NO cerraste esta ventana a
echo proposito, toma una foto de todo lo que dice arriba y
echo enviasela a soporte de BIOsoft.
echo ============================================================
pause
