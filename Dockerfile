FROM oven/bun:latest

WORKDIR /app

# dependencies
COPY package.json bun.lock ./
RUN bun install

# copy prisma schema and generate client
COPY prisma ./prisma
RUN bun run db:generate

# copying rest of application
COPY . .

EXPOSE 8080

CMD ["bun", "start"]