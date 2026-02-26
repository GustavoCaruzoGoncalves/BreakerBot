# ViewOnceBot

Bot em Node.js (Baileys) que detecta mídias **viewOnce** (imagem/vídeo/áudio de visualização única) no WhatsApp e as reenvia para um número em DM, com informações de origem (PV ou grupo) e remetente.

## Pré-requisitos

- **Node.js** (v16 ou superior)
- **npm**

## Instalação

```sh
npm install
```

## Configuração

1. Crie um arquivo `.env` na raiz (ou use o gerado pelo `./setup.sh`).
2. Defina o número que receberá as mídias:

```env
VIEWONCE_DM_NUMBER=5511999999999
```

(Apenas dígitos, com DDI.)

## Uso

### Primeira vez (autenticação)

```sh
npm start
```

Escaneie o QR Code no terminal para vincular o WhatsApp.

### Rodar em produção com PM2

Depois de autenticar uma vez:

```sh
npm run server
```

Isso sobe o processo **ViewOnceBot** com PM2.

- **Parar:** `npm run stop`
- **Reiniciar:** `npm run restart`
- **Ver logs:** `npm run logs`

### Iniciar com a máquina (opcional)

```sh
pm2 save
pm2 startup
```

## Scripts

| Script     | Descrição                          |
|-----------|-------------------------------------|
| `npm start`   | Roda o bot (para autenticar ou debug) |
| `npm run server` | Inicia o ViewOnceBot com PM2        |
| `npm run stop`   | Para o ViewOnceBot                  |
| `npm run restart`| Reinicia o ViewOnceBot              |
| `npm run logs`   | Mostra os logs do ViewOnceBot       |

## Licença

ISC.
