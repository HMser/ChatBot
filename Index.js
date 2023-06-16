const { WAConnection, MessageType } = require("@adiwajshing/baileys");
const PhoneNumber = require("awesome-phonenumber");
const { formatPhoneNumber } = require("awesome-phonenumber");
const chalk = require("chalk");
const pino = require("pino");
const qrcode = require("qrcode-terminal");
const util = require("util");
const fs = require("fs");

const log = pino();

// Load your OpenAI API key
const openai = require('openai')('YOUR_OPENAI_API_KEY');

// Load WhatsApp credentials
const SESSION_FILE_PATH = "./session.json";
let sessionData;

// Check if session data file exists
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionData = require(SESSION_FILE_PATH);
}

// Create a new instance of WAConnection
const conn = new WAConnection();

// Event fired when a new message is received
conn.on("message-new", async (message) => {
  try {
    // Check if the message is a personal message or a group message
    if (message.key.remoteJid.includes("@s.whatsapp.net")) {
      // Personal message
      const response = await generateReply(message.message.conversation);
      await conn.sendMessage(message.key.remoteJid, response, MessageType.text);
    } else {
      // Group message
      const groupMetadata = await conn.groupMetadata(message.key.remoteJid);
      const groupParticipants = groupMetadata.participants;
      const sender = groupParticipants.find((participant) => participant.jid === message.participant);
      
      // Exclude bot from responding to its own messages
      if (sender.isUser) {
        const response = await generateReply(message.message.conversation);
        await conn.sendMessage(message.key.remoteJid, response, MessageType.text);
      }
    }
  } catch (error) {
    log.error("An error occurred while processing the message:", error);
  }
});

// Function to generate a reply using OpenAI
async function generateReply(message) {
  // Send the message to OpenAI for processing
  const response = await openai.complete({
    engine: 'text-davinci-003',
    prompt: message,
    maxTokens: 100,
    n: 1,
    stop: '\n',
    temperature: 0.6,
  });
  
  // Get the generated reply from the OpenAI response
  const reply = response.choices[0].text.trim();
  
  return reply;
}

// Event fired when the connection is opened
conn.on("open", () => {
  log.info("Connected to WhatsApp");
});

// Event fired when a QR code is received
conn.on("qr", (qr) => {
  // Display the QR code in the terminal
  qrcode.generate(qr, { small: true });
});

// Event fired when an authentication is successful
conn.on("authenticated", (session) => {
  log.info("Authenticated to WhatsApp");
  
  // Save the session data to file
  sessionData = session;
  fs.writeFileSync(SESSION_FILE_PATH, JSON.stringify(session));
});

// Event fired when an authentication fails
conn.on("auth_failure", (error) => {
  log.error("Authentication failed:", error);
});

// Event fired when the connection is closed
conn.on("close", () => {
  log.info("Disconnected from WhatsApp");
});

// Load the session data if available
if (sessionData) {
  conn.loadAuthInfo(sessionData);
}

// Connect to WhatsApp
conn.connect();

// Function to format phone numbers
function formatPhoneNumber(phoneNumber) {
  const pn = new PhoneNumber(phoneNumber, "IN");
  if (pn.isValid()) {
    return pn.getNumber("international");
  }
  return phoneNumber;
}
