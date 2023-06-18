import { Elysia, t } from "elysia"
import { PrismaClient } from '@prisma/client'
import { jwt } from '@elysiajs/jwt'
import { queryRoute } from "./queries";

const client = new PrismaClient()

export const setup = (app: Elysia) => app
  .decorate("db", client)
  .derive(({ request: { headers } }) => ({
    authorization: headers.get('Authorization')
  }))
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET ?? '123',
      exp: '30d'
    })
  )

const app = new Elysia()
  .get("/", () => "Hello Elysia")
  .use(setup)
  .group('/login', app => app
    // .post('/', async ({jwt}) => jwt.sign({id: '1011'}))
    .post('/token', async ({jwt, body}) => {
      const payload = await jwt.verify(body.token)
      if (!payload) {
        throw Error('Unauthorized')
      }
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
  .derive(async ({ authorization, jwt }) => {
    const profile = await jwt.verify(authorization!)
    if (!profile) throw Error('Unauthorized')
    return { id: profile.id }
  })
  .use(queryRoute)
  .listen(3000);

export type App = typeof app

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);