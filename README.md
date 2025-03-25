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
#### **2. Install NodeJS Dependencies**  
```sh
npm install
```
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

## Error Handling & Logging
BreakerBot includes an integrated logging mechanism that captures errors and logs them to error.log. If the bot encounters unexpected failures, it will attempt automatic reconnection.

## License
This project is licensed under the MIT License. Feel free to modify and expand its functionality as needed.

## Contributing
We welcome contributions! If you want to improve BreakerBot, submit a pull request or open an issue in the repository.