@echo off
REM ===============================================
REM Batch script to list .wav files and convert them to .mp3
REM ===============================================

REM Step 1: List all .wav files and save to files.txt
echo Listing all .wav files in the current directory...
dir /b *.wav > files.txt
echo File list saved to files.txt

REM Step 2: Convert each .wav file to .mp3 using ffmpeg
echo Starting conversion of .wav files to .mp3...

REM Loop through each .wav file
for %%f in (*.wav) do (
    REM Get the filename without extension
    set "filename=%%~nf"
    REM Enable delayed variable expansion
    setlocal enabledelayedexpansion
    REM Convert the .wav file to .mp3
    echo Converting "%%f" to "!filename!.mp3"...
    ffmpeg -i "%%f" -codec:a libmp3lame -qscale:a 2 "!filename!.mp3"
    REM End local environment changes
    endlocal
)

echo Conversion completed successfully!
pause
