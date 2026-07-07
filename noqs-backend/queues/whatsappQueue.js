const { Queue } = require('bullmq');
const { buildBullConnection } = require('./connection');

const QUEUE_NAME = 'whatsapp-inbound';

let queue = null;
function getWhatsAppQueue() {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: buildBullConnection() });
  }
  return queue;
}

module.exports = { getWhatsAppQueue, QUEUE_NAME };
