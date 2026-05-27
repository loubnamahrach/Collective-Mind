#!/bin/bash
# ─── Collective Mind - Quick Start ───────────────────────────
# Usage: ./start.sh

set -e
BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "  🧠 COLLECTIVE MIND"
echo "  Système d'Intelligence Émergente Multi-Agent"
echo -e "${NC}"

# Check ANTHROPIC_API_KEY
if [ -z "$ANTHROPIC_API_KEY" ]; then
  if [ -f "backend/.env" ]; then
    export $(cat backend/.env | grep -v '^#' | xargs)
  fi
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo -e "${YELLOW}⚠ ANTHROPIC_API_KEY non définie."
  echo "  Crée backend/.env avec : ANTHROPIC_API_KEY=sk-ant-..."
  echo -e "${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Clé API détectée${NC}"

# Backend
echo -e "\n${BLUE}► Lancement du backend...${NC}"
cd backend
pip install -r requirements.txt -q
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend: http://localhost:8000${NC}"

cd ..

# Frontend
echo -e "\n${BLUE}► Lancement du frontend...${NC}"
cd frontend
npm install --silent
npm start &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend: http://localhost:3000${NC}"

cd ..

echo -e "\n${GREEN}🚀 Collective Mind est prêt !${NC}"
echo -e "   Frontend : ${BLUE}http://localhost:3000${NC}"
echo -e "   API Docs : ${BLUE}http://localhost:8000/docs${NC}"
echo -e "\n   Ctrl+C pour arrêter\n"

# Cleanup on exit
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Arrêt.'" EXIT
wait
