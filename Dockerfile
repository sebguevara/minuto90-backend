FROM oven/bun:latest

WORKDIR /app

# Copiar archivos de configuración de dependencias
COPY package.json ./
COPY bun.lock ./

# Copiar archivos de Prisma
COPY prisma-minuto/ ./prisma-minuto/
COPY prisma-whoscored/ ./prisma-whoscored/

# Copiar .env para que prisma.config.ts pueda leerlo
COPY .env ./

# Instalar dependencias (sin ejecutar postinstall aún)
RUN bun install --ignore-scripts

# Generar clientes de Prisma manualmente
RUN bunx prisma generate --schema ./prisma-minuto/schema.prisma
RUN bunx prisma generate --schema ./prisma-whoscored/schema.prisma

# Copiar código fuente
COPY src ./src

EXPOSE 4500

CMD ["bun", "run", "src/index.ts"]