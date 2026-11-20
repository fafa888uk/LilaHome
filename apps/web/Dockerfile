# syntax=docker/dockerfile:1
# Lila Home v0.1 前端 —— 多阶段构建
# 第一阶段：Node 构建；第二阶段：nginx 静态托管 + SPA fallback。

# ---- 构建阶段 ----
FROM node:24-alpine AS build
WORKDIR /app

# 先拷依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 构建参数：VITE_API_URL（部署时注入；空则前端回退到同主机 :8001）。
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# ---- 运行阶段 ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
