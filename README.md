# **BreakerBot - A Feature-Rich WhatsApp Bot 🤖**  

## **Overview**  
BreakerBot is a powerful and interactive WhatsApp bot designed to enhance user experience with a variety of commands, ranging from productivity tools to engaging entertainment features. Built using [`@whiskeysockets/baileys`](https://github.com/WhiskeySockets/Baileys), it offers a seamless and efficient communication interface while maintaining reliability and stability.  

## **Key Features**  
- **Interactive Commands** – The bot provides multiple interactive commands for different use cases, ensuring an engaging experience for users.  
- **Media Processing** – Supports conversion and generation of images, stickers, and media files directly within WhatsApp.  
- **Entertainment & Fun** – Offers a selection of playful and engaging features designed for user amusement.  
- **AI-Powered Responses** – Integrates intelligent interactions using AI-driven text-based communication.  
- **YouTube Media Downloading** – Fetches and processes audio and video content from YouTube for easy sharing.  
- **Trivia & Mini-Games** – Engages users with games and interactive challenges.  

## **Installation & Setup**  
### **Prerequisites**  
Ensure that you have the following installed on your system:  
- **Node.js** (v16 or later recommended)  
- **npm** or **yarn**   
- **pm2** (Optional, for process management)  

### **Installation Steps**  
#### **1. Clone the Repository**  
```sh
git clone https://github.com/GustavoCaruzoGoncalves/BreakerBot.git
cd BreakerBot
```
#### **2. Run the Setup Script**
```sh
./setup.sh
```
This script installs the project dependencies, sets up **pm2** and generates a `.env` file.
Edit `.env` with your API keys and the admin phone numbers before starting the bot.
#### **3. Run the Bot to authenticate**
```sh
npm start
```
The bot will prompt you with a QR Code on the terminal during its first execution.

#### **4. Runnning the bot in servers or PCs** 

### Without pm2 (seeing logs and messages in console)
```sh
npm start
```

### With pm2 (for unattended use)
```sh
npm run server
```
Only run this command after running and authenticating the bot once with npm start!

### Running the bot automatically when the machine boots
```sh
pm2 start index.js --name BreakerBot
pm2 save
pm2 startup
```

## YouTube Download Configuration

The `!play` and `!playmp4` commands require additional setup to work properly with YouTube.

### 1. Install yt-dlp (system-wide)
```sh
pip3 install -U yt-dlp
```

### 2. Install Deno (JavaScript Runtime)
YouTube requires a JavaScript runtime to solve challenges. Install Deno:

```sh
curl -fsSL https://deno.land/install.sh | sh
```

Add Deno to your PATH permanently:
```sh
echo 'export DENO_INSTALL="/root/.deno"' >> ~/.bashrc
echo 'export PATH="$DENO_INSTALL/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### 3. Export YouTube Cookies
YouTube may block requests without authentication. Export cookies from your browser:

1. Install a browser extension like **"Get cookies.txt LOCALLY"** (Chrome) or **"cookies.txt"** (Firefox)
2. Go to YouTube and make sure you're logged in
3. Click the extension and export cookies to a file named `cookies.txt`
4. Place the `cookies.txt` file in the BreakerBot root directory

### 4. Test the Setup
Verify everything is working:
```sh
yt-dlp --list-formats --cookies cookies.txt --remote-components ejs:github "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

If you see a list of available formats, the setup is complete!

> **Note:** YouTube cookies may expire after a few weeks. If downloads stop working, export fresh cookies from your browser.

## Error Handling & Logging
BreakerBot includes an integrated logging mechanism that captures errors and logs them to error.log. If the bot encounters unexpected failures, it will attempt automatic reconnection.

## License
This project is licensed under the MIT License. Feel free to modify and expand its functionality as needed.

## Contributing
We welcome contributions! If you want to improve BreakerBot, submit a pull request or open an issue in the repository.