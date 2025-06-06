require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Create user role schema
const userRoleSchema = new mongoose.Schema({
  guildId: String,
  userId: String,
  roles: [String],
  username: String
});

const UserRole = mongoose.model('UserRole', userRoleSchema);

// Discord client setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ]
});

// Register commands
const commands = [
  new SlashCommandBuilder()
    .setName('index')
    .setDescription('Index all users and their roles in the server')
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Register commands when bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  try {
    console.log('Started refreshing application (/) commands.');
    
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'index') {
    await interaction.deferReply({ ephemeral: false }); // Make response visible to everyone
    
    try {
      const guild = interaction.guild;
      const members = await guild.members.fetch();
      let indexCount = 0;
      
      for (const [memberId, member] of members) {
        const roles = member.roles.cache
          .filter(role => role.id !== guild.id) // Filter out @everyone role
          .map(role => role.id);
        
        if (roles.length > 0) {
          // Save or update user roles
          await UserRole.findOneAndUpdate(
            { guildId: guild.id, userId: memberId },
            { 
              guildId: guild.id,
              userId: memberId,
              roles: roles,
              username: member.user.username
            },
            { upsert: true }
          );
          indexCount++;
        }
      }
      
      await interaction.editReply(`Successfully indexed roles for ${indexCount} members.`);
    } catch (error) {
      console.error(error);
      await interaction.editReply('An error occurred while indexing roles.');
    }
  }
});

// Handle member rejoins
client.on('guildMemberAdd', async member => {
  try {
    // Find user's saved roles
    const userRoleData = await UserRole.findOne({ 
      guildId: member.guild.id,
      userId: member.id
    });
    
    if (userRoleData && userRoleData.roles.length > 0) {
      // Add roles back to the user
      await member.roles.add(userRoleData.roles)
        .catch(e => console.error(`Couldn't add roles to ${member.user.tag}: ${e}`));
      
      console.log(`Restored roles for ${member.user.tag}`);
    }
  } catch (error) {
    console.error(`Error restoring roles: ${error}`);
  }
});

// Express server
app.get('/', (req, res) => {
  res.send('Discord Role Memory Bot is running!');
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN); 