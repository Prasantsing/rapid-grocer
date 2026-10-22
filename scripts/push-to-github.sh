#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${GREEN}   ZapBasket Mobile - Push to Git Repository   ${NC}"
echo -e "${BLUE}==============================================${NC}"

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Error: git is not installed on this system.${NC}"
    exit 1
fi

# Ensure git is initialized
if [ ! -d ".git" ]; then
    echo -e "${YELLOW}Initializing git repository on main branch...${NC}"
    git init -b main
    git config user.name "ZapBasket Developer"
    git config user.email "dev@zapbasket.com"
fi

# Set remote origin if passed as argument
REMOTE_URL="$1"

if [ -n "$REMOTE_URL" ]; then
    echo -e "${BLUE}Setting remote origin to: $REMOTE_URL${NC}"
    git remote remove origin 2>/dev/null || true
    git remote add origin "$REMOTE_URL"
fi

# Check if remote origin is configured
if ! git remote get-url origin &> /dev/null; then
    echo -e "${YELLOW}No git remote 'origin' configured yet.${NC}"
    echo ""
    echo -e "To connect to your GitHub/GitLab repository, run:"
    echo -e "  ${GREEN}npm run git:push https://github.com/YOUR_USERNAME/YOUR_REPO.git${NC}"
    echo "or"
    echo -e "  ${GREEN}bash scripts/push-to-github.sh git@github.com:YOUR_USERNAME/YOUR_REPO.git${NC}"
    echo ""
    echo -e "${BLUE}Staging and committing your local changes first...${NC}"
    git add .
    git commit -m "feat: complete ZapBasket Android mobile & PWA application store ready" 2>/dev/null || echo "Nothing new to commit."
    echo -e "${GREEN}Local commit ready on branch 'main'.${NC}"
    echo -e "Once you create your empty repo on GitHub, push with:"
    echo -e "  ${YELLOW}git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git${NC}"
    echo -e "  ${YELLOW}git push -u origin main${NC}"
    exit 0
fi

# Stage and commit
echo -e "${BLUE}Staging files and checking status...${NC}"
git add .
git commit -m "feat: complete ZapBasket Android mobile & PWA application store ready" 2>/dev/null || echo "Working tree clean, proceeding to push."

# Current remote
CURRENT_ORIGIN=$(git remote get-url origin)
echo -e "${BLUE}Pushing main branch to ${CURRENT_ORIGIN}...${NC}"

git push -u origin main

echo -e "${GREEN}✔ Repository successfully pushed to ${CURRENT_ORIGIN}!${NC}"
