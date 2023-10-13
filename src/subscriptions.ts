import { Elysia, t } from "elysia"
import { db } from "./dataBaseClient"
import { notifyUsersInChat } from "./notifications"

export const subscriptionRoute = new Elysia()
  .ws('/chat/:event_id', {
    params: t.Object({
      event_id: t.String()
    }),
    body: t.Object({
      text: t.String(),
      author_id: t.String(),
    }),
    open(ws) {
      ws.subscribe(ws.data.params.event_id)
    },
    async message(ws, message) {
      const newMessage = await db.message.create({
        data: { ...message, event_id: ws.data.params.event_id },
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
      ws.publish(ws.data.params.event_id, newMessage)
      await notifyUsersInChat(ws.data.params.event_id, newMessage)
    },
    close(ws) {
      ws.unsubscribe(ws.data.params.event_id)
    },
  })