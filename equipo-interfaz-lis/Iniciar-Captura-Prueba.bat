@echo off
cd /d "%~dp0"
echo ============================================================
echo   BIOsoft - Prueba de captura HL7 (equipo Mindray / Dymind)
echo ============================================================
echo.
echo Deja esta ventana abierta y visible. Corre una muestra de
echo prueba en el equipo DESPUES de que aparezca el mensaje
echo "Escuchando en el puerto 5150".
echo.
node capturar-hl7.js servidor 5150
echo.
echo ============================================================
echo El programa se detuvo. Si tu NO cerraste esta ventana a
echo proposito, toma una foto de todo lo que dice arriba y
echo enviasela a soporte de BIOsoft.
echo ============================================================
pause
