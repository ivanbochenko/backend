import { Elysia, t, ws } from "elysia"
import { PrismaClient } from '@prisma/client'
import { jwt } from '@elysiajs/jwt'
import { queryRoute } from "./queries";
import { mutationRoute } from "./mutations";

const client = new PrismaClient()

export const setdb = (app: Elysia) => app.decorate("db", client)

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET ?? '123',
      exp: '30d'
    })
  )
  .use(ws())
  // .ws('/ws', {
  //   // validate incoming message
  //   body: t.Object({
  //     message: t.String()
  //   }),
  //   message(ws, { message }) {
  //     ws.publish('chat_id', {
  //       message,
  //       time: Date.now()
  //     })
  //   }
  // })
  .use(setdb)
  .group('/login', app => app
    // .post('/', async ({jwt}) => jwt.sign({id: '1011'}))
    .post('/token',
      async ({jwt, body}) => {
        const payload = await jwt.verify(body.token)
        if (!payload) throw Error('Unauthorized')
        const { id } = payload
        const token = await jwt.sign({id})
        return { token, id }
      },
      {
        body: t.Object({
          token: t.String()
        })
      }
    )
    .post('/password', () => 'Passed-in')
    .post('/register', () => 'Registered')
    .post('/restore', () => 'Restored')
  )
  .derive(async ({ request: { headers }, jwt }) => {
    const auth = headers.get('Authorization') ?? undefined
    const payload = await jwt.verify(auth)
    if (!payload) throw Error('Unauthorized')
    return { id: payload.id }
  })
  .use(queryRoute)
  .use(mutationRoute)
  .listen(3000);

export type App = typeof app

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);