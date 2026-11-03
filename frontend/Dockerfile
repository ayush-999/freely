FROM node:22-slim

# No git repo in the container, so skip the husky "prepare" hook
ENV HUSKY=0

WORKDIR /app

# Source is bind-mounted by docker-compose; dependencies are installed on start
# into a named volume (see docker-compose.yml).
EXPOSE 5173
CMD ["sh", "-c", "npm install --no-audit --no-fund && npm run dev -w web -- --host 0.0.0.0 --port 5173"]
