# Remove .env files from git tracking
git rm --cached .env .env.txt 2>nul

# Add .env files to .gitignore
echo .env >> .gitignore
echo .env.txt >> .gitignore

# Commit the fix
git add .gitignore
git commit -m "Remove secrets from git history"

# Force push to overwrite the bad commit
git push origin main --force
