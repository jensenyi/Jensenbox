# GitHub Upload Guide

Recommended repository name:

```text
dachuan-growth-os
```

Recommended visibility:

```text
Public
```

## Before Upload

Do not upload these local files or folders:

```text
.env
.env.local
.env.*
tmp/
.qa/
.tools/
outputs/creative-workshop/
outputs/generated/
data/batches/
data/handoffs/
data/fresh-content/
data/community-items.json
data/creative-workshop-jobs.json
```

Important: if `.env.local` ever reached a public repository, revoke and rotate the key immediately.

## Option A: GitHub Web Upload

Use this if Git is not installed locally.

1. Open [GitHub New Repository](https://github.com/new).
2. Repository name: `dachuan-growth-os`.
3. Set visibility to `Public`.
4. Do not initialize with README, license, or gitignore because this project already has them.
5. Create the repository.
6. Click `uploading an existing file`.
7. Upload the safe project files from this folder, excluding the paths listed above.
8. Commit message:

```text
Initial open source release
```

9. After upload, your public link will look like:

```text
https://github.com/<your-github-username>/dachuan-growth-os
```

## Option B: Git Command Line

Use this after Git is installed and available in PowerShell.

```powershell
cd D:\CodexOutputs\Dachuan_Growth_OS
git init
git add .
git status
git commit -m "Initial open source release"
git branch -M main
git remote add origin https://github.com/<your-github-username>/dachuan-growth-os.git
git push -u origin main
```

## Smoke Test After Upload

Clone the repository into a fresh folder and run:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\tools\server.ps1
```

Open:

```text
http://127.0.0.1:4175/
```

Check:

- Home page loads
- Creative Workshop opens
- Script Workshop opens
- Creative Community opens
- Assets and Review pages open
- Browser console has no fatal errors
