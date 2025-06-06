# Discord Role Memory Bot

A Discord bot that remembers user roles and automatically reassigns them when users rejoin the server.

## Features

- `/index` command to save all current user roles in the server
- Automatically reassigns saved roles when a user rejoins
- The `/index` command response is visible to all server members

## Setup Instructions

1. **Create a Discord Bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Navigate to the "Bot" tab and create a bot
   - Enable the following Privileged Gateway Intents:
     - Server Members Intent
     - Message Content Intent
   - Copy your bot token

2. **Set up MongoDB**
   - Create a MongoDB database (Atlas or local)
   - Get your MongoDB connection URI

3. **Environment Variables**
   - Create a `.env` file with the following variables:
     ```
     DISCORD_TOKEN=your_discord_bot_token
     MONGODB_URI=your_mongodb_connection_string
     ```

4. **Deploy to Vercel**
   - Fork/clone this repository
   - Connect to Vercel
   - Add the environment variables in the Vercel dashboard
   - Deploy

5. **Invite Bot to Your Server**
   - Generate an invite URL from the Discord Developer Portal with the following permissions:
     - `bot` scope
     - `applications.commands` scope
     - Permissions: Manage Roles, Read Messages, Send Messages
   - Open the URL and add the bot to your server

## Usage

- Run `/index` in your server to save all user roles
- When users leave and rejoin, their roles will be automatically reassigned

## Development

To run locally:

```bash
npm install
npm run dev
``` 