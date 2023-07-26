import { Elysia, t, ws } from "elysia"
import { PrismaClient } from '@prisma/client'
import { jwt } from '@elysiajs/jwt'
import { v4 as uuid } from "uuid";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { queryRoute } from "./queries"
import { mutationRoute } from "./mutations"
import { loginRoute } from "./login"
import { passwordRoute } from "./password";
import { notifyUsersInChat } from "./notifications";

export const dbClient = new PrismaClient()

const region = process.env.AWS_REGION

const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
})

export const setdb = (app: Elysia) => app.decorate("db", dbClient)

export const auth = async (app: Elysia) => app
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET ?? '123',
      exp: '30d'
    })
  )
  .derive(async ({ request: { headers }, jwt }) => {
    const auth = headers.get('Authorization') ?? undefined
    const payload = await jwt.verify(auth)
    if (!payload) throw Error('Unauthorized')
    return { id: payload.id }
  })

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(loginRoute)
  .use(passwordRoute)
  .use(auth)
  .use(queryRoute)
  .use(mutationRoute)
  .use(setdb)
  .use(ws())
  .ws('/chat/:event_id/:user_id', {
    open(ws) {
      ws.subscribe(ws.data.params.event_id)
    },
    async message(ws, message) {
      const { event_id, user_id } = ws.data.params
      // const myMessage = message as any
      const newMessage = await dbClient.message.create({
        data: {
          text: message as string,
          author_id: user_id,
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
	.post('/photo',
    async ({ body: { file }, id }) => {
      const Bucket = "onlyfriends-bucket"
      const Key = `${id}/${uuid()}`
      const Expires = new Date(new Date().setMonth(new Date().getMonth() + 2))
      const Body = Buffer.from(await file.arrayBuffer())
      const command = new PutObjectCommand({
        Bucket,
        Key,
        Expires,
        Body,
        ContentType: file.type,
      })
      await s3.send(command)
      return `https://${Bucket}.s3.${region}.amazonaws.com/${Key}`
    },
    {
      body: t.Object({
        file: t.File()
      })
	  }
  )
  .listen(3000);

export type App = typeof app

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);