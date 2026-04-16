@echo off
echo ============================================
echo   RoadSense AI - GitHub Push Script
echo ============================================
echo.

REM Check if git is installed
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Git is not installed!
    echo Download from: https://git-scm.com/download/win
    echo Install it, then run this script again.
    pause
    exit /b 1
)

echo Git found. Proceeding...
echo.

REM Initialize git if not already done
if not exist ".git" (
    echo Initializing git repository...
    git init
    git branch -M main
)

REM Add all files
echo Adding all files...
git add .

REM Commit
echo Committing...
git commit -m "RoadSense AI - full stack road damage detection system"

REM Set remote (change URL if needed)
echo Setting remote origin...
git remote remove origin 2>nul
git remote add origin https://github.com/kritak0808/roadsense-ai.git

REM Push
echo Pushing to GitHub...
git push -u origin main

echo.
echo ============================================
echo   Done! Check GitHub for your repository.
echo ============================================
pause
