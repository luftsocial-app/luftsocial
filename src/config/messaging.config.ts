export default () => ({
  messaging: {
    throttle: {
      // Time between messages (ms)
      messageRateMs: process.env.MESSAGE_THROTTLE_MS || 500,
      // Time between typing indicators (ms)
      typingRateMs: process.env.TYPING_THROTTLE_MS || 2000,
      // Time between read receipts (ms)
      readReceiptRateMs: process.env.READ_RECEIPT_THROTTLE_MS || 1000,
    },
    maxClientsPerUser: parseInt(process.env.MAX_CLIENTS_PER_USER || '5', 10),
    connectionTimeout: parseInt(
      process.env.WS_CONNECTION_TIMEOUT || '30000',
      10,
    ),
  },
});
