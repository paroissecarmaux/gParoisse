param(
    [string]$Message = "Update"
)

# Push script for gParoisse - targets https://github.com/paroissecarmaux/gParoisse.git
# using the blaurens31@gmail.com GitHub account.
#
# The repo-local git identity is already set to blaurens31@gmail.com (see
# `git config --local user.email`), so commits are authored correctly.
# Authentication for the push itself goes through Git Credential Manager:
# the first push opens a browser window to sign in to GitHub. Make sure you
# sign in as blaurens31@gmail.com there. If a different account is already
# cached, open Windows "Credential Manager" (Control Panel) and remove the
# entry for git:https://github.com before running this script, so the
# browser prompt starts fresh.

$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

git status --short
$hasChanges = (git status --porcelain)

if ($hasChanges) {
    git add -A
    git commit -m $Message
} else {
    Write-Host "No local changes to commit - pushing existing commits only."
}

git push -u origin main
