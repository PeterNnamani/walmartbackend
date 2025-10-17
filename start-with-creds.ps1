# Interactive helper to start the backend with Gmail credentials without storing them in a file.
# Usage: from the backend folder run: .\start-with-creds.ps1
# This prompts for email and app password and sets them only for the running process.

Write-Host "Starting backend with interactive credentials (credentials are NOT stored)."

# Prompt for user (plain text)
$gmailUser = Read-Host -Prompt "GMAIL_USER (your gmail address)"

# Prompt for password securely
$securePass = Read-Host -Prompt "GMAIL_PASS (app password)" -AsSecureString

# Convert secure string to plaintext for the process environment
$ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
$plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($ptr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)

# Set environment variables for this session/process
$env:GMAIL_USER = $gmailUser
$env:GMAIL_PASS = $plainPass

Write-Host "Environment variables set for this session. Starting node server..."

# Start the server (runs in this shell)
node .\api.js

# Zero out plaintext variable (best-effort)
$plainPass = $null

Write-Host "Server exited. Credentials were only set in this session."