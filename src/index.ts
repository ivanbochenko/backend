import { Elysia } from "elysia"
import { PrismaClient } from '@prisma/client'
import { jwt } from '@elysiajs/jwt'
import { queryRoute } from "./queries"
import { mutationRoute } from "./mutations"
import { loginRoute } from "./login"
import { passwordRoute } from "./password";
import { subscriptionRoute } from "./subscriptions";
import { photoRoute } from "./photo"

export const dbClient = new PrismaClient()

export const setdb = new Elysia().decorate("db", dbClient)

export const auth = new Elysia()
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
  .get("/", () => "Hello 😜")
  .use(loginRoute)
  .use(passwordRoute)
  .use(photoRoute)
  .use(auth)
  .use(queryRoute)
  .use(mutationRoute)
  .use(subscriptionRoute)
  .listen(3000)

export type App = typeof app

console.log(`😜 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);