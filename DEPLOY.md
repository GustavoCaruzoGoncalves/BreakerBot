# Deploy em VPS - BreakerBot

## Pré-requisitos
- Node.js 18+
- PM2: `npm install -g pm2`
- Nginx (opcional, para proxy reverso)

## 1. Configurar o Bot + API

```bash
cd BreakerBot
cp .env.example .env
# Edite o .env com suas configurações
npm install
npm run server  # Inicia bot + API com PM2
```

## 2. Configurar o WebApp

```bash
cd BreakerBotWebApp
cp .env.example .env.local
# Edite .env.local com a URL da API
npm install
npm run build
npm run server  # Inicia com PM2
```

## Variáveis Importantes

### API (.env)
- `API_PORT`: Porta da API (padrão: 3001)
- `API_HOST`: Host da API (padrão: 0.0.0.0)
- `CORS_ORIGINS`: URLs do frontend separadas por vírgula (ex: https://app.seudominio.com)
- `NODE_ENV`: Ambiente (production/development)

### WebApp (.env.local)
- `NEXT_PUBLIC_API_URL`: URL completa da API (ex: https://api.seudominio.com)

## Exemplo Nginx (Proxy Reverso)

```nginx
# API
server {
    listen 80;
    server_name api.seudominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# WebApp
server {
    listen 80;
    server_name app.seudominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## SSL com Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.seudominio.com -d app.seudominio.com
```

## Comandos PM2 Úteis

```bash
pm2 list              # Lista processos
pm2 logs              # Ver logs de todos
pm2 logs BreakerBot   # Logs do bot
pm2 monit             # Monitor em tempo real
pm2 save              # Salvar configuração atual
pm2 startup           # Configurar início no boot
pm2 restart all       # Reiniciar tudo
```

## Portas Padrão

| Serviço | Porta |
|---------|-------|
| API     | 3001  |
| WebApp  | 3000  |

## Verificar Status

```bash
# API
curl http://localhost:3001/api/health

# WebApp
curl http://localhost:3000
```
