# 部署指南

使用 Caddy 提供 HTTPS 服务（443 端口），不占用 80 端口。前端静态文件统一发布到 `/var/www/<domain>`，避免 `caddy` 用户读取 `/home/...` 目录导致 403。

## 前提条件

- 域名已解析到服务器公网 IP
- 服务器具备 sudo 权限（Node.js/pnpm/Caddy 可按第 1 步安装）
- 443 端口未被占用

## 1. 安装依赖（Ubuntu/Debian）

```bash
sudo apt-get update
sudo apt-get install -y curl ca-certificates gnupg build-essential python3 make g++ openssl

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# pnpm
if command -v corepack >/dev/null 2>&1; then
  corepack enable
  corepack prepare pnpm --activate
else
  npm install -g pnpm
fi

# Caddy（官方稳定源）
# sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
# curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
# curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
# sudo apt-get update
sudo apt-get install -y caddy
```

## 2. 构建项目

```bash
cd ~/Time
pnpm install
pnpm build
```

## 3. 发布前端静态资源

推荐使用仓库自带脚本（会自动同步到 `/var/www/<domain>` 并修正权限）：

```bash
cd ~/Time
bash scripts/sync-client-dist.sh <your-linux-user> your-domain.com
```

如需手动执行，等价命令如下：

```bash
sudo mkdir -p /var/www/your-domain.com
sudo rsync -a --delete /home/<your-linux-user>/Time/packages/client/dist/ /var/www/your-domain.com/
sudo chown -R root:root /var/www/your-domain.com
sudo find /var/www/your-domain.com -type d -exec chmod 755 {} \;
sudo find /var/www/your-domain.com -type f -exec chmod 644 {} \;
```

## 4. 配置 Caddy

编辑 `/etc/caddy/Caddyfile`：

```
{
    # 不开启 HTTP 监听；禁用自动 HTTP->HTTPS 跳转
    auto_https disable_redirects
}

your-domain.com {
    root * /var/www/your-domain.com
    try_files {path} /index.html
    file_server

    reverse_proxy /api/* 127.0.0.1:3000
    # 强制仅使用 TLS-ALPN-01（443）申请证书，不走 HTTP-01（80）
    tls {
        issuer acme {
            disable_http_challenge
        }
    }
    # 若使用已有证书，改为：
    # tls /etc/ssl/your-domain.com/cert.pem /etc/ssl/your-domain.com/key.pem
}
```

> **证书验证说明**：以上配置禁用 HTTP 重定向并显式关闭 HTTP-01 challenge，Caddy 将通过 TLS-ALPN-01 在 443 端口完成 Let's Encrypt 验证。若该方式受限，可手动指定已有证书：
>
> ```
> your-domain.com {
>     tls /etc/ssl/your-domain.com/cert.pem /etc/ssl/your-domain.com/key.pem
>     # ... 其余配置同上
> }
> ```
>
> **403 排查（重点）**：如果 `curl -I https://your-domain.com` 返回 `403`，优先检查静态目录是否可读：
>
> ```bash
> sudo -u caddy test -r /var/www/your-domain.com/index.html && echo ok || echo fail
> sudo journalctl -u caddy -n 100 --no-pager
> ```

## 5. 配置后端服务

创建 `/etc/systemd/system/time-server.service`：

```ini
[Unit]
Description=Time Task Manager API
After=network.target

[Service]
Type=simple
# 改成服务器上实际存在的用户，例如 ubuntu / deploy
User=<your-linux-user>
# 必须使用绝对路径，systemd 不解析 ~
WorkingDirectory=/home/<your-linux-user>/Time/packages/server
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOST=127.0.0.1
Environment=JWT_SECRET= #替换为随机密钥 
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

生成随机密钥：

```bash
openssl rand -hex 32
```

## 6. 启动服务

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now time-server
sudo systemctl enable --now caddy
```

## 7. 防火墙

```bash
sudo ufw allow 443/tcp
# 无需开放 80 端口
```

## 8. 验证

```bash
# 检查后端
systemctl status time-server

# 检查 Caddy
systemctl status caddy

# 测试访问
curl -I https://your-domain.com
curl -I https://your-domain.com/api/health # 按你的后端健康检查路由调整
```

访问 `https://your-domain.com` 即可使用。

## 9. 首次初始化异常排查（无法进入 `/setup`）

如果首页一直跳到登录页，先检查初始化状态接口：

```bash
curl -s https://your-domain.com/api/auth/setup-status
```

- 返回 `{"needsSetup":true}`：应可访问 `/setup`
- 返回 `{"needsSetup":false}`：数据库里已存在管理员账号

若你确认要清空并重新初始化（会删除当前在线库数据）：

```bash
sudo systemctl stop time-server
cd /home/<your-linux-user>/Time/packages/server/data
cp time.db "time.db.bak.$(date +%F_%H%M%S)"
cp -f time.db-wal "time.db-wal.bak.$(date +%F_%H%M%S)" 2>/dev/null || true
cp -f time.db-shm "time.db-shm.bak.$(date +%F_%H%M%S)" 2>/dev/null || true
rm -f time.db time.db-wal time.db-shm
sudo systemctl start time-server
```

重启后再次验证：

```bash
curl -s https://your-domain.com/api/auth/setup-status
```

## 10. 旧库离线清理无效迭代（仅用于备份库）

规则：
- `name` 为空
- `planned_end < planned_start`
- `user_id` 对应用户不存在

示例（先 dry-run，再 apply）：

```bash
cd /home/<your-linux-user>/Time
pnpm --filter @time/server clean:iterations:dry-run -- --db /path/to/time.db.bak
pnpm --filter @time/server clean:iterations:apply -- --db /path/to/time.db.bak
```
