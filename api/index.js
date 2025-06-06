require('dotenv').config();
const express = require('express');
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
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
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Register commands
const commands = [
  new SlashCommandBuilder()
    .setName('index')
    .setDescription('Index all users and their roles in the server')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageRoles)
    .toJSON()
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Function to register commands to a specific guild
async function registerCommandsToGuild(guildId) {
  try {
    console.log(`Registering commands to guild ID: ${guildId}`);
    
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, guildId),
      { body: commands }
    );
    
    console.log(`Successfully registered commands to guild ID: ${guildId}`);
    return true;
  } catch (error) {
    console.error(`Error registering commands to guild ${guildId}:`, error);
    return false;
  }
}

// Register commands when bot is ready
client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  
  try {
    console.log('Started refreshing application (/) commands.');
    
    // Get all guilds the bot is in
    const guilds = client.guilds.cache;
    
    // Register commands to each guild for faster updates (instead of global registration)
    for (const [guildId, guild] of guilds) {
      console.log(`Registering commands to guild: ${guild.name} (${guildId})`);
      
      await registerCommandsToGuild(guildId);
    }
    
    console.log('Successfully registered commands to all guilds.');
    
    // Also register globally (takes up to an hour to propagate)
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    
    console.log('Also registered commands globally.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
});

// Handle slash commands
client.on('interactionCreate', async interaction => {
  console.log(`Received interaction: ${interaction.type} - ${interaction.id}`);
  
  // Check if the interaction is a valid command
  if (!interaction.isChatInputCommand()) {
    console.log('Not a chat input command interaction');
    return;
  }

  const { commandName } = interaction;
  console.log(`Command received: ${commandName}`);

  if (commandName === 'index') {
    try {
      console.log('Starting index command execution');
      
      // Always respond immediately to avoid "application did not respond" error
      // We'll edit this response later with the results
      await interaction.reply({ 
        content: 'Indexing user roles... This may take a moment.',
        ephemeral: false
      });
      console.log('Initial reply sent');
      
      const guild = interaction.guild;
      console.log(`Guild: ${guild.name} (${guild.id})`);
      
      const members = await guild.members.fetch();
      console.log(`Fetched ${members.size} members`);
      
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
          if (indexCount % 10 === 0) {
            console.log(`Indexed ${indexCount} members so far...`);
          }
        }
      }
      
      const replyMessage = `Successfully indexed roles for ${indexCount} members.`;
      console.log(`Sending final reply: ${replyMessage}`);
      await interaction.editReply(replyMessage);
      console.log('Final reply sent successfully');
    } catch (error) {
      console.error('Error in index command:', error);
      // Try to respond even if there was an error
      try {
        if (interaction.replied) {
          await interaction.editReply('An error occurred while indexing roles. Check the logs for details.');
        } else if (interaction.deferred) {
          await interaction.editReply('An error occurred while indexing roles. Check the logs for details.');
        } else {
          await interaction.reply({ 
            content: 'An error occurred while indexing roles. Check the logs for details.',
            ephemeral: false 
          });
        }
      } catch (replyError) {
        console.error('Failed to send error response:', replyError);
      }
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

// Endpoint to register commands to a specific guild
app.get('/register/:guildId', async (req, res) => {
  const { guildId } = req.params;
  
  if (!client.user) {
    return res.status(500).send('Bot is not logged in yet. Try again later.');
  }
  
  const success = await registerCommandsToGuild(guildId);
  
  if (success) {
    res.send(`Commands registered to guild ID: ${guildId}`);
  } else {
    res.status(500).send(`Failed to register commands to guild ID: ${guildId}`);
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Login to Discord
client.login(process.env.DISCORD_TOKEN); 