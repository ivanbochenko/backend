import { Expo, ExpoPushMessage } from 'expo-server-sdk'
import { dbClient } from './index'
const expo = new Expo()

export const sendPushNotifications = async (pushTokens: (string | null)[], message: ExpoPushMessage) => {
  let messages = []
  for (const pushToken of pushTokens) {

    // Check that all your push tokens appear to be valid Expo push tokens
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Push token ${pushToken} is not a valid Expo push token`)
      continue
    }
  
    // Construct a message (see https://docs.expo.io/push-notifications/sending-notifications/)
    messages.push({
      ...message,
      to: pushToken
    })
  }

  const chunks = expo.chunkPushNotifications(messages);
  let tickets = [];

  (async () => {
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk)
        tickets.push(...ticketChunk)
      } catch (error) {
        console.error(error)
      }
    }
  })();
}

type Message = {
  text: string,
  time: Date,
  author_id: string,
  event_id: string,
  author: {
    id: string,
    name: string | null,
    token: string | null,
    avatar: string | null
  }
}

export const notifyUsersInChat = async (event_id: string, message: Message) => {
  const matches = await dbClient.match.findMany({
    where: {
      event_id
    },
    include: {
      user: true,
    }
  })
  // Get tokens
  const tokens = matches.map(m => m.user.token)
  // Include event author
  const event = await dbClient.event.findUnique({
    where: { id: event_id },
    include: { author: true }
  })
  tokens.push(event!.author.token)
  // Exclude message author
  const index = tokens.indexOf(message.author.token)
  if (index > -1) {
    tokens.splice(index, 1)
  }
  // Notify users in chat
  if (tokens) {
    await sendPushNotifications(tokens, {
      to: '',
      sound: 'default',
      title: message.author.name ?? '',
      body: message.text,
    })
  }
}