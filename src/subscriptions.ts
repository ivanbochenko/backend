import { Elysia, ws } from "elysia"
import { dbClient } from "."
import { notifyUsersInChat } from "./notifications"

export const subscriptionRoute = (app: Elysia) => app
  .use(ws())
  .ws('/chat/:event_id/:author_id', {
    open(ws) {
      ws.subscribe(ws.data.params.event_id)
    },
    async message(ws, message) {
      const { event_id, author_id } = ws.data.params
      const newMessage = await dbClient.message.create({
        data: {
          text: message as string,
          author_id,
          event_id,
        },
        include: {
          author: {
            select: {
              id: true,
              name: true,
              avatar: true,
              token: true
            }
          }
        }
      })
      ws.publish(event_id, newMessage)
      notifyUsersInChat(event_id, newMessage)
    },
    close(ws) {
      ws.unsubscribe(ws.data.params.event_id)
    },
  })